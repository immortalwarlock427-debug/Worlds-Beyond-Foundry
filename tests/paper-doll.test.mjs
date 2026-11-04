import { test } from "node:test";
import assert from "node:assert/strict";
import { DOLL_SLOTS, handAssignment, slotItems, slotChoices, slotPlan, freeEquipmentChange } from "../module/paper-doll.mjs";
import { stowedConflicts, wornGear } from "../module/loadout.mjs";
import { carriedSlots } from "../module/equipment-core.mjs";
import { paperDollContext } from "../module/character-context.mjs";

const weapon = (id, properties = {}, equipped = false, signature = {}) => ({
  id,
  name: id,
  type: "weapon",
  system: { equipped, properties, signature, damage: "1d6" }
});
const shield = (id, equipped = false) => ({ id, name: id, type: "shield", system: { equipped, blockDie: "1d8", armorRating: 1 } });
const armor = (id, piece, equipped = false) => ({ id, name: id, type: "armor", system: { equipped, piece, armorType: "light", armorRating: 1 } });
const accessory = (id, slot, equipped = false) => ({ id, name: id, type: "accessory", system: { equipped, slot }, effects: [] });

test("the doll has every website body slot plus Strapped, five per side", () => {
  assert.deepEqual(
    DOLL_SLOTS.map(slot => slot.key),
    ["helmet", "amulet", "arms", "strapped", "chest", "belt", "ringRight", "ringLeft", "pants", "legs"]
  );
  assert.equal(DOLL_SLOTS.filter(slot => slot.side === "left").length, 5);
});

test("hands: two-handed covers the off hand, weapons fill the main hand and shields prefer the off hand", () => {
  const great = weapon("great", { twoHanded: true }, true);
  assert.deepEqual(handAssignment([great]), { main: great, off: null, twoHanded: true, extra: [] });
  const sword = weapon("sword", {}, true),
    buckler = shield("buckler", true),
    crossbow = weapon("crossbow", { strapped: true }, true);
  const hands = handAssignment([buckler, crossbow, sword]);
  assert.equal(hands.main, sword);
  assert.equal(hands.off, buckler);
  assert.deepEqual(hands.extra, []);
  assert.equal(handAssignment([buckler]).off, buckler);
  assert.equal(handAssignment([buckler]).main, null);
});

test("rings fill right then left, and Strapped lists every forearm weapon without using a hand", () => {
  const items = [accessory("a", "ring", true), accessory("b", "ring", true), weapon("x", { strapped: true }, true), weapon("y", { strapped: true }, true)];
  assert.deepEqual(slotItems(items, "ringRight").map(item => item.id), ["a"]);
  assert.deepEqual(slotItems(items, "ringLeft").map(item => item.id), ["b"]);
  assert.deepEqual(slotItems(items, "strapped").map(item => item.id), ["x", "y"]);
  assert.deepEqual(slotItems(items, "main"), []);
});

test("choices only offer gear that fits and isn't already shown in another slot", () => {
  const items = [
    accessory("worn", "ring", true),
    accessory("spare", "ring"),
    accessory("charm", "amulet"),
    weapon("great", { twoHanded: true }),
    weapon("dagger", { light: true }),
    weapon("wrist", { strapped: true }),
    shield("kite"),
    armor("helm", "helmet")
  ];
  assert.deepEqual(slotChoices(items, "ringLeft").map(item => item.id), ["spare"]);
  assert.deepEqual(slotChoices(items, "ringRight").map(item => item.id), ["worn", "spare"]);
  assert.deepEqual(slotChoices(items, "main").map(item => item.id), ["great", "dagger"]);
  assert.deepEqual(slotChoices(items, "off").map(item => item.id), ["dagger", "kite"]);
  assert.deepEqual(slotChoices(items, "strapped").map(item => item.id), ["wrist"]);
  assert.deepEqual(slotChoices(items, "helmet").map(item => item.id), ["helm"]);
});

test("a slot choice swaps only that slot's item; empty stows it; Strapped takes the full list", () => {
  const items = [
    weapon("sword", {}, true),
    shield("buckler", true),
    weapon("axe"),
    weapon("wrist", { strapped: true }, true),
    weapon("spring", { strapped: true })
  ];
  assert.deepEqual(slotPlan(items, "main", "axe"), { sword: false, axe: true });
  assert.deepEqual(slotPlan(items, "off", ""), { buckler: false });
  assert.deepEqual(slotPlan(items, "main", "sword"), {});
  assert.deepEqual(slotPlan(items, "main", "not-mine"), { sword: false });
  assert.deepEqual(slotPlan(items, "strapped", ["spring"]), { wrist: false, spring: true });
  assert.deepEqual(slotPlan(items, "strapped", []), { wrist: false });
});

test("Quickdraw keeps a swap free only when the drawn weapon is Quickdraw", () => {
  const items = [weapon("quick", {}, false, { quickdraw: true }), weapon("slow", {}, true), weapon("quickOut", {}, true, { quickdraw: true })];
  assert.equal(freeEquipmentChange(items, { slow: false, quick: true }), true);
  assert.equal(freeEquipmentChange(items, { quick: false, slow: true }), false);
  assert.equal(freeEquipmentChange(items, { quickOut: false }), true);
  assert.equal(freeEquipmentChange(items, { slow: false }), false);
});

test("accessory slots hold one amulet, one belt and two rings; worn accessories take no inventory slots", () => {
  const items = [
    accessory("r1", "ring", true),
    accessory("r2", "ring", true),
    accessory("r3", "ring", true),
    accessory("a1", "amulet", true),
    accessory("a2", "amulet", true),
    accessory("belt", "belt", true)
  ];
  assert.deepEqual(stowedConflicts(items, ["r3", "a2"]), ["r2", "a1"]);
  assert.equal(wornGear(items[0]), true);
  assert.equal(carriedSlots(items[0]), 0);
  assert.equal(carriedSlots({ ...items[0], system: { ...items[0].system, equipped: false } }), 1);
});

test("doll context marks worn parts, covers the off hand and summarizes Armor Rating", () => {
  const items = [armor("helm", "helmet", true), weapon("great", { twoHanded: true }, true), accessory("belt", "belt", true)];
  const doll = paperDollContext(items, { core: { armorRating: 4 } }, { type: "light", armorAR: 1, evasion: 1 });
  assert.equal(doll.worn.helmet, true);
  assert.equal(doll.worn.belt, true);
  assert.equal(doll.worn.chest, false);
  assert.equal(doll.slots.find(slot => slot.key === "helmet").detail, "AR 1 · Light");
  const [main, off] = doll.hands;
  assert.equal(main.name, "great");
  assert.equal(main.canAttack, true);
  assert.equal(off.covered, true);
  assert.equal(off.coverText, "Both hands: great");
  assert.equal(doll.armorRating, 4);
  assert.equal(doll.armorParts, "Armor 1 · VIT and bonuses +3");
  assert.deepEqual(doll.armorNotes, ["Light armor", "+1 Natural Evasion"]);
});
