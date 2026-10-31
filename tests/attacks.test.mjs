import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attackStatChoices, attackModes, attackApCost, attackDisadvantages, critThreshold,
  attackOutcome, damageMultiplier, scaleDice, damagePlan, effectiveArmor
} from "../module/attacks.mjs";
import { catalogItems } from "../module/catalog.mjs";

const catalog = catalogItems();
const w = name => catalog.find(item => item.name === name);

test("attack stats follow each weapon family and attack mode", () => {
  assert.deepEqual(attackStatChoices(w("Longsword")), ["str", "dex"]);
  assert.deepEqual(attackStatChoices(w("Greatsword")), ["str"]);
  assert.deepEqual(attackStatChoices(w("Rapier")), ["dex"]);
  assert.deepEqual(attackStatChoices(w("Odachi")), ["str", "dex"]);
  assert.deepEqual(attackStatChoices(w("Warbow"), "ranged"), ["str", "dex"]);
  assert.deepEqual(attackStatChoices(w("Longbow"), "ranged"), ["dex"]);
  assert.deepEqual(attackStatChoices(w("Handaxe"), "thrown"), ["dex"]);
  assert.deepEqual(attackModes(w("Handaxe")), ["melee", "thrown"]);
  assert.deepEqual(attackModes(w("Chakram")), ["melee", "thrown"]);
  assert.deepEqual(attackModes(w("Dart")), ["ranged"]);
  assert.deepEqual(attackModes(w("Greatsword")), ["melee"]);
});

test("attacks cost 10 AP minus the attack modifier, never below 5", () => {
  assert.equal(attackApCost(3), 7);
  assert.equal(attackApCost(0), 10);
  assert.equal(attackApCost(8), 5);
  assert.equal(attackApCost(-1), 11);
});

test("automatic disadvantage reasons match Notion", () => {
  const low = { str: 20, dex: 20 }, high = { str: 21, dex: 21 };
  assert.equal(attackDisadvantages({ weapon: w("Greatsword"), scores: low }).length, 1);
  assert.equal(attackDisadvantages({ weapon: w("Greatsword"), scores: high }).length, 0);
  assert.equal(attackDisadvantages({ weapon: w("Rapier"), scores: { dex: 20 } }).length, 1);
  assert.equal(attackDisadvantages({ weapon: w("Odachi"), scores: { str: 28, dex: 20 } }).length, 1);
  assert.equal(attackDisadvantages({ weapon: w("Longbow"), scores: low }).length, 0);
  assert.equal(attackDisadvantages({ weapon: w("Longbow"), mode: "ranged", longRange: true }).length, 1);
  assert.equal(attackDisadvantages({ weapon: w("Longsword"), mode: "melee", longRange: true }).length, 0);
  assert.equal(attackDisadvantages({ weapon: w("Lance"), scores: high }).length, 1);
  assert.equal(attackDisadvantages({ weapon: w("Lance"), scores: high, mounted: true }).length, 0);
  assert.equal(attackDisadvantages({ weapon: w("Longsword"), heavyArmor: true }).length, 1);
});

test("natural 20 always hits and crits; Finesse and Paragon crit on 18–19 only when they hit", () => {
  assert.equal(critThreshold(w("Rapier")), 18);
  assert.equal(critThreshold(w("Arbalest")), 18);
  assert.equal(critThreshold(w("Longsword")), 20);
  assert.deepEqual(attackOutcome({ natural: 20, total: 5, evasion: 30, threshold: 20 }), { hit: true, critical: true });
  assert.deepEqual(attackOutcome({ natural: 18, total: 22, evasion: 14, threshold: 18 }), { hit: true, critical: true });
  assert.deepEqual(attackOutcome({ natural: 19, total: 15, evasion: 16, threshold: 18 }), { hit: false, critical: false });
  assert.deepEqual(attackOutcome({ natural: 19, total: 25, evasion: 14, threshold: 20 }), { hit: true, critical: false });
  assert.deepEqual(attackOutcome({ natural: 14, total: 14, evasion: 14 }), { hit: true, critical: false });
  assert.deepEqual(attackOutcome({ natural: 18, total: 20, threshold: 18 }), { hit: null, critical: "if it hits" });
});

