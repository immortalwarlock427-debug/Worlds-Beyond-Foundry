// Foundry-free resource math. Magic System uses current INT/FTH × (level + 2).
import { numberOr } from "./core-numbers.mjs";
import { STATS } from "./stats.mjs";

export const MAGIC_RESOURCES = Object.freeze({ mana: { label: "Mana", stat: "int" }, holyPower: { label: "Holy power", stat: "fth" } });
export const customResourceId = id => /^[A-Za-z0-9]{16}$/.test(id);
export const RESOURCE_SCALING = Object.freeze(Object.fromEntries([["", "Manual maximum"], ...STATS.map(stat => [stat.key, `${stat.label} (${stat.abbr})`])]));
export const RESOURCE_DISPLAYS = Object.freeze({ number: "Points", percent: "Percentage" });

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

export function customPool(data = {}, { level = 1, stats = {} } = {}) {
  const stat = data.scaleStat && STATS.find(stat => stat.key === data.scaleStat);
  const max = stat ? magicPool(level, stats[stat.key]?.effective ?? stats[stat.key]?.value, { bonus: data.bonus }).max
    : numberOr(data.baseMax, 100) + numberOr(data.bonus, 0);
  return resourcePool(max, data.spent);
}

export function resourcePresentation(pool) {
  const percent = pool.display === "percent";
  const percentUnavailable = percent && !(pool.max > 0);
  // Round only presentation. An unchanged whole-sheet submission preserves the
  // exact point balance instead of saving a rounded percentage back into it.
  const inputValue = percent && !percentUnavailable ? Math.round(pool.value / pool.max * 10000) / 100 : pool.value;
  const meterPercent = pool.max > 0 ? Math.max(0, Math.min(100, pool.value / pool.max * 100)) : 0;
  return { percent, percentUnavailable, inputValue, meterPercent };
}

export function resourceInputPoints(pool, input, maximum = pool.max) {
  const number = numberOr(input, null);
  if (number === null) return null;
  return pool.display === "percent" && pool.max > 0 ? number / 100 * maximum : number;
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
  return [...magic, ...custom].map(pool => ({
    ...pool, ...resourcePresentation(pool), scaled: !!pool.scaleStat,
    scalingChoices: Object.entries(RESOURCE_SCALING).map(([value, label]) => ({ value, label, selected: value === (pool.scaleStat ?? "") })),
    displayChoices: Object.entries(RESOURCE_DISPLAYS).map(([value, label]) => ({ value, label, selected: value === (pool.display ?? "number") }))
  }));
}

export function resourceRestUpdates(system) {
  const updates = {};
  for (const key of Object.keys(MAGIC_RESOURCES)) if (system[key]) updates[`system.${key}.spent`] = 0;
  for (const [id, data] of Object.entries(system.customResources ?? {})) {
    if (customResourceId(id) && data.refillOnRest) updates[`system.customResources.${id}.spent`] = 0;
  }
  return updates;
}
