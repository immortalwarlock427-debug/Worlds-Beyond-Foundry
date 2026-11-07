import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveDc,
  targetingStat,
  strikeInfo,
  defenderState,
  avoidOptions,
  canBlock,
  avoidOutcome,
  resistantTo,
  strikeDamage,
  damagedHealth,
  abilityDamagePlan
} from "../module/strike-core.mjs";

const weaponCard = {
  attackerName: "Orc",
  overwhelmingForce: false,
  hands: [{ hand: "main", name: "Greataxe", total: 18, natural: 15, hit: true, critical: false }]
};
const kinds = options => options.map(option => option.kind);

test("save DCs default to 12 + modifier and accept an override", () => {
  assert.equal(saveDc(3), 15);
  assert.equal(saveDc(-1), 11);
  assert.equal(saveDc(3, 18), 18);
  assert.equal(saveDc(3, ""), 15);
  assert.equal(targetingStat({ targeting: { stat: "" }, apDiscountStat: "int" }), "int");
  assert.equal(targetingStat({ targeting: { stat: "fth" }, apDiscountStat: "int" }), "fth");
  assert.equal(targetingStat({}), "");
});

test("weapon strikes read the hand's roll; ability saves read the ability", () => {
  const weapon = strikeInfo(weaponCard, 0);
  assert.equal(weapon.check, "attack");
  assert.equal(weapon.total, 18);
  assert.equal(weapon.natural20, false);
  assert.equal(weapon.weapon, true);
  assert.equal(strikeInfo(weaponCard, 1), null);
  const save = strikeInfo(
    {
      attackerName: "Mage",
      ability: { name: "Frost Ray", check: "save", dc: 15, saveStat: "vit", onSave: "half", damageType: "Ice" },
      hands: [{ hand: "main", name: "Frost Ray", hit: true }]
    },
    0
  );
  assert.equal(save.check, "save");
  assert.equal(save.dc, 15);
  assert.equal(save.saveStat, "vit");
  assert.equal(save.onSave, "half");
  assert.equal(save.overwhelming, false);
  assert.equal(save.damageType, "Ice");
});

test("Overwhelming Force only rides on weapon attacks", () => {
  assert.equal(strikeInfo({ ...weaponCard, overwhelmingForce: true }, 0).overwhelming, true);
  assert.equal(strikeInfo({ ...weaponCard, overwhelmingForce: true, ability: { check: "attack" } }, 0).overwhelming, false);
});

test("the first popup offers Dodge, Parry when unlocked and always Let it hit", () => {
  const strike = strikeInfo(weaponCard, 0);
  const plain = defenderState({ inCombat: true, reactions: 1 });
  assert.deepEqual(kinds(avoidOptions(strike, plain)), ["dodge", "take"]);
  const parrier = defenderState({ inCombat: true, reactions: 2, parry: { unlocked: true, armed: true } });
  assert.deepEqual(kinds(avoidOptions(strike, parrier)), ["dodge", "parry", "take"]);
  assert.deepEqual(kinds(avoidOptions(strike, parrier, ["dodge"])), ["parry", "take"]);
  const used = defenderState({ inCombat: true, reactions: 2, parry: { unlocked: true, armed: true, used: true } });
  assert.deepEqual(kinds(avoidOptions(strike, used)), ["dodge", "take"]);
  const unarmed = defenderState({ inCombat: true, reactions: 2, parry: { unlocked: true, armed: false } });
  assert.deepEqual(kinds(avoidOptions(strike, unarmed)), ["dodge", "take"]);
  assert.deepEqual(kinds(avoidOptions(strike, defenderState({ inCombat: true, reactions: 0 }))), ["take"]);
});

test("outside combat reactions aren't counted, so defenses stay available", () => {
  const strike = strikeInfo(weaponCard, 0);
  assert.deepEqual(kinds(avoidOptions(strike, defenderState({ inCombat: false, reactions: 0 }))), ["dodge", "take"]);
  assert.equal(canBlock(defenderState({ inCombat: false, reactions: 0 }), [], 4), true);
});

test("a natural 20 can't be dodged but can still be parried", () => {
  const strike = strikeInfo({ ...weaponCard, hands: [{ ...weaponCard.hands[0], natural: 20, total: 25 }] }, 0);
  const parrier = defenderState({ inCombat: true, reactions: 2, parry: { unlocked: true, armed: true } });
  assert.deepEqual(kinds(avoidOptions(strike, parrier)), ["parry", "take"]);
  assert.throws(() => avoidOutcome(strike, "dodge", 30), /natural 20/);
  assert.equal(avoidOutcome(strike, "parry", 26).success, true);
});

test("save abilities offer the ability's save or the target's choice", () => {
  const fixed = { check: "save", dc: 14, saveStat: "agl", onSave: "none" };
  const options = avoidOptions(fixed, defenderState({ inCombat: true, reactions: 0 }));
  assert.deepEqual(kinds(options), ["save", "take"]);
  assert.equal(options[0].stat, "agl");
  assert.match(options[0].label, /Agility save \(DC 14\)/);
  const choice = avoidOptions({ ...fixed, saveStat: "" }, defenderState({}));
  assert.equal(choice[0].stat, "");
  assert.equal(choice[1].label, "Don't resist");
});