test("damage dice repeat at 5/10/15/20 like Notion's scaling table", () => {
  assert.deepEqual([1, 4, 5, 9, 10, 15, 20].map(damageMultiplier), [1, 1, 2, 2, 3, 4, 5]);
  assert.equal(scaleDice("1d8", 5).formula, "5d8");
  assert.equal(scaleDice("2d6", 4).formula, "8d6");
  assert.equal(scaleDice("3d12", 3).formula, "9d12");
  assert.deepEqual(scaleDice("2d10", 1), { formula: "2d10", maximum: 20, valid: true });
  assert.equal(scaleDice("1", 2).formula, "2");
  assert.equal(scaleDice("banana").valid, false);
});

test("damage modifiers: single for most weapons, double for Heavy and Paragon, versatile uses the bracket", () => {
  assert.equal(damagePlan({ weapon: w("Longsword"), level: 5, modifier: 3 }).formula, "2d8 + 3");
  assert.equal(damagePlan({ weapon: w("Longsword"), level: 1, modifier: 3, grip: "two" }).formula, "1d10 + 3");
  assert.equal(damagePlan({ weapon: w("Longsword"), level: 1, modifier: 3, grip: "two" }).twoHanded, true);
  assert.equal(damagePlan({ weapon: w("Greatsword"), level: 1, modifier: 4 }).formula, "2d6 + 8");
  assert.equal(damagePlan({ weapon: w("Arbalest"), level: 10, modifier: 2 }).formula, "9d12 + 4");
  assert.equal(damagePlan({ weapon: w("Dagger"), level: 1, modifier: -1 }).formula, "1d4 - 1");
  assert.equal(damagePlan({ weapon: w("Net"), level: 1, modifier: 2 }).formula, "");
});

test("critical hits deal maximum damage plus a second roll (Notion: 2d10 + 6 crit = 26 + 2d10)", () => {
  const weapon = { system: { family: "balanced", damage: "2d10", properties: {}, signature: {} } };
  assert.equal(damagePlan({ weapon, level: 1, modifier: 6, critical: true }).formula, "2d10 + 20 + 6");
  assert.equal(damagePlan({ weapon: w("Greatsword"), level: 5, modifier: 3, critical: true }).formula, "4d6 + 24 + 6");
});

test("Mount adds 1 per 10 ft charged, up to the attack modifier, only while mounted", () => {
  assert.equal(damagePlan({ weapon: w("Lance"), modifier: 3, mounted: true, mountedFeet: 25 }).mountBonus, 2);
  assert.equal(damagePlan({ weapon: w("Lance"), modifier: 3, mounted: true, mountedFeet: 80 }).mountBonus, 3);
  assert.equal(damagePlan({ weapon: w("Lance"), modifier: 3, mounted: false, mountedFeet: 80 }).mountBonus, 0);
  assert.equal(damagePlan({ weapon: w("Lance"), modifier: 3, mounted: true, mountedFeet: 30 }).formula, "2d10 + 6");
});

test("Two-handed hits ignore half the target's Armor Rating; Puncture ignores 2 more", () => {
  assert.equal(effectiveArmor(7), 7);
  assert.equal(effectiveArmor(7, { twoHanded: true }), 4);
  assert.equal(effectiveArmor(7, { puncture: true }), 5);
  assert.equal(effectiveArmor(7, { twoHanded: true, puncture: true }), 2);
  assert.equal(effectiveArmor(1, { puncture: true }), 0);
  assert.equal(damagePlan({ weapon: w("Arbalest") }).notes.length, 1);
  assert.match(damagePlan({ weapon: w("Arbalest") }).notes[0], /halve/);
  assert.match(damagePlan({ weapon: w("Rapier") }).notes[0], /ignores 2/);
});
