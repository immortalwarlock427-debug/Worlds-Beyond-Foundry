import { ABILITY_TYPES, ABILITY_STATS, ABILITY_COST_UNITS, ABILITY_ICON, abilityRecord, abilityResources, abilityFormUpdates } from "./abilities-core.mjs";
import { wholeDisplay, wholeFormUpdates, bindWholeNumbers } from "./number-display.mjs";
import { itemEffectRows } from "./effects-core.mjs";
import { itemEffectAction } from "./effects.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { inCombat, payAp } from "./combat-support.mjs";
import { adjustedResourceSpent, customResourceId } from "./resources.mjs";
import { endOtherForms } from "./forms.mjs";
import { recoveryChoices } from "./consumable-benefits.mjs";
import { TRIGGER_MODES, TRIGGER_COMPARISONS, TRIGGER_END_MODES } from "./form-trigger-core.mjs";

const SYSTEM_ID = "worlds-beyond";

export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, NumberField, SchemaField } = foundry.data.fields;
    const text = (initial = "", options = {}) => new StringField({ required: true, nullable: false, blank: true, initial, ...options });
    const number = (initial = null, options = {}) => new NumberField({ required: true, nullable: initial === null, initial, ...options });
    return {
      effectsActive: new foundry.data.fields.BooleanField({ initial: false }),
      trigger: new SchemaField({ mode: text("manual", { choices: TRIGGER_MODES, blank: false }), resourceId: text(), comparison: text("above", { choices: TRIGGER_COMPARISONS, blank: false }), threshold: number(), endMode: text("prompt", { choices: TRIGGER_END_MODES, blank: false }) }),
      kind: text("active", { choices: ABILITY_TYPES, blank: false }), category: text(), description: text(), notes: text(), duration: text(),
      apCost: number(null, { min: 0 }), apDiscountStat: text("", { choices: ABILITY_STATS }),
      resourceId: text(), resourceCost: number(null, { min: 0 }), resourceUnit: text("points", { choices: ABILITY_COST_UNITS, blank: false }),
      uses: new SchemaField({ max: number(null, { min: 0 }), spent: number(0), recovery: text() }),
      cooldown: new SchemaField({ rounds: number(null, { min: 0 }), remaining: number(0, { min: 0 }) })
    };
  }
}

export class AbilitySheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet", "wb-item-sheet", "wb-ability-sheet"], position: { width: 480, height: 660 },
    window: { resizable: true }, form: { submitOnChange: true },
    actions: { itemEffect: async function (event, target) { try { return await itemEffectAction(this.item, target, this.isEditable); } catch (error) { ui.notifications.error(error.message); } } }
  };
  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/ability-sheet.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const system = this.item.system, character = this.item.actor?.system;
    const choices = (definitions, selected) => Object.entries(definitions).map(([value, label]) => ({ value, label, selected: value === selected }));
    return Object.assign(await super._prepareContext(options), {
      item: this.item, system: wholeDisplay({ ...system }), editable: this.isEditable,
      itemEffects: itemEffectRows(this.item), passive: system.kind === "passive", isForm: system.kind === "form",
      record: wholeDisplay(abilityRecord(this.item, character)),
      kinds: choices(Object.fromEntries(Object.entries(ABILITY_TYPES).filter(([key]) => key !== "form")), system.kind), stats: choices(ABILITY_STATS, system.apDiscountStat),
      units: choices(ABILITY_COST_UNITS, system.resourceUnit), resources: abilityResources(character, system.resourceId),
      hasActor: !!character,
      triggerModes: choices(TRIGGER_MODES, system.trigger?.mode ?? "manual"), triggerComparisons: choices(TRIGGER_COMPARISONS, system.trigger?.comparison ?? "above"), triggerEndModes: choices(TRIGGER_END_MODES, system.trigger?.endMode ?? "prompt"),
      triggerResources: [{ value: "", label: "Choose resource", selected: !system.trigger?.resourceId }, ...recoveryChoices(character, system.trigger?.resourceId || "")]
    });
  }

  _processFormData(event, form, formData) {
    const data = wholeFormUpdates(super._processFormData(event, form, formData), form, { system: this.item.system });
    return abilityFormUpdates(this.item.system, data);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const button of this.element?.querySelectorAll('[data-action="itemEffect"][data-operation="edit"]') ?? []) button.disabled = false;
    if (this.isEditable) bindWholeNumbers(this.element);
  }
}

