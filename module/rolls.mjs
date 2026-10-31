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
