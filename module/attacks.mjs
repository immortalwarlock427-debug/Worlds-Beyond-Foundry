// Foundry-free weapon attack and damage rules. Sources: Notion "Weapons Explained",
// "Defenses" and "Action Points" (checked 2026-10-31), and the website's combat-core.js.
import { statModifier } from "./stats.mjs";

const MILESTONE = 21;

// Which stats a weapon may attack with, for the chosen attack mode.
export function attackStatChoices(weapon, mode = "melee") {
  const system = weapon.system ?? weapon;
  if (system.family === "paragon") return ["str", "dex"];
  if (mode === "thrown") return ["dex"];
  if (system.family === "heavy") return ["str"];
  if (system.family === "finesse") return ["dex"];
  if (system.ranged || system.family === "none") return ["dex"];
  return ["str", "dex"];
}

// Thrown is available on melee weapons with the Thrown property. Ranged weapons that
// are also Thrown (Dart, Net) are simply ranged attacks.
export function attackModes(weapon) {
  const system = weapon.system ?? weapon;
  if (system.ranged) return ["ranged"];
  return system.properties?.thrown ? ["melee", "thrown"] : ["melee"];
}

export function attackApCost(modifier) {
  return Math.max(5, 10 - (Number(modifier) || 0));
}

// Automatic reasons for disadvantage. The player still picks the final roll mode.
export function attackDisadvantages({ weapon, scores = {}, mode = "melee", longRange = false, mounted = false, heavyArmor = false } = {}) {
  const system = weapon.system ?? weapon;
  const str = Number(scores.str ?? 12), dex = Number(scores.dex ?? 12);
  const reasons = [];
  if (system.family === "heavy" && str < MILESTONE) reasons.push("Heavy weapon without 21 Strength");
  if (system.family === "finesse" && dex < MILESTONE) reasons.push("Finesse weapon without 21 Dexterity");
  if (system.family === "paragon" && (str < MILESTONE || dex < MILESTONE)) reasons.push("Paragon weapon without both 21 Strength and 21 Dexterity");
  if (system.properties?.mount && !mounted) reasons.push("Mount weapon while not mounted");
  if (longRange && mode !== "melee") reasons.push("Attacking past normal range");
  if (heavyArmor) reasons.push("Heavy armor without 21 Strength");
  return reasons;
}

export function critThreshold(weapon) {
  const family = (weapon.system ?? weapon).family;
  return family === "finesse" || family === "paragon" ? 18 : 20;
}

// A natural 20 always hits and crits. Finesse and Paragon also crit on a natural 18 or 19
// that hits. Without a target's Natural Evasion, hit is unknown (null).
export function attackOutcome({ natural, total, evasion = null, threshold = 20 }) {
  if (natural === 20) return { hit: true, critical: true };
  const hit = evasion == null ? null : total >= evasion;
  const critical = natural >= threshold && hit !== false ? (hit ? true : "if it hits") : false;
  return { hit, critical };
}

// The listed damage is rolled once more at levels 5, 10, 15 and 20.
export function damageMultiplier(level) {
  return 1 + Math.floor(Math.max(1, Number(level) || 1) / 5);
}

const TERM = /^([+-]?)(\d*)d(\d+)$|^([+-]?)(\d+)$/i;

// Repeat a listed damage expression `times` times, e.g. 2d6 × 2 → 4d6.
export function scaleDice(expression, times = 1) {
  const compact = String(expression ?? "").replace(/\s+/g, "").replace(/−/g, "-");
  if (!compact) return { formula: "", maximum: 0, valid: true };
  const terms = compact.match(/[+-]?[^+-]+/g) ?? [];
  let maximum = 0;
  const parts = [];
  for (const term of terms) {
    const match = TERM.exec(term);
    if (!match) return { formula: "", maximum: 0, valid: false };
    if (match[3]) {
      const count = (match[2] === "" ? 1 : Number(match[2])) * times;
      const sign = match[1] === "-" ? -1 : 1;
      maximum += sign * count * Number(match[3]);
      parts.push(`${match[1] || "+"}${count}d${match[3]}`);
    } else {
      const flat = Number(match[5]) * times * (match[4] === "-" ? -1 : 1);
      maximum += flat;
      parts.push(flat < 0 ? `${flat}` : `+${flat}`);
    }
  }
  return { formula: parts.join("").replace(/^\+/, ""), maximum, valid: true };
}

// Everything a damage roll needs, without rolling.
export function damagePlan({ weapon, level = 1, modifier = 0, grip = "one", critical = false, mountedFeet = 0, mounted = false }) {
  const system = weapon.system ?? weapon;
  const twoHandedGrip = system.properties?.versatile && grip === "two";
  const listed = twoHandedGrip && system.versatileDamage ? system.versatileDamage : system.damage;
  const times = damageMultiplier(level);
  const dice = scaleDice(listed, times);
  const doubled = system.family === "heavy" || system.family === "paragon";
  const statBonus = (doubled ? 2 : 1) * modifier;
  const mountBonus = system.properties?.mount && mounted ? Math.max(0, Math.min(Math.floor((Number(mountedFeet) || 0) / 10), modifier)) : 0;
  const flat = statBonus + mountBonus;
  const signed = value => value < 0 ? ` - ${Math.abs(value)}` : ` + ${value}`;
  // A critical hit deals the maximum of its damage, then rolls the damage dice again.
  const formula = !dice.formula ? "" : critical
    ? `${dice.formula}${signed(dice.maximum)}${flat ? signed(flat) : ""}`
    : `${dice.formula}${flat ? signed(flat) : ""}`;
  const twoHanded = !!(system.properties?.twoHanded || twoHandedGrip);
  const notes = [];
  if (twoHanded && system.signature?.puncture) notes.push("Two-handed Puncture: halve the target's Armor Rating (rounded down), then ignore 2 more.");
  else if (twoHanded) notes.push("Two-handed: this hit ignores half the target's Armor Rating, rounded down.");
  else if (system.signature?.puncture) notes.push("Puncture: this hit ignores 2 of the target's Armor Rating.");
  return { formula, valid: dice.valid, listed, times, statBonus, mountBonus, critical: !!critical, twoHanded, notes };
}

// How much of the target's Armor Rating counts against this hit.
export function effectiveArmor(armorRating, { twoHanded = false, puncture = false } = {}) {
  let armor = Math.max(0, Number(armorRating) || 0);
  if (twoHanded) armor -= Math.floor(armor / 2);
  if (puncture) armor -= 2;
  return Math.max(0, armor);
}

export function modifierFor(statKey, scores = {}) {
  return statModifier(statKey, scores[statKey] ?? 12);
}