test("Dodge and Parry must beat the attack; saves meet or beat the DC", () => {
  const strike = strikeInfo(weaponCard, 0);
  assert.deepEqual(avoidOutcome(strike, "dodge", 18), { success: false, multiplier: 1, negated: false, done: false });
  assert.deepEqual(avoidOutcome(strike, "dodge", 19), { success: true, multiplier: 0, negated: true, done: true });
  assert.equal(avoidOutcome(strike, "parry", 18).success, false);
  assert.equal(avoidOutcome(strike, "take").multiplier, 1);
  const none = { check: "save", dc: 15, onSave: "none" };
  assert.deepEqual(avoidOutcome(none, "save", 15), { success: true, multiplier: 0, negated: true, done: true });
  assert.deepEqual(avoidOutcome(none, "save", 14), { success: false, multiplier: 1, negated: false, done: true });
  assert.deepEqual(avoidOutcome({ ...none, onSave: "half" }, "save", 20), { success: true, multiplier: 0.5, negated: false, done: true });
  assert.throws(() => avoidOutcome(strike, "dodge", NaN), /no total/);
});

test("Block is offered once, needs a reaction and something left to stop", () => {
  const defender = defenderState({ inCombat: true, reactions: 1 });
  assert.equal(canBlock(defender, [], 5), true);
  assert.equal(canBlock(defender, ["block"], 5), false);
  assert.equal(canBlock(defender, [], 0), false);
  assert.equal(canBlock(defenderState({ inCombat: true, reactions: 0 }), [], 5), false);
});

test("resistance needs every listed damage type", () => {
  assert.equal(resistantTo(["Fire"], "Fire"), true);
  assert.equal(resistantTo(["Bludgeoning"], "Bludgeoning, Piercing"), false);
  assert.equal(resistantTo(["Bludgeoning", "Piercing"], "Bludgeoning, Piercing"), true);
  assert.equal(resistantTo(["Fire"], ""), false);
});

test("damage follows Resistance, Armor Rating, Block, then Overwhelming Force", () => {
  // Notion example: 16 damage, Armor Rating 6, Block 10 → blocked completely.
  assert.equal(strikeDamage({ rolled: 16, armor: 6, block: 10 }).total, 0);
  // 14 damage, AR 5, Block 8 → 1.
  assert.equal(strikeDamage({ rolled: 14, armor: 5, block: 8 }).total, 1);
  const resisted = strikeDamage({ rolled: 21, resistant: true, armor: 3 });
  assert.equal(resisted.afterResistance, 10);
  assert.equal(resisted.total, 7);
  // Two-handed hits count half the Armor Rating, rounded up.
  assert.equal(strikeDamage({ rolled: 10, armor: 7, twoHanded: true }).total, 6);
  // Overwhelming Force: a fully blocked 20-damage hit still deals 10, Resistance included.
  assert.equal(strikeDamage({ rolled: 20, armor: 4, block: 30, overwhelming: true }).total, 10);
  assert.equal(strikeDamage({ rolled: 20, resistant: true, armor: 8, overwhelming: true }).total, 10);
});

test("a parried Overwhelming Force hit still deals half; a dodge avoids it", () => {
  assert.equal(strikeDamage({ rolled: 15, negated: true, overwhelming: true }).total, 7);
  assert.equal(strikeDamage({ rolled: 15, negated: true, overwhelming: false }).total, 0);
  assert.equal(strikeDamage({ rolled: 15, negated: true, dodged: true, overwhelming: true }).total, 0);
});

test("a half-damage save halves before Resistance and Armor Rating", () => {
  const result = strikeDamage({ rolled: 17, multiplier: 0.5, armor: 2 });
  assert.equal(result.halved, 8);
  assert.equal(result.total, 6);
});

test("damage adds to stored damage and never heals", () => {
  assert.equal(damagedHealth(4, 7), 11);
  assert.equal(damagedHealth(-3, 5), 2);
  assert.equal(damagedHealth(4, -9), 4);
  assert.equal(damagedHealth(undefined, 2.8), 2);
});

test("ability damage substitutes the modifier and adds the dice maximum on a critical", () => {
  assert.deepEqual(abilityDamagePlan({ formula: "2d8 + @mod", modifier: 3 }), { formula: "2d8 + 3", critical: false, simple: true });
  assert.equal(abilityDamagePlan({ formula: "2d8 + @mod", modifier: -2 }).formula, "2d8 - 2");
  assert.equal(abilityDamagePlan({ formula: "2d8 + @mod", modifier: 3, critical: true }).formula, "2d8 + 3 + 16");
  assert.equal(abilityDamagePlan({ formula: "1d10+1d4", critical: true }).formula, "1d10+1d4 + 14");
  const unusual = abilityDamagePlan({ formula: "4d6kh3", critical: true });
  assert.equal(unusual.formula, "4d6kh3");
  assert.equal(unusual.critical, false);
  assert.equal(abilityDamagePlan({ formula: "" }).formula, "");
});

