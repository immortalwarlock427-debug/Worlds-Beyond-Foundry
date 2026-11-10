import {
  ABILITY_TYPES,
  ABILITY_STATS,
  ABILITY_COST_UNITS,
  ABILITY_ICON,
  abilityRecord,
  abilityResources,
  abilityFormUpdates
} from "./abilities-core.mjs";
import { imagePicker } from "./image-picker.mjs";
import { wholeDisplay, wholeNumber, wholeFormUpdates, bindWholeNumbers } from "./number-display.mjs";
import { itemEffectRows } from "./effects-core.mjs";
import { itemEffectAction } from "./effects.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { inCombat, payAp, planApPayment } from "./combat-support.mjs";
import { requireActionCapacity } from "./condition-actions.mjs";
import { adjustedResourceSpent, customResourceId } from "./resources.mjs";
import { endOtherForms } from "./forms.mjs";
import { recoveryChoices, recoveryPool, restorationPlan, restorationAmount } from "./consumable-benefits.mjs";
import { TRIGGER_MODES, TRIGGER_COMPARISONS, TRIGGER_END_MODES } from "./form-trigger-core.mjs";
import { BONUS_DURATION_UNITS, bonusDurationText } from "./effect-duration.mjs";
import { abilityActive, cooldownRemaining, abilityTimerFormUpdates } from "./ability-timers-core.mjs";
import { abilityTimerPlans, validateAbilityTimers, startAbilityTimers, stopAbilityClock, cleanupAbilityClocks } from "./ability-timers.mjs";
import { USES_RECOVERY } from "./recovery-core.mjs";
import { formLoadoutSchema, formLoadoutContext, copyFormEquipment, syncFormLoadout } from "./form-loadouts.mjs";
import { formLoadoutFormUpdates } from "./form-loadout-core.mjs";
import { TARGETING_MODES, TARGETING_STATS, SAVE_STATS, SAVE_SUCCESS, saveDc, targetingStat } from "./strike-core.mjs";
import { AREA_SHAPES, VISUAL_EFFECTS, VISUAL_COLORS, areaSettings, areaLabel } from "./area-core.mjs";

const SYSTEM_ID = "worlds-beyond";

export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, NumberField, SchemaField } = foundry.data.fields;
    const text = (initial = "", options = {}) => new StringField({ required: true, nullable: false, blank: true, initial, ...options });
    const number = (initial = null, options = {}) => new NumberField({ required: true, nullable: initial === null, initial, ...options });
    return {
      loadout: formLoadoutSchema(),
      effectsActive: new foundry.data.fields.BooleanField({ initial: false }),
      activeDuration: new SchemaField({
        combatRounds: number(null, { min: 0, integer: true }),
        value: number(null, { min: 0, integer: true }),
        units: text("rounds", { choices: BONUS_DURATION_UNITS, blank: false })
      }),
      timers: new SchemaField({ durationId: text(), cooldownId: text() }),
      trigger: new SchemaField({
        mode: text("manual", { choices: TRIGGER_MODES, blank: false }),
        resourceId: text(),
        comparison: text("above", { choices: TRIGGER_COMPARISONS, blank: false }),
        threshold: number(),
        endMode: text("prompt", { choices: TRIGGER_END_MODES, blank: false })
      }),
      kind: text("active", { choices: ABILITY_TYPES, blank: false }),
      category: text(),
      description: text(),
      notes: text(),
      duration: text(),
      apCost: number(null, { min: 0 }),
      apDiscountStat: text("", { choices: ABILITY_STATS }),
      resourceId: text(),
      resourceCost: number(null, { min: 0 }),
      resourceUnit: text("points", { choices: ABILITY_COST_UNITS, blank: false }),
      restoration: new SchemaField({
        target: text("health"),
        amount: text(),
        unit: text("points", { choices: ABILITY_COST_UNITS, blank: false })
      }),
      uses: new SchemaField({
        max: number(null, { min: 0 }),
        spent: number(0),
        recovery: text(),
        resetOn: text("manual", { choices: USES_RECOVERY, blank: false })
      }),
      targeting: new SchemaField({
        mode: text("none", { choices: TARGETING_MODES, blank: false }),
        stat: text("", { choices: TARGETING_STATS }),
        saveStat: text("", { choices: SAVE_STATS }),
        dc: number(null, { integer: true }),
        onSave: text("none", { choices: SAVE_SUCCESS, blank: false }),
        damage: text(),
        damageType: text(),
        area: new SchemaField({
          shape: text("single", { choices: AREA_SHAPES, blank: false }),
          size: number(null, { min: 0 }),
          width: number(null, { min: 0 }),
          angle: number(null, { min: 1, max: 360 }),
          includeSelf: new foundry.data.fields.BooleanField({ initial: false })
        }),
        visual: new SchemaField({
          effect: text("none", { choices: VISUAL_EFFECTS, blank: false }),
          color: text()
        })
      }),
      cooldown: new SchemaField({
        rounds: number(null, { min: 0 }),
        remaining: number(0, { min: 0 }),
        automatic: new foundry.data.fields.BooleanField({ initial: false })
      })
    };
  }
}

