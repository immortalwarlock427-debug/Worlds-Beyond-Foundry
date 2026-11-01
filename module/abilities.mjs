import { ABILITY_TYPES, ABILITY_STATS, ABILITY_COST_UNITS, ABILITY_ICON, abilityRecord, abilityResources, abilityFormUpdates } from "./abilities-core.mjs";
import { wholeDisplay, wholeFormUpdates, bindWholeNumbers } from "./number-display.mjs";

const SYSTEM_ID = "worlds-beyond";

export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, NumberField, SchemaField } = foundry.data.fields;
    const text = (initial = "", options = {}) => new StringField({ required: true, nullable: false, blank: true, initial, ...options });
    const number = (initial = null, options = {}) => new NumberField({ required: true, nullable: initial === null, initial, ...options });
    return {
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
    window: { resizable: true }, form: { submitOnChange: true }
  };
  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/ability-sheet.hbs`, scrollable: [""] } };

  async _prepareContext(options) {
    const system = this.item.system, character = this.item.actor?.system;
    const choices = (definitions, selected) => Object.entries(definitions).map(([value, label]) => ({ value, label, selected: value === selected }));
    return Object.assign(await super._prepareContext(options), {
      item: this.item, system: wholeDisplay({ ...system }), editable: this.isEditable,
      record: wholeDisplay(abilityRecord(this.item, character)),
      kinds: choices(ABILITY_TYPES, system.kind), stats: choices(ABILITY_STATS, system.apDiscountStat),
      units: choices(ABILITY_COST_UNITS, system.resourceUnit), resources: abilityResources(character, system.resourceId),
      hasActor: !!character
    });
  }

  _processFormData(event, form, formData) {
    const data = wholeFormUpdates(super._processFormData(event, form, formData), form, { system: this.item.system });
    return abilityFormUpdates(this.item.system, data);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.isEditable) bindWholeNumbers(this.element);
  }
}

export async function createAbility(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name: "New ability", type: "ability", img: ABILITY_ICON }]);
  if (!item) throw new Error("The ability was not created. Try again.");
  await item.sheet.render({ force: true });
  return item;
}
