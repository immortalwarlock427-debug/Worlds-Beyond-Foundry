// Loads the item model key lists without a running Foundry.
class Field { constructor(options) { this.options = options; } }
globalThis.foundry ??= {};
foundry.data ??= { fields: { StringField: Field, NumberField: Field, BooleanField: Field, SchemaField: class { constructor(fields) { this.fields = fields; } } } };
foundry.abstract ??= { TypeDataModel: class {} };
foundry.applications ??= { api: { DocumentSheetV2: class {}, HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } };
export const { SIGNATURE_PROPERTIES, WEAPON_PROPERTIES, WEAPON_FAMILIES } = await import("../module/equipment.mjs");
