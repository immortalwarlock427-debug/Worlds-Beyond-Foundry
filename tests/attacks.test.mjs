import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attackStatChoices,
  attackModes,
  attackApCost,
  attackDisadvantages,
  critThreshold,
  attackOutcome,
  damageMultiplier,
  scaleDice,
  damagePlan,
  gripDamage,
  effectiveArmor,
  actionApCost,
  dualWieldPartners,
  shotsLeft,
  finalDamage,
  hitDamage
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
  assert.deepEqual(attackStatChoices({ system: { family: "paragon", properties: { thrown: true } } }, "thrown"), ["dex"]);
  assert.deepEqual(attackStatChoices(w("Arbalest"), "ranged"), ["str", "dex"]);
  assert.deepEqual(attackModes(w("Handaxe")), ["melee", "thrown"]);
  assert.deepEqual(attackModes(w("Chakram")), ["melee", "thrown"]);
  assert.deepEqual(attackModes(w("Dart")), ["ranged"]);
  assert.deepEqual(attackModes(w("Greatsword")), ["melee"]);
});

test("modifiers move AP costs by at most half: attacks 5–15, spells 6–16, reloads 3–7", () => {
  assert.equal(attackApCost(3), 7);
  assert.equal(attackApCost(0), 10);
  assert.equal(attackApCost(8), 5);
  assert.equal(attackApCost(-1), 11);
  assert.equal(attackApCost(-5), 15);
  assert.equal(attackApCost(-9), 15);
  assert.equal(actionApCost(11, 4), 7);
  assert.equal(actionApCost(11, 9), 6);
  assert.equal(actionApCost(11, -9), 16);
  assert.equal(actionApCost(5, 3), 3);
  assert.equal(actionApCost(5, -3), 7);
  assert.equal(actionApCost(2, 1), 1);
});

test("automatic disadvantage reasons match Notion", () => {
  const low = { str: 20, dex: 20 },
    high = { str: 21, dex: 21 };
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
  const grip = damagePlan({ weapon: w("Longsword"), level: 1, modifier: 3, grip: "two" });
  assert.equal(grip.twoHanded, false);
  assert.doesNotMatch(grip.notes.join(" "), /ignores half/);
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
  assert.match(damagePlan({ weapon: w("Arbalest") }).notes[0], /half.*rounded up.*ignore 2/);
  assert.match(damagePlan({ weapon: w("Rapier") }).notes[0], /ignores 2/);
});

test("hit damage applies rounded-down Resistance before Armor Rating", () => {
  assert.equal(hitDamage({ damage: 16, armor: 6, resistant: true }).total, 2);
  assert.equal(hitDamage({ damage: 17, armor: 6, resistant: true }).afterResistance, 8);
  assert.equal(hitDamage({ damage: 17, armor: 6, resistant: true }).total, 2);
  assert.equal(hitDamage({ damage: 16, armor: 6 }).total, 10);
});

test("hit damage handles odd/even Two-handed armor and Puncture before subtracting armor", () => {
  for (const [armor, twoHanded, puncture, used] of [
    [7, false, false, 7],
    [7, true, false, 4],
    [8, true, false, 4],
    [7, false, true, 5],
    [7, true, true, 2],
    [1, true, true, 0]
  ]) {
    const hit = hitDamage({ damage: 16, resistant: true, armor, twoHanded, puncture });
    assert.equal(hit.armor, used);
    assert.equal(hit.total, Math.max(0, 8 - used));
  }
});

test("Block subtracts from the remainder after Resistance and Armor Rating, with a zero floor", () => {
  const hit = hitDamage({ damage: 16, resistant: true, armor: 6, block: 1 });
  assert.equal(hit.afterResistance, 8);
  assert.equal(hit.afterArmor, 2);
  assert.equal(hit.afterBlock, 1);
  assert.equal(hit.total, 1);
  assert.equal(hitDamage({ damage: 16, resistant: true, armor: 6, block: 3 }).total, 0);
  assert.equal(hitDamage({ damage: 14, armor: 5, block: 8 }).total, 1);
  assert.equal(hitDamage({ damage: 2, armor: 6, block: 3 }).total, 0);
});

test("Overwhelming Force applies last and uses half the original damage", () => {
  assert.equal(hitDamage({ damage: 20, armor: 15, overwhelming: true }).total, 10);
  assert.equal(hitDamage({ damage: 20, resistant: true, armor: 6, overwhelming: true }).total, 10);
  const hit = hitDamage({ damage: 16, resistant: true, armor: 6, block: 1, overwhelming: true });
  assert.equal(hit.afterBlock, 1);
  assert.equal(hit.minimum, 8);
  assert.equal(hit.total, 8);
  assert.equal(hitDamage({ damage: 17, resistant: true, armor: 99, block: 99, overwhelming: true }).total, 8);
  assert.equal(hitDamage({ damage: 16, overwhelming: true }).total, 16);
  assert.equal(
    hitDamage({ damage: 16, resistant: true, armor: 7, twoHanded: true, puncture: true, block: 3, overwhelming: true }).total,
    8
  );
});

