// Foundry-free roll rules; adapted from the website's rollD20/Wonder behavior.
import { statModifier } from "./stats.mjs";
import { numberOr } from "./core-numbers.mjs";

export const CHECK_MODES = Object.freeze({
  normal: { label: "Normal", formula: "1d20 + @mod" },
  advantage: { label: "Advantage", formula: "2d20kh1 + @mod" },
  disadvantage: { label: "Disadvantage", formula: "2d20kl1 + @mod" }
});

export function checkMode(mode = "normal") {
  if (!Object.hasOwn(CHECK_MODES, mode)) throw new Error("Choose normal, advantage or disadvantage.");
  return CHECK_MODES[mode];
}

export function wonderPool(faith, { value = null, maxOverride = null } = {}) {
  const max = numberOr(maxOverride, Math.max(0, statModifier("fth", faith)));
  return { max, value: numberOr(value, max) };
}

export function wonderAction(kind, faith) {
  if (!["check", "save", "initiative"].includes(kind)) return null;
  return kind !== "initiative" && faith >= 21 ? "success" : "reroll";
}

// Read evaluated results rather than parsing Foundry's kh/kl formula notation.
export function describeD20Roll(roll, mode = "normal") {
  const dice = roll.dice.filter(die => die.faces === 20);
  const results = dice.flatMap(die => die.results ?? []);
  const kept = results.filter(result => result.active !== false && !result.discarded);
  if (!kept.length || !Number.isFinite(roll.total)) return null;
  const dieTotal = kept.reduce((sum, result) => sum + result.result, 0);
  const bonus = roll.total - dieTotal;
  const sign = bonus < 0 ? "−" : "+";
  const choice = mode === "advantage" ? " (higher)" : mode === "disadvantage" ? " (lower)" : "";
  return {
    equation: `${dieTotal} ${sign} ${Math.abs(bonus)} = ${roll.total}`,
    diceText: results.length > 1
      ? `Rolled ${results.map(result => result.result).join(" and ")} · kept ${dieTotal}${choice}`
      : `Rolled ${dieTotal} on the d20`,
    diceLabel: mode === "advantage" ? "2d20 · keep highest" : mode === "disadvantage" ? "2d20 · keep lowest" : "d20"
  };
}