export class AbilitySheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet", "wb-item-sheet", "wb-ability-sheet"],
    position: { width: 480, height: 660 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      itemEffect: async function (event, target) {
        try {
          return await itemEffectAction(this.item, target, this.isEditable);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      pickFormPortrait: function () {
        if (!this.isEditable || this.item.system.kind !== "form") return;
        return imagePicker({
          type: "image",
          current: this.item.system.loadout.portrait || this.item.actor?.img,
          callback: path => this.item.update({ "system.loadout.portrait": path }).catch(error => ui.notifications.error(error.message))
        }).browse();
      },
      pickFormToken: function () {
        if (!this.isEditable || this.item.system.kind !== "form") return;
        return imagePicker({
          type: "image",
          current: this.item.system.loadout.tokenImg || this.item.actor?.token?.texture.src || this.item.actor?.prototypeToken?.texture.src,
          callback: path => this.item.update({ "system.loadout.tokenImg": path }).catch(error => ui.notifications.error(error.message))
        }).browse();
      },
      copyFormEquipment: async function () {
        if (!this.isEditable) return;
        try {
          await copyFormEquipment(this.item);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      }
    }
  };
  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/ability-sheet.hbs`, scrollable: [""] } };

  _syncPartState(partId, newElement, priorElement, state) {
    // Native v14 restores scroll before reopening details. A closed loadout is
    // shorter, so the saved position is clamped and its focused field jumps.
    for (const [id, open] of Object.entries(state.details ?? {})) {
      const details = newElement.querySelector(`details[data-sync="${id}"]`);
      if (details) details.open = open;
    }
    super._syncPartState(partId, newElement, priorElement, state);
  }

  async _prepareContext(options) {
    const system = this.item.system,
      character = this.item.actor?.system;
    const choices = (definitions, selected) =>
      Object.entries(definitions).map(([value, label]) => ({ value, label, selected: value === selected }));
    return Object.assign(await super._prepareContext(options), {
      item: this.item,
      system: {
        ...wholeDisplay({
          ...system,
          effectsActive: abilityActive(this.item),
          cooldown: { ...system.cooldown, remaining: cooldownRemaining(this.item) }
        }),
        loadout: { ...system.loadout }
      },
      editable: this.isEditable,
      durationUnits: choices(BONUS_DURATION_UNITS, system.activeDuration?.units ?? "rounds"),
      useRecoveryChoices: choices(USES_RECOVERY, system.uses?.resetOn ?? "manual"),
      itemEffects: itemEffectRows(this.item),
      passive: system.kind === "passive",
      isForm: system.kind === "form",
      record: wholeDisplay(abilityRecord(this.item, character)),
      kinds: choices(Object.fromEntries(Object.entries(ABILITY_TYPES).filter(([key]) => key !== "form")), system.kind),
      stats: choices(ABILITY_STATS, system.apDiscountStat),
      units: choices(ABILITY_COST_UNITS, system.resourceUnit),
      resources: abilityResources(character, system.resourceId),
      restorationResources: recoveryChoices(character, system.restoration?.target ?? "health"),
      restorationUnits: choices(ABILITY_COST_UNITS, system.restoration?.unit ?? "points"),
      targeting: targetingContext(system, character, choices),
      hasActor: !!character,
      formLoadout: formLoadoutContext(this.item),
      triggerModes: choices(TRIGGER_MODES, system.trigger?.mode ?? "manual"),
      triggerComparisons: choices(TRIGGER_COMPARISONS, system.trigger?.comparison ?? "above"),
      triggerEndModes: choices(TRIGGER_END_MODES, system.trigger?.endMode ?? "prompt"),
      triggerResources: [
        { value: "", label: "Choose resource", selected: !system.trigger?.resourceId },
        ...recoveryChoices(character, system.trigger?.resourceId || "")
      ]
    });
  }

  _processFormData(event, form, formData) {
    const original = { ...this.item.system, cooldown: { ...this.item.system.cooldown, remaining: cooldownRemaining(this.item) } };
    const data = wholeFormUpdates(super._processFormData(event, form, formData), form, { system: original });
    return abilityTimerFormUpdates(this.item, formLoadoutFormUpdates(this.item.system, abilityFormUpdates(this.item.system, data)));
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const button of this.element?.querySelectorAll('[data-action="itemEffect"][data-operation="edit"]') ?? []) button.disabled = false;
    if (this.isEditable) bindWholeNumbers(this.element);
  }
}

// Ability editor choices for Targeting, with the DC this character would set.
function targetingContext(system, character, choices) {
  const targeting = system.targeting ?? {};
  const statKey = targetingStat(system);
  const modifier = statKey && character ? character.stats?.[statKey]?.mod : null;
  return {
    enabled: (targeting.mode ?? "none") !== "none",
    save: targeting.mode === "save",
    heal: targeting.mode === "heal",
    modes: choices(TARGETING_MODES, targeting.mode ?? "none"),
    stats: choices(TARGETING_STATS, targeting.stat ?? ""),
    saveStats: choices(SAVE_STATS, targeting.saveStat ?? ""),
    onSave: choices(SAVE_SUCCESS, targeting.onSave ?? "none"),
    dcPreview: modifier == null ? null : saveDc(modifier, targeting.dc),
    dcDefault: modifier == null ? "12 + modifier" : String(saveDc(modifier)),
    areaShapes: choices(AREA_SHAPES, targeting.area?.shape ?? "single"),
    area: { ...areaSettings(targeting.area), label: areaLabel(targeting.area) },
    areaAttack: targeting.mode === "attack" && (targeting.area?.shape ?? "single") !== "single",
    needsDc: targeting.mode === "save" || (targeting.mode === "attack" && (targeting.area?.shape ?? "single") !== "single"),
    showSize: (targeting.area?.shape ?? "single") !== "single",
    showAngle: targeting.area?.shape === "cone",
    showWidth: targeting.area?.shape === "line",
    visualEffects: choices(VISUAL_EFFECTS, targeting.visual?.effect ?? "none"),
    visualDefault: VISUAL_COLORS[targeting.visual?.effect] ?? "",
    hasVisual: (targeting.visual?.effect ?? "none") !== "none"
  };
}

export async function createAbility(actor, kind = "active", { spellStat } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  if (!Object.hasOwn(ABILITY_TYPES, kind)) throw new Error("Choose an ability type.");
  if (spellStat && (kind !== "active" || !["int", "fth"].includes(spellStat))) throw new Error("Choose INT or FTH for the spell preset.");
  const [item] = await actor.createEmbeddedDocuments("Item", [
    {
      name: spellStat ? "New spell" : kind === "form" ? "New form" : "New ability",
      type: "ability",
      img: ABILITY_ICON,
      system: {
        kind,
        ...(kind === "form" ? { trigger: { mode: "prompt", endMode: "prompt" } } : {}),
        ...(spellStat
          ? { category: "Spell", apCost: 11, apDiscountStat: spellStat, resourceId: spellStat === "int" ? "mana" : "holyPower" }
          : {})
      }
    }
  ]);
  if (!item) throw new Error("The ability was not created. Try again.");
  await item.sheet.render({ force: true });
  return item;
}

export async function createSpell(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Add spell" },
    classes: ["worlds-beyond", "wb-roll-dialog"],
    content: `<label>Casting stat<select name="stat"><option value="int">INT · Arcane / Mana</option><option value="fth">FTH · Holy / Holy power</option></select></label><p>11 base AP, adjusted by this stat. Set the spell's resource cost in its editor.</p>`,
    ok: { label: "Create spell" },
    rejectClose: false
  });
  if (!result) return;
  if (!["int", "fth"].includes(result.stat)) throw new Error("Choose INT or FTH for the spell preset.");
  return createAbility(actor, "active", { spellStat: result.stat });
}

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function useAbility(actor, id, { end = false, triggered = false, guard } = {}) {
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      const item = actor.items.get(id);
      if (!actor.isOwner || item?.type !== "ability" || item.system.kind === "passive") return;
      if (guard && !guard()) return;
      const updateOptions = triggered ? { worldsBeyondFormTrigger: true } : {};
      if (end) {
        if (!item.system.effectsActive) return;
        await stopAbilityClock(item, "duration", change);
        const result = await change(
          () => item.update({ "system.effectsActive": false }, { ...updateOptions, worldsBeyondFormLoadout: true }),
          () => item.update({ "system.effectsActive": true }, { ...updateOptions, worldsBeyondFormLoadout: true })
        );
        if (item.system.kind === "form") await syncFormLoadout(actor, change);
        return result;
      }
      if (abilityActive(item)) return;
      const record = abilityRecord(item, actor.system);
      if (record.uses.tracked && !(record.uses.value >= 1)) throw new Error("No ability uses left. Correct the tracker if needed.");
      if (record.remaining > 0) throw new Error("This ability is on cooldown. Correct the tracker if needed.");
      const timerPlans = abilityTimerPlans(item);
      validateAbilityTimers(item, timerPlans);
      const timed = timerPlans.some(plan => plan.kind === "duration");
      const bonusRows = itemEffectRows(item),
        hasBonuses = bonusRows.length > 0;
      const otherBenefit = timed || item.system.kind === "form" || bonusRows.some(row => !row.disabled);
      const benefit = item.system.restoration,
        formula = String(benefit?.amount ?? "").trim();
      const target = benefit?.target ?? "health",
        restorePool = formula ? recoveryPool(actor.system, target) : null;
      if (formula) {
        if (!restorePool) throw new Error("This ability's restoration resource is missing or hidden. Choose an available resource.");
        if (!foundry.dice.Roll.validate(formula)) throw new Error("Enter a restoration amount or complete dice such as 20 or 2d6+2.");
        if (benefit.unit === "percent" && !(restorePool.max > 0) && !otherBenefit)
          throw new Error("Set a positive resource maximum before using percentage restoration.");
        if (!otherBenefit && restorationPlan(actor.system, target, 1).restored === 0) {
          ui.notifications.info(
            target === "health" ? "You are at full health. Nothing was spent." : `Your ${restorePool.label} is full. Nothing was spent.`
          );
          return;
        }
      }
      const cost = Number(item.system.resourceCost) || 0,
        key = item.system.resourceId;
      const path = ["mana", "holyPower"].includes(key) ? `system.${key}` : `system.customResources.${key}`;
      const pool = ["mana", "holyPower"].includes(key) ? actor.system[key] : actor.system.customResources?.[key];
      let spent;
      if (cost && key) {
        if (!pool || (!["mana", "holyPower"].includes(key) && !customResourceId(key)))
          throw new Error("That ability's resource no longer exists.");
        if (["mana", "holyPower"].includes(key) && !pool.enabled)
          throw new Error("Enable this ability's resource under Character → Resources first.");
        const points = item.system.resourceUnit === "percent" ? (pool.max * cost) / 100 : cost;
        spent = adjustedResourceSpent(pool, "spend", points);
      }
      const combat = inCombat(actor);
      const ap = combat ? (record.ap ?? 0) : 0;
      const reaction = combat && item.system.kind === "reaction";
      requireActionCapacity(actor, { ap, reaction });
      if (reaction && !(actor.system.reactions.value >= 1)) throw new Error("No reactions left. Correct the tracker if needed.");
      const messageMode = game.settings.get("core", "messageMode");
      if (ap) planApPayment(actor, ap);
      let roll = null,
        rollHTML = "",
        amount = 0;
      if (formula) {
        roll = await new foundry.dice.Roll(formula).evaluate({ allowInteractive: messageMode !== "blind" });
        amount = restorationAmount(roll.total, benefit.unit, restorePool.max);
        if (!amount && !otherBenefit) {
          ui.notifications.info("No restoration was rolled. Nothing was spent.");
          return;
        }
        rollHTML = await roll.render();
      }
      if (ap) await payAp(actor, ap, change, { updateOptions });
      const previousSpent = pool?.spent;
      if (spent !== undefined)
        await change(
          () => actor.update({ [`${path}.spent`]: spent }, updateOptions),
          () => actor.update({ [`${path}.spent`]: previousSpent }, updateOptions)
        );
      const reactionBefore = actor.system.reactions?.value;
      if (reaction)
        await change(
          () => {
            requireActionCapacity(actor, { reaction: true });
            return actor.update({ "system.reactions.value": reactionBefore - 1 }, updateOptions);
          },
          () => actor.update({ "system.reactions.value": reactionBefore }, updateOptions)
        );
      // Re-read expenditure after costs: paying and restoring the same pool must
      // not overwrite the payment. Percentage amounts use the pre-use maximum.
      const restoration = formula ? restorationPlan(actor.system, target, amount) : null;
      if (restoration?.restored)
        await change(
          () => actor.update({ [restoration.path]: restoration.next }, updateOptions),
          () => actor.update({ [restoration.path]: restoration.previous }, updateOptions)
        );
      const previous = {
        "system.effectsActive": item.system.effectsActive,
        "system.uses.spent": item.system.uses.spent,
        "system.cooldown.remaining": item.system.cooldown.remaining
      };
      const timerIds = await startAbilityTimers(item, timerPlans, change);
      if (timerPlans.length || item.system.timers?.durationId || item.system.timers?.cooldownId)
        for (const kind of ["durationId", "cooldownId"]) previous[`system.timers.${kind}`] = item.system.timers?.[kind] ?? "";
      if (item.system.kind === "form") await endOtherForms(actor, change, { itemId: item.id });
      const staysActive = timed || hasBonuses || item.system.kind === "form";
      const updates = {
        "system.effectsActive": staysActive,
        "system.uses.spent": item.system.uses.spent + (record.uses.tracked ? 1 : 0),
        "system.cooldown.remaining": item.system.cooldown.rounds ?? 0
      };
      for (const key of Object.keys(previous).filter(key => key.startsWith("system.timers.")))
        updates[key] = timerIds[key.split(".").at(-1)];
      // Native updates can return undefined when there is no diff. A simple ability
      // without bonuses or trackers still posts and pays its configured costs.
      if (Object.keys(updates).some(key => updates[key] !== previous[key]))
        await change(
          () => item.update(updates, { ...updateOptions, worldsBeyondFormLoadout: true }),
          () => item.update(previous, { ...updateOptions, worldsBeyondFormLoadout: true })
        );
      if (item.system.kind === "form") await syncFormLoadout(actor, change);
      const description = String(item.system.description ?? "").trim();
      const details = description
        ? `<details class="wb-disclosure"><summary>Details</summary><p>${escapeHTML(description).replace(/\r\n?|\n/g, "<br>")}</p></details>`
        : "";
      const message = await createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content: `<div class="worlds-beyond wb-ability-card"><h3>${escapeHTML(item.name)}</h3><p>Used${ap ? ` · ${wholeNumber(ap)} AP spent` : ""}${reaction ? " · 1 reaction spent" : ""}.${timed ? ` Duration: ${escapeHTML(bonusDurationText(item.system.activeDuration))}.` : hasBonuses ? " Bonuses enabled until ended." : ""}</p>${restoration ? `<p>Restored ${wholeNumber(restoration.restored)} ${escapeHTML(restoration.label)}.</p>` : ""}${rollHTML}${details}</div>`,
          flags: { [SYSTEM_ID]: { sheetActivity: { actorUuid: actor.uuid, label: `Used ${item.name}` } } },
          rolls: roll ? [roll] : []
        },
        { messageMode }
      );
      try {
        await cleanupAbilityClocks(item);
      } catch {
        ui.notifications.warn("Ability used; old internal timers could not be removed. Its current timers still apply.");
      }
      return message;
    })
  );
}
