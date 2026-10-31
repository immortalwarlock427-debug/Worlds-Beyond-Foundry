import { test } from "node:test";
import assert from "node:assert/strict";

class Field { constructor(options) { this.options = options; } }
class StringField extends Field {}
class NumberField extends Field {}
class BooleanField extends Field {}
class SchemaField { constructor(fields) { this.fields = fields; } }
globalThis.foundry = {
  data: { fields: { StringField, NumberField, BooleanField, SchemaField } },
  abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class { async _prepareContext() { return {}; } } } }
};
const { equipmentRows, createEquipment, toggleEquipment, WeaponData, ArmorData, ShieldData, WEAPON_PROPERTIES, SIGNATURE_PROPERTIES, EquipmentSheet } = await import("../module/equipment.mjs");

test("equipment summaries support all new types and preserve legacy gear", () => {
  const rows = equipmentRows([
    { id: "a", name: "Sword", type: "weapon", system: { damage: "1d8", damageType: "Slashing", family: "balanced", properties: { versatile: true, reach: false }, signature: { quickdraw: true }, range: { normal: 20, long: 40 }, loading: 0, quantity: 0 } },
    { id: "b", name: "Guards", type: "armor", system: { armorType: "heavy", piece: "legs", armorRating: 1, evasionBonus: 0, equipped: true } },
    { id: "c", name: "Plate", type: "shield", system: { armorRating: 1, blockDie: "1d10" } },
    { id: "d", name: "Old gear", type: "gear", system: {} }
  ]);
  assert.equal(rows[0].quantity, 0);
  assert.equal(rows[0].detail, "1d8 · Slashing · Balanced · Versatile · Quickdraw · Range 20/40 ft");
  assert.match(rows[1].detail, /Leg guards \(pair\)/);
  assert.equal(rows[1].equipped, true);
  assert.equal(rows[2].detail, "AR 1 · Block 1d10");
  assert.equal(rows[3].canEquip, false);
  assert.equal(rows[3].quantity, 1);
});

test("creation embeds an item on the correct actor and opens its sheet", async () => {
  const calls = [];
  const item = { sheet: { render: options => calls.push(options) } };
  const actor = { isOwner: true, async createEmbeddedDocuments(type, data) { calls.push({ type, data }); return [item]; } };
  assert.equal(await createEquipment(actor, "weapon"), item);
  assert.deepEqual(calls, [{ type: "Item", data: [{ name: "New weapon", type: "weapon" }] }, { force: true }]);
  await createEquipment(actor, "constructor");
  actor.isOwner = false;
  await createEquipment(actor, "armor");
  assert.equal(calls.length, 2);
});

test("equip changes only the chosen owned item's flag without changing stats or imposing slot limits", async () => {
  const updates = [];
  const item = { type: "armor", system: { equipped: false }, update: data => updates.push(data) };
  const actor = { isOwner: true, items: new Map([["a", item]]) };
  await toggleEquipment(actor, "a");
  item.system.equipped = true;
  await toggleEquipment(actor, "a");
  assert.deepEqual(updates, [{ "system.equipped": true }, { "system.equipped": false }]);
  await toggleEquipment(actor, "missing");
  actor.isOwner = false;
  await toggleEquipment(actor, "a");
  assert.equal(updates.length, 2);
});


test("each equipment model exposes only its common and type-specific fields", () => {
  const weapon = WeaponData.defineSchema();
  const armor = ArmorData.defineSchema();
  const shield = ShieldData.defineSchema();
  for (const schema of [weapon, armor, shield]) {
    for (const key of ["description", "quantity", "slots", "cost", "equipped"]) assert.ok(key in schema);
  }
  for (const key of ["armorRating", "armorType", "piece", "evasionBonus", "blockDie"]) assert.equal(key in weapon, false);
  for (const key of ["family", "damage", "range", "loading", "properties", "signature", "blockDie"]) assert.equal(key in armor, false);
  for (const key of ["family", "damage", "range", "loading", "properties", "signature", "piece", "armorType", "evasionBonus"]) assert.equal(key in shield, false);
  assert.equal(weapon.family.options.initial, "balanced");
  assert.deepEqual(Object.keys(weapon.family.options.choices), ["balanced", "heavy", "finesse", "paragon"]);
  assert.deepEqual(Object.keys(weapon.range.fields), ["normal", "long"]);
  assert.equal(weapon.range.fields.normal.options.initial, 0);
  assert.ok(weapon.range.fields.normal instanceof NumberField);
  assert.ok(weapon.range.fields.long instanceof NumberField);
  assert.ok(weapon.loading instanceof NumberField);
  assert.equal(weapon.range.fields.long.options.initial, 0);
  assert.equal(weapon.loading.options.initial, 0);
});

test("Notion property and signature keys are boolean flags, separate from family and numeric loading/range", () => {
  const schema = WeaponData.defineSchema();
  assert.deepEqual(Object.keys(WEAPON_PROPERTIES), ["light", "twoHanded", "versatile", "strapped", "reach", "mount", "thrown"]);
  assert.deepEqual(Object.keys(SIGNATURE_PROPERTIES), ["sweep", "hook", "stagger", "disarm", "entangle", "puncture", "sunder", "bleed", "pierceThrough", "bulwark", "quickdraw", "concealed", "silent", "loud"]);
  for (const field of [...Object.values(schema.properties.fields), ...Object.values(schema.signature.fields)]) {
    assert.ok(field instanceof BooleanField);
    assert.equal(field.options.initial, false);
    assert.equal(field.options.nullable, false);
  }
});

test("weapon sheet choices preserve the family and checked/unchecked property state", async () => {
  const sheet = new EquipmentSheet();
  sheet.isEditable = true;
  for (const family of ["balanced", "heavy", "finesse", "paragon"]) {
    sheet.item = { type: "weapon", system: { family, properties: { light: true, twoHanded: false }, signature: { silent: true, loud: false } } };
    const context = await sheet._prepareContext({});
    assert.deepEqual(context.weaponFamilies.filter(choice => choice.selected).map(choice => choice.value), [family]);
    assert.equal(context.weaponProperties.find(choice => choice.key === "light").checked, true);
    assert.equal(context.weaponProperties.find(choice => choice.key === "twoHanded").checked, false);
    assert.equal(context.signatureProperties.find(choice => choice.key === "silent").checked, true);
    assert.equal(context.signatureProperties.find(choice => choice.key === "loud").checked, false);
  }
});
