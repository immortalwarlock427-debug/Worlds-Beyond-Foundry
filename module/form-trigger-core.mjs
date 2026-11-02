import { recoveryPool } from "./consumable-benefits.mjs";
import { numberOr } from "./core-numbers.mjs";
import { abilityActive } from "./ability-timers-core.mjs";
export const TRIGGER_MODES = Object.freeze({ manual: "Manual", automatic: "Automatic", prompt: "Ask first" });
export const TRIGGER_COMPARISONS = Object.freeze({ above: "Above", atLeast: "At or above", below: "Below", atMost: "At or below" });
export const TRIGGER_END_MODES = Object.freeze({ prompt: "Ask to end", stay: "Keep active", automatic: "End automatically" });
const items = actor => Array.from(actor.items?.values?.() ?? actor.items ?? []);

export function triggerCondition(system, trigger = {}) {
  if (!trigger.mode || trigger.mode === "manual") return null;
  const pool = recoveryPool(system, trigger.resourceId);
  if (!pool) return null;
  const threshold = numberOr(trigger.threshold, pool.max);
  const value = numberOr(pool.value, pool.health ? pool.max - pool.damage : null);
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return null;
  switch (trigger.comparison) {
    case "above": return value > threshold;
    case "atLeast": return value >= threshold;
    case "below": return value < threshold;
    case "atMost": return value <= threshold;
    default: return null;
  }
}

export function triggerSnapshot(actor) {
  return Object.fromEntries(items(actor).filter(item => item.type === "ability" && item.system.kind === "form").map(item => [item.id, triggerCondition(actor.system, item.system.trigger)]));
}

export function triggerTransitions(actor, before) {
  const enter = [], end = [];
  for (const item of items(actor).filter(item => item.type === "ability" && item.system.kind === "form")) {
    const now = triggerCondition(actor.system, item.system.trigger), was = before[item.id];
    if (now === null) continue;
    if (now && was !== true && !abilityActive(item)) enter.push(item);
    if (!now && was === true && abilityActive(item) && item.system.trigger?.endMode !== "stay") end.push(item);
  }
  return { enter, end };
}
