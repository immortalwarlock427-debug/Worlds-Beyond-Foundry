// Foundry-free resource math. Magic System uses current INT/FTH × (level + 2).
import { numberOr } from "./core-numbers.mjs";

export const MAGIC_RESOURCES = Object.freeze({ mana: { label: "Mana", stat: "int" }, holyPower: { label: "Holy power", stat: "fth" } });
export const customResourceId = id => /^[A-Za-z0-9]{16}$/.test(id);

// Persist expenditure, not a prepared total. Max changes therefore change current
// by the same amount, without writes on render/reload or erasing manual corrections.
export function resourcePool(max, spent = 0) {
  max = Math.max(0, numberOr(max, 0));
  return { max, value: max - numberOr(spent, 0) };
}

export function magicPool(level, score, data = {}) {
  const automatic = Math.max(0, numberOr(score, 12) * (numberOr(level, 1) + 2) + numberOr(data.bonus, 0));
  return { ...resourcePool(numberOr(data.maxOverride, automatic), data.spent), automatic };
}

export function customPool(data = {}) {
  return resourcePool(numberOr(data.baseMax, 100) + numberOr(data.bonus, 0), data.spent);
}

export function poolSpentForCurrent(max, current) {
  const value = numberOr(current, null);
  // Clearing a current correction fills that pool, like the existing trackers.
  return value === null ? 0 : max - value;
}

export function adjustedResourceSpent(pool, action, amount = 1) {
  if (action === "fill") return 0;
  amount = numberOr(amount, null);
  if (amount === null || amount < 0) throw new Error("Enter a non-negative recovery amount.");
  if (!["spend", "restore", "recover"].includes(action)) throw new Error("Choose a resource action.");
  const spent = pool.max - pool.value;
  if (action === "spend") {
    if (pool.value < amount) throw new Error("Not enough resource points. Correct Current on the sheet if needed.");
    return spent + amount;
  }
  return pool.value >= pool.max ? spent : Math.max(0, spent - amount);
}

export function resourceEntries(system) {
  const magic = Object.entries(MAGIC_RESOURCES).filter(([key]) => system[key]?.enabled).map(([key, def]) => ({
    key, label: def.label, path: `system.${key}`, custom: false, ...system[key]
  }));
  const custom = Object.entries(system.customResources ?? {}).filter(([id]) => customResourceId(id)).map(([key, data]) => ({
    key, label: data.name || "Resource", path: `system.customResources.${key}`, custom: true, ...data
  }));
  return [...magic, ...custom];
}

export function resourceRestUpdates(system) {
  const updates = {};
  for (const key of Object.keys(MAGIC_RESOURCES)) if (system[key]) updates[`system.${key}.spent`] = 0;
  for (const [id, data] of Object.entries(system.customResources ?? {})) {
    if (customResourceId(id) && data.refillOnRest) updates[`system.customResources.${id}.spent`] = 0;
  }
  return updates;
}
