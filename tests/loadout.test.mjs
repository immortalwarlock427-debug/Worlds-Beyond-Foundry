import { test } from "node:test";
import assert from "node:assert/strict";
import { loadoutError, stowedConflicts, requireWeaponReady } from "../module/loadout.mjs";
import { normalizeHandUpdates, registerEquipmentItem } from "../module/equipment-item.mjs";

const weapon = (id, properties = {}, equipped = true) => ({ id, name: id, type: "weapon", system: { equipped, properties } });
const shield = id => ({ id, name: id, type: "shield", system: { equipped: true } });
const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const set = (object, path, value) => { const keys = path.split("."); const last = keys.pop(); keys.reduce((o, key) => o[key] ??= {}, object)[last] = value; };
function utils() {
  const merge = (a, b) => { const out = structuredClone(a); for (const [key, value] of Object.entries(b)) out[key] = value && typeof value === "object" && !Array.isArray(value) ? merge(out[key] ?? {}, value) : value; return out; };
  globalThis.foundry = { utils: { hasProperty: (o, p) => get(o, p) !== undefined, getProperty: get, setProperty: set, mergeObject: merge } };
}

test("one weapon plus shield, two Light weapons, and no-hand Strapped combinations follow the hand rules", () => {
  const ordinary = weapon("sword"), light = weapon("dagger", { light: true }), strap = weapon("crossbow", { strapped: true });
  for (const items of [[ordinary], [ordinary, shield("shield")], [light, shield("shield")], [light, weapon("axe", { light: true })], [ordinary, shield("shield"), strap], [weapon("greatsword", { twoHanded: true }), strap]]) assert.equal(loadoutError(items), null);
  for (const items of [[ordinary, light], [ordinary, weapon("rapier")], [light, weapon("axe", { light: true }), shield("shield")], [weapon("greatsword", { twoHanded: true }), shield("shield")], [light, weapon("axe", { light: true }), weapon("hammer", { light: true })]]) assert.ok(loadoutError(items));
});

test("equipping preserves the selected item and compatible gear while stowing only conflicts", () => {
  const items = [weapon("sword"), shield("shield"), weapon("crossbow", { strapped: true }), weapon("greatsword", { twoHanded: true })];
  const before = structuredClone(items);
  assert.deepEqual(stowedConflicts(items, ["greatsword"]), ["sword", "shield"]);
  assert.deepEqual(stowedConflicts(items, ["sword"]), ["greatsword"]);
  const light = [weapon("one", { light: true }), weapon("two", { light: true }), weapon("three", { light: true })];
  assert.deepEqual(stowedConflicts(light, ["three"]), ["two"]);
  assert.deepEqual(items, before);
});

test("Versatile two-hand use and stale/stowed weapons are checked before attack spending", () => {
  const sword = weapon("sword", { versatile: true }); const items = new Map([[sword.id, sword], ["shield", shield("shield")]]);
  assert.doesNotThrow(() => requireWeaponReady({ items }, sword));
  assert.throws(() => requireWeaponReady({ items }, sword, "two"), /Both hands/);
  items.delete("shield"); assert.doesNotThrow(() => requireWeaponReady({ items }, sword, "two"));
  sword.system.equipped = false; assert.throws(() => requireWeaponReady({ items }, sword), /no longer equipped/);
  sword.system.equipped = true; items.delete(sword.id); assert.throws(() => requireWeaponReady({ items }, sword), /no longer equipped/);
});

test("batch preflight covers embedded item-sheet edits and property changes without changing armor or other data", () => {
  utils();
  const items = [weapon("sword"), shield("shield"), weapon("great", { twoHanded: true }, false), { id: "armor", type: "armor", system: { equipped: true } }];
  const actor = { items: new Map(items.map(i => [i.id, i])) };
  const before = structuredClone(items);
  const updates = [{ _id: "great", system: { equipped: true, damage: "2d6" } }];
  assert.deepEqual(normalizeHandUpdates(actor, updates), ["sword", "shield"]);
  assert.equal(updates[0].system.damage, "2d6"); assert.equal(updates[0].system.equipped, true);
  assert.equal(updates.find(u => u._id === "shield").system.equipped, false);
  assert.deepEqual(items, before);
  const unchanged = [{ _id: "sword", system: { quantity: 4 } }];
  assert.deepEqual(normalizeHandUpdates(actor, unchanged), []); assert.equal(unchanged.length, 1);
  actor.items = new Map([weapon("one", { light: true }), weapon("two", { light: true })].map(i => [i.id, i]));
  const change = [{ _id: "two", system: { properties: { light: false } } }];
  assert.deepEqual(normalizeHandUpdates(actor, change), ["one"]);
  actor.items.get("one").system.properties.light = false;
  const fullForm = [{ _id: "two", system: { equipped: true, properties: { light: true }, quantity: 2 } }];
  assert.deepEqual(normalizeHandUpdates(actor, fullForm), []);
});

test("Item operation registration respects cancellation, runs batch normalization and creates carried copies stowed", async () => {
  utils(); let cancel = false;
  class Base { static async _preUpdateOperation() { if (cancel) return false; } static async _preCreateOperation() {} static async _onUpdateOperation() {} }
  globalThis.CONFIG = { Item: { documentClass: Base } }; registerEquipmentItem(); const Item = CONFIG.Item.documentClass;
  const actor = { type: "character", items: new Map([weapon("sword"), weapon("mace", {}, false)].map(i => [i.id, i])) };
  const operation = { parent: actor, updates: [{ _id: "mace", system: { equipped: true } }] };
  cancel = true; assert.equal(await Item._preUpdateOperation([], operation, {}), false); assert.equal(operation.updates.length, 1);
  cancel = false; await Item._preUpdateOperation([], operation, {}); assert.equal(operation.updates.length, 2);
  let source; await Item._preCreateOperation([{ type: "weapon", system: { equipped: true }, updateSource: data => { source = data; } }], { parent: actor }, {});
  assert.deepEqual(source, { "system.equipped": false });
  source = null; await Item._preCreateOperation([{ type: "weapon", system: { equipped: true }, updateSource: data => { source = data; } }], {}, {}); assert.equal(source, null);
});
