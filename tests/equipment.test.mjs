import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  applications: { api: { HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } }
};
const { equipmentRows, createEquipment, toggleEquipment } = await import("../module/equipment.mjs");

test("equipment summaries support all new types and preserve legacy gear", () => {
  const rows = equipmentRows([
    { id: "a", name: "Sword", type: "weapon", system: { damage: "1d8", damageType: "Slashing", properties: "Versatile", quantity: 0 } },
    { id: "b", name: "Guards", type: "armor", system: { armorType: "heavy", piece: "legs", armorRating: 1, evasionBonus: 0, equipped: true } },
    { id: "c", name: "Plate", type: "shield", system: { armorRating: 1, blockDie: "1d10" } },
    { id: "d", name: "Old gear", type: "gear", system: {} }
  ]);
  assert.equal(rows[0].quantity, 0);
  assert.equal(rows[0].detail, "1d8 · Slashing · Versatile");
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
