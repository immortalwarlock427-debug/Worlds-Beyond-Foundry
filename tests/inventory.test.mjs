import { test } from "node:test";
import assert from "node:assert/strict";
import { inventory, carriedSlots, defaultSlots, blockDice } from "../module/equipment-core.mjs";

const item = (id, type, system = {}) => ({ id, type, system: { quantity: 1, slots: defaultSlots(type, system), perSlot: 1, equipped: false, ...system } });

test("capacity is 10 + STR modifier, a backpack adds 6 and the override replaces it", () => {
  assert.equal(inventory({ strengthMod: 3 }).capacity, 13);
  assert.equal(inventory({ strengthMod: -1 }).capacity, 9);
  assert.equal(inventory({ strengthMod: 3, backpack: true }).capacity, 19);
  assert.equal(inventory({ strengthMod: 3, capacityOverride: 0 }).capacity, 0);
  assert.equal(inventory({ strengthMod: 3, capacityOverride: null }).capacity, 13);
});

test("most items take 1 slot, shields and Two-handed weapons take 2", () => {
  assert.equal(defaultSlots("weapon", {}), 1);
  assert.equal(defaultSlots("weapon", { properties: { twoHanded: true } }), 2);
  assert.equal(defaultSlots("shield"), 2);
  assert.equal(defaultSlots("armor"), 1);
  assert.equal(defaultSlots("gear"), 1);
  const result = inventory({ items: [
    item("sword", "weapon"),
    item("greatsword", "weapon", { properties: { twoHanded: true } }),
    item("shield", "shield"),
    item("rope", "gear")
  ] });
  assert.equal(result.used, 6);
  assert.deepEqual(result.perItem, { sword: 1, greatsword: 2, shield: 2, rope: 1 });
});

test("ammunition and potions stack 5 to a slot", () => {
  assert.equal(carriedSlots(item("arrows", "gear", { quantity: 20, perSlot: 5 })), 4);
  assert.equal(carriedSlots(item("arrows", "gear", { quantity: 21, perSlot: 5 })), 5);
  assert.equal(carriedSlots(item("potion", "gear", { quantity: 1, perSlot: 5 })), 1);
  assert.equal(carriedSlots(item("none", "gear", { quantity: 0 })), 0);
});

test("worn armor and weapons or shields in hand take no slots; extra copies on the record do", () => {
  assert.equal(carriedSlots(item("plate", "armor", { equipped: true })), 0);
  assert.equal(carriedSlots(item("shield", "shield", { equipped: true })), 0);
  assert.equal(carriedSlots(item("daggers", "weapon", { equipped: true, quantity: 3 })), 2);
  assert.equal(carriedSlots(item("spare", "armor", { equipped: false })), 1);
});

test("legacy gear without saved inventory fields counts as one slot each", () => {
  assert.equal(carriedSlots({ id: "old", type: "gear", system: {} }), 1);
  assert.equal(carriedSlots({ id: "old", type: "gear", system: { quantity: 3 } }), 3);
});

test("going over capacity is reported, never blocked", () => {
  const items = Array.from({ length: 12 }, (_, i) => item(`i${i}`, "gear"));
  const result = inventory({ items, strengthMod: 0 });
  assert.equal(result.used, 12);
  assert.equal(result.over, 2);
  assert.equal(result.free, -2);
});

test("Block dice gain a die every 5 levels and the largest equipped shield sets the size", () => {
  assert.equal(blockDice({ level: 1 }).formula, "1d4");
  assert.equal(blockDice({ level: 4 }).formula, "1d4");
  assert.equal(blockDice({ level: 5 }).formula, "2d4");
  assert.equal(blockDice({ level: 20 }).formula, "5d4");
  assert.equal(blockDice({ level: 1 }).nextLevel, 5);
  assert.equal(blockDice({ level: 7 }).nextLevel, 10);
  const plate = item("plate", "shield", { equipped: true, blockDie: "1d10" });
  const wood = item("wood", "shield", { equipped: true, blockDie: "d6" });
  const stowed = item("big", "shield", { equipped: false, blockDie: "1d12" });
  assert.equal(blockDice({ level: 5, items: [wood, plate, stowed] }).formula, "2d10");
  assert.equal(blockDice({ level: 5, items: [wood] }).fromShield, true);
  assert.equal(blockDice({ level: 1, items: [stowed] }).fromShield, false);
});
