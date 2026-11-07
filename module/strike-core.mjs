// Foundry-free rules for resolving one attack or ability against one target.
// Order of a hit (Notion Defenses, checked 2026-11-06): hit check, Dodge or Parry
// (or a save for abilities), Resistance, Armor Rating, Block, Overwhelming Force.
import { STATS } from "./stats.mjs";
import { numberOr } from "./core-numbers.mjs";
import { hitDamage, finalDamage } from "./attacks.mjs";
import { isResistant } from "./resistances.mjs";

export const TARGETING_MODES = Object.freeze({
  none: "No target",
  attack: "Attack roll vs Natural Evasion",
  save: "Target makes a save"
});
export const TARGETING_STATS = Object.freeze(
  Object.fromEntries([["", "Same as AP discount stat"], ...STATS.map(stat => [stat.key, stat.label])])
);
export const SAVE_STATS = Object.freeze(Object.fromEntries([["", "Target's choice"], ...STATS.map(stat => [stat.key, stat.label])]));
export const SAVE_SUCCESS = Object.freeze({ none: "No damage", half: "Half damage, rounded down" });

const statLabel = key => STATS.find(stat => stat.key === key)?.label ?? key;

// Notion Stats: an ability's save DC is 12 + that stat's modifier unless the ability sets its own.
export function saveDc(modifier, override = null) {
  const value = numberOr(override, null);
  return value === null ? 12 + (Number(modifier) || 0) : Math.floor(value);
}

// The stat an ability attacks with or sets its DC from.
export function targetingStat(system = {}) {
  const key = system.targeting?.stat || system.apDiscountStat || "";
  return STATS.some(stat => stat.key === key) ? key : "";
}

// Everything a defender needs to know about one incoming hand, read from the attack card's flag.
export function strikeInfo(data, index = 0) {
  const hand = Array.isArray(data?.hands) ? data.hands[index] : null;
  if (!hand) return null;
  const ability = data.ability ?? null;
  const check = ability?.check === "save" ? "save" : "attack";
  return {
    check,
    name: hand.name ?? ability?.name ?? "Attack",
    attackerName: data.attackerName ?? "Attacker",
    total: Number.isFinite(hand.total) ? hand.total : null,
    natural20: hand.natural === 20,
    hit: hand.hit,
    critical: hand.critical === true,
    dc: check === "save" ? numberOr(ability.dc, 12) : null,
    saveStat: check === "save" ? ability.saveStat || "" : "",
    onSave: ability?.onSave === "half" ? "half" : "none",
    overwhelming: !ability && !!data.overwhelmingForce,
    damageType: hand.damageType ?? ability?.damageType ?? "",
    offhand: hand.hand === "off",
    weapon: !ability
  };
}

// The defender's situation, gathered by the Foundry side. Outside combat reactions aren't spent.
export function defenderState({ inCombat = false, reactions = 0, parry = {}, resistances = [], armor = 0 } = {}) {
  return {
    reactionsLeft: inCombat ? Math.max(0, numberOr(reactions, 0)) : Infinity,
    parry: { unlocked: !!parry.unlocked, armed: !!parry.armed, used: !!parry.used },
    resistances: Array.isArray(resistances) ? resistances : [],
    armor: Math.max(0, numberOr(armor, 0))
  };
}

// Choices at the first popup. A save costs no reaction. "take" is always offered.
export function avoidOptions(strike, defender, used = []) {
  const options = [];
  if (strike.check === "save") {
    options.push({
      kind: "save",
      stat: strike.saveStat,
      label: strike.saveStat ? `${statLabel(strike.saveStat)} save (DC ${strike.dc})` : `Save (DC ${strike.dc})`
    });
  } else {
    const reactions = defender.reactionsLeft >= 1;
    if (reactions && !strike.natural20 && !used.includes("dodge")) options.push({ kind: "dodge", label: "Dodge" });
    const parry = defender.parry;
    if (reactions && parry.unlocked && parry.armed && !parry.used && !used.includes("parry"))
      options.push({ kind: "parry", label: "Parry" });
  }
  options.push({ kind: "take", label: strike.check === "save" ? "Don't resist" : "Let it hit" });
  return options;
}

