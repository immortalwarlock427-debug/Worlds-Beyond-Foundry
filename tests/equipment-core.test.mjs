import { test } from "node:test";
import assert from "node:assert/strict";
import { wornEquipment } from "../module/equipment-core.mjs";
import { coreNumbers } from "../module/core-numbers.mjs";

const armor = (piece, armorType, armorRating, evasionBonus = 0) => ({ type: "armor", system: { equipped: true, piece, armorType, armorRating, evasionBonus } });
const shield = (armorRating = 1) => ({ type: "shield", system: { equipped: true, armorRating, blockDie: "1d10" } });

test("light, medium and heavy sets match Notion and heaviest piece controls evasion", () => {
  const light = [armor("chest", "light", 1), ...["arms", "pants", "legs"].map(piece => armor(piece, "light", 0, 1))];
  assert.equal(wornEquipment({ items: light }).armor, 1);
  assert.equal(wornEquipment({ items: light }).evasion, 3);
  const mixed = wornEquipment({ items: [...light, armor("helmet", "medium", 1)] });
  assert.equal(mixed.type, "medium");
  assert.equal(mixed.evasion, 0);
  const heavy = [armor("chest", "heavy", 2), ...["helmet", "arms", "pants", "legs"].map(piece => armor(piece, "heavy", 1))];
  const result = wornEquipment({ items: [...heavy, shield()], agility: 21, strength: 20 });
  assert.equal(result.armorAR, 6);
  assert.equal(result.armor, 7);
  assert.equal(result.agilityPenalty, 3);
  assert.equal(result.effectiveAgility, 18);
  assert.equal(result.heavyDisadvantage, true);
  assert.equal(result.squareCost, 10);
  assert.equal(result.difficultSquareCost, 20);
  assert.deepEqual(result.blockDice, ["1d10"]);
});

test("heavy penalties use armor pieces only, cap at three and honor STR 21 and manual zero", () => {
  for (const [ar, expected] of [[2, 0], [3, 0], [4, 1], [5, 2], [6, 3], [20, 3]]) {
    const result = wornEquipment({ items: [armor("chest", "heavy", ar), shield(10)], strength: 21 });
    assert.equal(result.agilityPenalty, expected);
    assert.equal(result.heavyDisadvantage, false);
  }
  assert.equal(wornEquipment({ items: [armor("chest", "heavy", 8)], penaltyOverride: 0 }).agilityPenalty, 0);
});

test("arm guard AR is counted once, quantity does not multiply worn armor, unequipped gear contributes nothing", () => {
  const first = armor("arms", "heavy", 1);
  const second = armor("arms", "heavy", 2);
  const legs = armor("legs", "heavy", 1);
  legs.system.quantity = 2;
  const removed = armor("chest", "heavy", 20);
  removed.system.equipped = false;
  const data = [first, second, legs, removed];
  const before = structuredClone(data);
  assert.equal(wornEquipment({ items: data }).armorAR, 3);
  assert.deepEqual(data, before);
  assert.equal(wornEquipment({ items: [shield()] }).type, "none");
});

test("effective AGL changes modifiers, milestones and movement without changing base stats", () => {
  const stats = { agl: { value: 21 }, vit: { value: 12 } };
  const worn = wornEquipment({ items: [armor("chest", "heavy", 6)], agility: stats.agl.value });
  const core = coreNumbers({ stats: { ...stats, agl: { value: worn.effectiveAgility } } });
  assert.equal(core.reactionsMax, 1);
  assert.equal(core.evasion, 14);
  assert.equal(core.movement, 15);
  assert.equal(stats.agl.value, 21);
  assert.equal(wornEquipment({ agility: 21 }).effectiveAgility, 21);
});