export async function createAbility(actor, kind = "active") {
  if (!actor.isOwner || actor.type !== "character") return;
  if (!Object.hasOwn(ABILITY_TYPES, kind)) throw new Error("Choose an ability type.");
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name: kind === "form" ? "New form" : "New ability", type: "ability", img: ABILITY_ICON, system: { kind, ...(kind === "form" ? { trigger: { mode: "prompt", endMode: "prompt" } } : {}) } }]);
  if (!item) throw new Error("The ability was not created. Try again.");
  await item.sheet.render({ force: true });
  return item;
}

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function useAbility(actor, id, { end = false, triggered = false, guard } = {}) {
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const item = actor.items.get(id);
    if (!actor.isOwner || item?.type !== "ability" || item.system.kind === "passive") return;
    if (guard && !guard()) return;
    const updateOptions = triggered ? { worldsBeyondFormTrigger: true } : {};
    if (end) {
      if (!item.system.effectsActive) return;
      const result = await item.update({ "system.effectsActive": false });
      if (!result) throw new Error("Ending the ability was cancelled.");
      return result;
    }
    if (item.system.effectsActive) return;
    const record = abilityRecord(item, actor.system);
    if (record.uses.tracked && !(record.uses.value >= 1)) throw new Error("No ability uses left. Correct the tracker if needed.");
    if (record.remaining > 0) throw new Error("This ability is on cooldown. Correct the tracker if needed.");
    const cost = Number(item.system.resourceCost) || 0, key = item.system.resourceId;
    const path = ["mana", "holyPower"].includes(key) ? `system.${key}` : `system.customResources.${key}`;
    const pool = ["mana", "holyPower"].includes(key) ? actor.system[key] : actor.system.customResources?.[key];
    let spent;
    if (cost && key) {
      if (!pool || (!["mana", "holyPower"].includes(key) && !customResourceId(key))) throw new Error("That ability's resource no longer exists.");
      if (["mana", "holyPower"].includes(key) && !pool.enabled) throw new Error("Enable this ability's resource under Character → Resources first.");
      const points = item.system.resourceUnit === "percent" ? pool.max * cost / 100 : cost;
      spent = adjustedResourceSpent(pool, "spend", points);
    }
    // Use is an explicit paid activation, including testing outside an encounter.
    const ap = record.ap ?? 0;
    const reaction = inCombat(actor) && item.system.kind === "reaction";
    if (reaction && !(actor.system.reactions.value >= 1)) throw new Error("No reactions left. Correct the tracker if needed.");
    const messageMode = game.settings.get("core", "messageMode");
    if (ap) await payAp(actor, ap, change, { updateOptions });
    const previousSpent = pool?.spent;
    if (spent !== undefined) await change(() => actor.update({ [`${path}.spent`]: spent }, updateOptions), () => actor.update({ [`${path}.spent`]: previousSpent }, updateOptions));
    if (reaction) await change(() => actor.update({ "system.reactions.value": actor.system.reactions.value - 1 }), () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1 }));
    const previous = { "system.effectsActive": false, "system.uses.spent": item.system.uses.spent, "system.cooldown.remaining": item.system.cooldown.remaining };
    if (item.system.kind === "form") await endOtherForms(actor, change, { itemId: item.id });
    const hasBonuses = itemEffectRows(item).length > 0;
    const staysActive = hasBonuses || item.system.kind === "form";
    const updates = { "system.effectsActive": staysActive, "system.uses.spent": item.system.uses.spent + (record.uses.tracked ? 1 : 0), "system.cooldown.remaining": item.system.cooldown.rounds ?? 0 };
    // Native updates can return undefined when there is no diff. A simple ability
    // without bonuses or trackers still posts and pays its configured costs.
    if (Object.keys(updates).some(key => updates[key] !== previous[key])) await change(() => item.update(updates), () => item.update(previous));
    return createActionMessage({ speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content: `<div class="worlds-beyond wb-ability-card"><h3>${escapeHTML(item.name)}</h3><p>Used${ap ? ` · ${ap} AP spent` : ""}${reaction ? " · 1 reaction spent" : ""}.${hasBonuses ? " Bonuses enabled until ended." : ""}</p><details class="wb-disclosure"><summary>Details</summary><p>${escapeHTML(item.system.description)}</p></details></div>`
    }, { messageMode });
  }));
}