// Block comes after Armor Rating, once per attack, and needs a reaction.
export function canBlock(defender, used = [], afterArmor = 0) {
  return defender.reactionsLeft >= 1 && !used.includes("block") && afterArmor > 0;
}

// Outcome of the avoid step. Dodge must beat the attack; a save meets or beats the DC.
export function avoidOutcome(strike, kind, total) {
  if (kind === "take") return { success: false, multiplier: 1, negated: false, done: true };
  const value = Number(total);
  if (!Number.isFinite(value)) throw new Error("That defense roll has no total.");
  if (kind === "dodge") {
    if (strike.natural20) throw new Error("A natural 20 can't be dodged.");
    const success = value > strike.total;
    return { success, multiplier: success ? 0 : 1, negated: success, done: success };
  }
  if (kind === "parry") {
    const success = value > strike.total;
    return { success, multiplier: success ? 0 : 1, negated: success, done: success };
  }
  if (kind === "save") {
    const success = value >= strike.dc;
    return {
      success,
      multiplier: success ? (strike.onSave === "half" ? 0.5 : 0) : 1,
      negated: success && strike.onSave !== "half",
      done: true
    };
  }
  throw new Error("Choose Dodge, Parry, a save or take the hit.");
}

// Resistance needs every listed type (a Mace's "Bludgeoning, Piercing" needs both resisted).
export function resistantTo(resistances, damageType) {
  const types = String(damageType ?? "")
    .split(",")
    .map(type => type.trim())
    .filter(Boolean);
  return types.length > 0 && types.every(type => isResistant(resistances, type));
}

// Final damage for one hit. A Dodge or Parry that succeeds negates it; Overwhelming Force
// still deals half the rolled damage through a Parry, never through a Dodge.
export function strikeDamage({
  rolled = 0,
  multiplier = 1,
  negated = false,
  dodged = false,
  resistant = false,
  armor = 0,
  twoHanded = false,
  puncture = false,
  overwhelming = false,
  block = 0
} = {}) {
  const original = finalDamage(rolled);
  const minimum = overwhelming && !dodged ? Math.floor(original / 2) : 0;
  if (negated)
    return { original, halved: 0, afterResistance: 0, armor: 0, afterArmor: 0, block: 0, afterBlock: 0, minimum, total: minimum };
  const halved = Math.floor(original * (Number(multiplier) || 0));
  const hit = hitDamage({ damage: halved, resistant, armor, twoHanded, puncture, overwhelming: false, block });
  return { ...hit, original, halved, minimum, total: Math.max(hit.afterBlock, minimum) };
}

// The attack card hides its manual buttons while the automatic flow owns a hand.
export function handledAutomatically(data, state, index = 0) {
  if (!data?.automated) return false;
  return state?.exchanges?.[index]?.status !== "manual";
}

// Health keeps damage taken. Damage never heals and the stored amount can pass max.
export function damagedHealth(damage, amount) {
  return numberOr(damage, 0) + Math.max(0, Math.floor(numberOr(amount, 0)));
}

const TERM = /^([+-]?)(\d*)d(\d+)$|^([+-]?)(\d+)$/i;

// Ability damage: "2d8 + @mod". A critical hit adds the dice maximum once, like weapons
// (Notion: maximum damage, then roll the dice again). Unusual formulas roll as written.
export function abilityDamagePlan({ formula = "", modifier = 0, critical = false } = {}) {
  const mod = Number(modifier) || 0;
  const expression = String(formula ?? "")
    .replace(/@mod/gi, String(mod))
    .replace(/−/g, "-")
    .replace(/\+\s*-/g, "- ")
    .replace(/-\s*-/g, "+ ")
    .trim();
  if (!expression) return { formula: "", critical: false, simple: true };
  const terms = expression.replace(/\s+/g, "").match(/[+-]?[^+-]+/g) ?? [];
  let diceMax = 0,
    simple = true;
  for (const term of terms) {
    const match = TERM.exec(term);
    if (!match) {
      simple = false;
      break;
    }
    if (match[3]) diceMax += (match[2] === "" ? 1 : Number(match[2])) * Number(match[3]) * (match[1] === "-" ? -1 : 1);
  }
  const bonus = critical && simple && diceMax > 0 ? ` + ${diceMax}` : "";
  return { formula: `${expression}${bonus}`, critical: !!critical && simple, simple };
}