test("hit damage accepts full off-hand damage and clamps negative reductions", () => {
  assert.equal(hitDamage({ damage: finalDamage(15), resistant: true, armor: 2 }).total, 5);
  assert.equal(hitDamage({ damage: -5, overwhelming: true }).total, 0);
  assert.equal(hitDamage({ damage: 16, armor: -2, block: -3 }).total, 16);
  assert.equal(hitDamage().total, 0);
});

test("attacking with both needs a Light weapon equipped in each hand", () => {
  const equip = (name, id) => ({ ...structuredClone(w(name)), id, system: { ...structuredClone(w(name).system), equipped: true } });
  const dagger = equip("Dagger", "a"),
    scimitar = equip("Scimitar", "b"),
    longsword = equip("Longsword", "c");
  const stowed = { ...equip("Handaxe", "d"), system: { ...w("Handaxe").system, equipped: false } };
  assert.deepEqual(
    dualWieldPartners(dagger, [dagger, scimitar, longsword, stowed]).map(item => item.id),
    ["b"]
  );
  assert.deepEqual(dualWieldPartners(longsword, [dagger, scimitar, longsword]), []);
  assert.deepEqual(dualWieldPartners(dagger, [dagger, longsword]), []);
});

test("off-hand hits from attacking with both deal full dice damage with no modifier", () => {
  const plan = damagePlan({ weapon: w("Scimitar"), level: 5, modifier: 3, offhand: true });
  assert.equal(plan.formula, "2d8");
  assert.equal(plan.statBonus, 0);
  assert.match(plan.notes[0], /full dice damage/);
  assert.equal(finalDamage(9), 9);
  assert.equal(finalDamage(-2), 0);
  assert.equal(damagePlan({ weapon: w("Scimitar"), modifier: 3, offhand: true, critical: true }).formula, "1d8 + 8");
});

test("Loading weapons track shots; blank means fully loaded", () => {
  assert.equal(shotsLeft(w("Longsword")), null);
  assert.equal(shotsLeft(w("Revolver")), 6);
  assert.equal(shotsLeft({ system: { loading: 6, shots: 2 } }), 2);
  assert.equal(shotsLeft({ system: { loading: 1, shots: 0 } }), 0);
  assert.equal(shotsLeft({ system: { loading: 6, shots: 9 } }), 6);
});

test("the attack dialog switches the dice when range or mounting changes the reasons", async () => {
  class Input {
    constructor(name, extra = {}) {
      Object.assign(this, { name, checked: false, value: "", listeners: [] }, extra);
    }
    addEventListener(type, fn) {
      this.listeners.push(fn);
    }
    fire() {
      this.listeners.forEach(fn => fn());
    }
  }
  const fields = { mode: new Input("mode", { value: "ranged" }), longRange: new Input("longRange"), mounted: new Input("mounted") };
  const radios = { normal: new Input("rollMode"), disadvantage: new Input("rollMode") };
  const text = { hidden: true, textContent: "" };
  const form = {
    querySelector(selector) {
      if (selector === ".wb-attack-reasons") return text;
      const radio = /value="(\w+)"/.exec(selector);
      if (radio) return radios[radio[1]];
      return fields[/name="(\w+)"/.exec(selector)?.[1]];
    }
  };
  globalThis.foundry ??= {};
  const { bindAttackDialog } = await import("../module/attack-actions.mjs");
  const actor = {
    system: {
      stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(k => [k, { value: 12, effective: 12 }])),
      equipment: {}
    }
  };
  bindAttackDialog({ querySelector: s => (s === "form" ? form : null) }, actor, w("Longbow"));
  assert.equal(radios.normal.checked, true);
  assert.equal(text.hidden, true);
  fields.longRange.checked = true;
  fields.longRange.fire();
  assert.equal(radios.disadvantage.checked, true);
  assert.match(text.textContent, /normal range/);
  fields.longRange.checked = false;
  fields.longRange.fire();
  assert.equal(text.hidden, true);
});

test("attack cards replace Foundry's kh/kl notation with plain wording", async () => {
  const { d20Mode } = await import("../module/attack-actions.mjs");
  assert.equal(d20Mode("2d20kl1 + 0"), "disadvantage");
  assert.equal(d20Mode("2d20kh1 + 3"), "advantage");
  assert.equal(d20Mode("1d20 + 3"), "normal");
  const { describeD20Roll } = await import("../module/rolls.mjs");
  const roll = {
    total: 4,
    dice: [
      {
        faces: 20,
        total: 4,
        results: [
          { result: 18, active: false, discarded: true },
          { result: 4, active: true }
        ]
      }
    ]
  };
  assert.equal(describeD20Roll(roll, "disadvantage").diceLabel, "2d20 · keep lowest");
});

test("the Grip line shows the dice the attack will roll at the attacker's level", () => {
  const longsword = { damage: "1d8", versatileDamage: "1d10", properties: { versatile: true } };
  assert.deepEqual(gripDamage(longsword, 1), { one: "1d8", two: "1d10" });
  assert.deepEqual(gripDamage({ system: longsword }, 5), { one: "2d8", two: "2d10" });
  assert.equal(gripDamage(longsword, 7).one, damagePlan({ weapon: longsword, level: 7 }).formula);
  assert.equal(gripDamage({ damage: "1d6" }, 10).two, "3d6");
});