test("targeted abilities: plan uses the targeting stat, its modifier and the default DC", async () => {
  const { abilityStrikePlan, targetedAbilities } = await import("../module/ability-strikes.mjs");
  const ability = (id, kind, mode, extra = {}) => ({
    id,
    type: "ability",
    system: { kind, apDiscountStat: "int", targeting: { mode, stat: "", saveStat: "", dc: null, ...extra } }
  });
  const actor = {
    items: [
      ability("bolt", "active", "attack"),
      ability("ray", "active", "save", { saveStat: "vit" }),
      ability("aura", "passive", "save"),
      ability("plain", "active", "none"),
      { id: "axe", type: "weapon", system: {} }
    ],
    system: { stats: { int: { mod: 3 }, fth: { mod: 1 } } }
  };
  assert.deepEqual(
    targetedAbilities(actor).map(item => item.id),
    ["bolt", "ray"]
  );
  assert.deepEqual(abilityStrikePlan(actor, actor.items[1]), { check: "save", stat: "int", mod: 3, dc: 15, saveStat: "vit" });
  const custom = ability("smite", "active", "save", { stat: "fth", dc: 17 });
  assert.equal(abilityStrikePlan(actor, custom).dc, 17);
  assert.equal(abilityStrikePlan(actor, custom).mod, 1);
});

test("damage formulas take plain stat names, full names, @ forms and mod", async () => {
  const { resolveStatTerms } = await import("../module/strike-core.mjs");
  const mods = { str: 3, dex: -1, int: 4 };
  assert.equal(resolveStatTerms("2d8 + str", mods), "2d8 + 3");
  assert.equal(resolveStatTerms("2d8 + STR", mods), "2d8 + 3");
  assert.equal(resolveStatTerms("2d8 + Strength", mods), "2d8 + 3");
  assert.equal(resolveStatTerms("2d8 + @dex", mods), "2d8 - 1");
  assert.equal(resolveStatTerms("2d8 - dex", mods), "2d8 + 1");
  assert.equal(resolveStatTerms("1d10 + int + mod", mods, 2), "1d10 + 4 + 2");
  assert.equal(resolveStatTerms("1d6 + wis", mods), "1d6 + 0");
  assert.equal(abilityDamagePlan({ formula: "2d8 + str", mods, critical: true }).formula, "2d8 + 3 + 16");
});

test("Defy Fate turns a failed defense roll into a success", () => {
  const strike = { check: "attack", total: 18, natural20: false };
  assert.equal(avoidOutcome(strike, "dodge", 5, true).success, true);
  assert.equal(avoidOutcome({ check: "save", dc: 15, onSave: "half" }, "save", 3, true).multiplier, 0.5);
});

test("an area attack makes Dodge the save: meet the DC for half damage", () => {
  const strike = strikeInfo(
    {
      attackerName: "Mage",
      ability: { name: "Fireball", check: "attack", area: "circle", dc: 15, damageType: "Fire" },
      hands: [{ hand: "main", name: "Fireball", hit: true, target: { name: "Orc" } }]
    },
    0
  );
  assert.equal(strike.check, "area");
  assert.equal(strike.dc, 15);
  const options = avoidOptions(strike, defenderState({ inCombat: true, reactions: 1, parry: { unlocked: true, armed: true } }));
  assert.deepEqual(kinds(options), ["dodge", "take"]);
  assert.match(options[0].label, /DC 15, half damage/);
  assert.deepEqual(kinds(avoidOptions(strike, defenderState({ inCombat: true, reactions: 0 }))), ["take"]);
  assert.deepEqual(avoidOutcome(strike, "dodge", 15), { success: true, multiplier: 0.5, negated: false, done: true });
  assert.deepEqual(avoidOutcome(strike, "dodge", 14), { success: false, multiplier: 1, negated: false, done: true });
});

test("opportunity attacks offer no Dodge, Parry or Block; normal attacks keep them", () => {
  const data = opportunity => ({
    attackerName: "Orc",
    opportunity,
    hands: [{ hand: "main", name: "Axe", hit: true, total: 15, natural: 12 }]
  });
  const defender = defenderState({ inCombat: true, reactions: 2, parry: { unlocked: true, armed: true } });
  const opportunityStrike = strikeInfo(data("leave"), 0);
  assert.equal(opportunityStrike.opportunity, true);
  assert.deepEqual(kinds(avoidOptions(opportunityStrike, defender)), ["take"]);
  assert.equal(canBlock(defender, [], 5, opportunityStrike), false);
  const normal = strikeInfo(data(null), 0);
  assert.deepEqual(kinds(avoidOptions(normal, defender)), ["dodge", "parry", "take"]);
  assert.equal(canBlock(defender, [], 5, normal), true);
});
