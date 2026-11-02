import { EFFECT_SCOPE, effectFlags, managedEffect, formEffect, effectChanges, effectTargets, simpleEffectChange, newEffectChange, effectChangeText, effectSnapshot, effectFormUpdates, effectRows, customEffectResource, itemEffectState, boundItem } from "./effects-core.mjs";
import { queuedAction, reversibleAction } from "./action-support.mjs";
import { endOtherForms } from "./forms.mjs";
import { wholeNumber, bindWholeNumbers } from "./number-display.mjs";

const editors = new WeakMap();
const parentActor = effect => effect.parent?.documentName === "Actor" ? effect.parent : effect.parent?.actor ?? null;
const queueKey = effect => parentActor(effect)?.uuid ?? effect.parent.uuid;

export class EffectSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [EFFECT_SCOPE, "wb-sheet", "wb-item-sheet", "wb-effect-sheet"], position: { width: 520, height: 600 },
    window: { resizable: true }, form: { submitOnChange: true },
    actions: { addBonus: EffectSheet.#onAdd, removeBonus: EffectSheet.#onRemove, advancedEffect: EffectSheet.#onAdvanced }
  };
  static PARTS = { sheet: { template: `systems/${EFFECT_SCOPE}/templates/effect-sheet.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const effect = this.document, actor = parentActor(effect);
    this.snapshot = effectSnapshot(effect);
    return Object.assign(await super._prepareContext(options), {
      effect, editable: this.isEditable, form: formEffect(effect), itemBonus: !!boundItem(effect), source: effectFlags(effect).source || "",
      rows: effectChanges(effect).map((change, index) => ({ index, editable: simpleEffectChange(change),
        choices: effectTargets(actor?.system, change.key), value: wholeNumber(Number(change.value)), text: effectChangeText(change, actor?.system) }))
    });
  }

  _processFormData(event, form, formData) {
    return effectFormUpdates(this.document, super._processFormData(event, form, formData));
  }

  async _processSubmitData(event, form, data, options = {}) {
    const snapshot = this.snapshot;
    return queuedAction(queueKey(this.document), async () => {
      this.#check(snapshot);
      const result = await super._processSubmitData(event, form, data, options);
      if (!result?.updated) throw new Error("The effect update was cancelled.");
      return result;
    });
  }

  #check(snapshot) {
    const parent = this.document.parent;
    if (!this.isEditable || !parent?.isOwner || parent.effects.get(this.document.id) !== this.document) throw new Error("You need permission to edit this effect.");
    if (effectSnapshot(this.document) !== snapshot) throw new Error("This effect changed in another window. Reopen it before editing.");
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.isEditable) bindWholeNumbers(this.element);
  }

  static async #onAdd() { return this.#changeRows(null); }
  static async #onRemove(event, target) { return this.#changeRows(Number(target.dataset.index)); }
  async #changeRows(index) {
    const snapshot = this.snapshot;
    try {
      await queuedAction(queueKey(this.document), async () => {
        this.#check(snapshot);
        const changes = effectChanges(this.document).map(change => ({ ...change }));
        if (index === null) changes.push(newEffectChange());
        else if (Number.isInteger(index) && changes[index]) changes.splice(index, 1);
        else throw new Error("That bonus no longer exists. Reopen the effect.");
        if (!await this.document.update({ "system.changes": changes })) throw new Error("The bonus update was cancelled.");
      });
    } catch (error) { ui.notifications.error(error.message); }
  }
  static async #onAdvanced() { return this.document.sheet.render({ force: true }); }
}

export function openEffect(effect) {
  if (!managedEffect(effect) || !["Actor", "Item"].includes(effect.parent?.documentName)) return effect.sheet.render({ force: true });
  let sheet = editors.get(effect);
  if (!sheet) { sheet = new EffectSheet({ document: effect }); editors.set(effect, sheet); }
  return sheet.render({ force: true });
}

export async function createEffect(item) {
  if (item.documentName !== "Item") throw new Error("Create an ability and add its bonuses on the ability sheet.");
  if (!item.isOwner || !["weapon", "armor", "shield", "ability"].includes(item.type)) return;
  return queuedAction(item.actor?.uuid ?? item.uuid, async () => {
    const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [{
      name: `${item.name} bonus`, img: "icons/svg/aura.svg",
      disabled: false, transfer: true, system: { changes: [newEffectChange()] },
      flags: { [EFFECT_SCOPE]: { managed: true, kind: "effect", source: item.name, itemBound: true } }
    }]);
    if (!effect) throw new Error("The bonus was not created. Try again.");
    await openEffect(effect); return effect;
  });
}

export async function toggleEffect(actor, uuid, { active } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    if (uuid === "base") {
      await endOtherForms(actor, change);
      return;
    }
    const effect = effectRows(actor).find(row => row.uuid === uuid)?.effect;
    if (!effect) throw new Error("That effect no longer exists. Reopen the sheet.");
    const disabled = active === undefined ? !effect.disabled : !active;
    if (disabled === effect.disabled) return;
    if (!disabled && effect.parent === actor && formEffect(effect)) await endOtherForms(actor, change, { effectId: effect.id });
    const previous = effect.disabled;
    await change(() => effect.update({ disabled }), () => effect.update({ disabled: previous }));
  }));
}

export function registerEffectSupport() {
  const Base = CONFIG.ActiveEffect.documentClass;
  CONFIG.ActiveEffect.documentClass = class WorldsBeyondEffect extends Base {
    get isSuppressed() { return super.isSuppressed || !!itemEffectState(this); }
    shouldApplyChange(change, options) {
      if (!super.shouldApplyChange(change, options)) return false;
      const id = customEffectResource(change.key);
      // A removed custom pool must not be recreated as incomplete prepared data.
      if (managedEffect(this) && id) return !!this.target?.system?.customResources?.[id];
      return true;
    }
  };
}

// Shared actions for the native equipment and ability Item sheets.
export async function itemEffectAction(item, target, editable) {
  const operation = target.dataset.operation;
  if (operation !== "edit" && (!editable || !item.isOwner)) return;
  if (operation === "create") return createEffect(item);
  const id = target.closest("[data-item-effect-id]")?.dataset.itemEffectId;
  const effect = item.effects.get(id);
  if (!effect) throw new Error("That bonus no longer exists. Reopen the item.");
  if (operation === "edit") return openEffect(effect);
  if (operation === "toggle") {
    const result = await effect.update({ disabled: !effect.disabled });
    if (!result) throw new Error("The bonus toggle was cancelled.");
    return result;
  }
  if (operation === "delete" && await foundry.applications.api.DialogV2.confirm({ window: { title: "Remove bonus" }, content: "<p>Remove this bonus from the item?</p>", rejectClose: false })) return effect.delete();
}
