// Foundry-free rules. Sources and deliberate differences from the website are in docs/CORE-NUMBERS.md.
import { statModifier, milestonesReached } from "./stats.mjs";

// Ported from Worlds-Beyond/js/combat-core.js and checked against Notion's VIT chart.
export function hitDieFor(vit) {
  if (vit >= 46) return "2d12+1d8";
  if (vit >= 43) return "2d12+1d6";
  if (vit >= 40) return "2d12+1d4";
  if (vit >= 37) return "2d12";
  if (vit >= 34) return "1d12+1d10";
  if (vit >= 31) return "1d12+1d8";
  if (vit >= 28) return "1d12+1d6";
  if (vit >= 25) return "1d12+1d4";
  if (vit >= 22) return "1d12";
  if (vit >= 19) return "1d10";
  if (vit >= 16) return "1d8";
  if (vit >= 12) return "1d6";
  return "1d4";
}

export function numberOr(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function coreNumbers({ level = 1, stats = {}, bonuses = {}, overrides = {} } = {}) {
  const vit = numberOr(stats.vit?.value, 12);
  const agl = numberOr(stats.agl?.value, 12);
  const aglMod = statModifier("agl", agl);
  const automatic = {
    healthMax: vit * numberOr(level, 1),
    hitDie: hitDieFor(vit),
    apMax: 15 + 2 * Math.floor(numberOr(level, 1) / 5),
    reactionsMax: 1 + milestonesReached(agl),
    evasion: 12 + aglMod + numberOr(bonuses.evasion, 0),
    armorRating: Math.max(0, (vit >= 28 ? Math.floor(vit / 2) : statModifier("vit", vit))
      + numberOr(bonuses.armor, 0)),
    movement: Math.max(5, 5 + 5 * aglMod)
  };
  const effective = Object.fromEntries(Object.entries(automatic).map(([key, value]) => [key,
    key === "hitDie" ? (String(overrides.hitDie ?? "").trim() || value) : numberOr(overrides[key], value)
  ]));
  return { ...effective, automatic };
}

// Store the distance below maximum, not a cached maximum. Changing current VIT,
// level or the max override then shifts current Health by precisely the same amount.
// Neither helper clamps corrections: negative Health and values above max are valid.
export function healthFromDamage(maximum, damage = 0) {
  return maximum - damage;
}

export function damageFromHealth(maximum, current) {
  return maximum - current;
}
