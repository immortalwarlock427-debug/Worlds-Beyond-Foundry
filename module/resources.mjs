// Foundry-free resource math. Magic System uses current INT/FTH × (level + 2).
import { numberOr } from "./core-numbers.mjs";
import { STATS } from "./stats.mjs";
import { wholeDisplay } from "./number-display.mjs";

export const MAGIC_RESOURCES = Object.freeze({ mana: { label: "Mana", stat: "int" }, holyPower: { label: "Holy power", stat: "fth" } });
export const customResourceId = id => /^[A-Za-z0-9]{16}$/.test(id);
export const RESOURCE_SCALING = Object.freeze(
  Object.fromEntries([["", "Manual maximum"], ...STATS.map(stat => [stat.key, `${stat.label} (${stat.abbr})`])])
);
export const RESOURCE_DISPLAYS = Object.freeze({ number: "Points", percent: "Percentage" });

// Persist expenditure, not a prepared total. Max changes therefore change current
// by the same amount, without writes on render/reload or erasing manual corrections.
export function resourcePool(max, spent = 0, minimum = 0) {
  max = Math.max(0, numberOr(max, 0));
  return { min: numberOr(minimum, 0), max, value: max - numberOr(spent, 0) };
}

export function magicPool(level, score, data = {}) {
  const base = numberOr(score, 12) * (numberOr(level, 1) + 2);
  const bonus = numberOr(data.bonus, 0);
  const automatic = Math.max(0, base + bonus);
  return {
    ...resourcePool(numberOr(data.maxOverride, base) + bonus, data.spent, data.minOverride),
    automatic,
    allowOverflow: !!data.allowOverflow,
    ...(data.currentLimit != null ? { currentLimit: Math.max(0, numberOr(data.currentLimit, 0)) } : {})
  };
}

export function customPool(data = {}, { level = 1, stats = {} } = {}) {
  const stat = data.scaleStat && STATS.find(stat => stat.key === data.scaleStat);
  const base = stat
    ? numberOr(stats[stat.key]?.effective ?? stats[stat.key]?.value, 12) * (numberOr(level, 1) + 2)
    : numberOr(data.baseMax, 100);
  const bonus = numberOr(data.bonus, 0);
  return {
    ...resourcePool(numberOr(data.maxOverride, base) + bonus, data.spent, data.minOverride),
    automatic: Math.max(0, base + bonus),
    allowOverflow: !!data.allowOverflow,
    ...(data.currentLimit != null ? { currentLimit: Math.max(0, numberOr(data.currentLimit, 0)) } : {})
  };
}

// Token bar choices for a character's custom pools, listed by name after Foundry's own attributes.
export function customBarChoices(customResources) {
  return Object.entries(customResources ?? {})
    .filter(([id]) => customResourceId(id))
    .map(([id, pool]) => ({ group: "Worlds Beyond resources", value: `customResources.${id}`, label: pool?.name || "Custom resource" }));
}

export function applyFormMaximum(pool, spent, maximum, formName) {
  if (maximum == null) return pool;
  return { ...pool, normalMax: pool.max, max: maximum, currentLimit: maximum, value: maximum - numberOr(spent, 0), formName };
}

export function resourcePresentation(pool) {
  const percent = pool.display === "percent";
  const minimum = numberOr(pool.min, 0);
  const range = pool.max - minimum;
  const percentUnavailable = percent && !(range > 0);
  // Floor only presentation. Unchanged forms retain the exact point balance.
  const inputValue = Math.floor(percent && !percentUnavailable ? ((pool.value - minimum) / range) * 100 : pool.value);
  const meterPercent = range > 0 ? Math.max(0, Math.min(100, ((pool.value - minimum) / range) * 100)) : 0;
  return { percent, percentUnavailable, inputValue, meterPercent };
}

export function resourceInputPoints(pool, input, maximum = pool.max, minimum = numberOr(pool.min, 0)) {
  const parsed = numberOr(input, null);
  if (parsed === null) return null;
  const number = Math.floor(parsed);
  return pool.display === "percent" && pool.max > numberOr(pool.min, 0) ? minimum + (number / 100) * (maximum - minimum) : number;
}

export function poolSpentForCurrent(max, current) {
  const value = numberOr(current, null);
  // Clearing a current correction fills that pool, like the existing trackers.
  return value === null ? 0 : max - value;
}

export function boundedResourceCurrent(pool, value) {
  const ceiling = numberOr(pool.currentLimit, Infinity);
  if (!Number.isFinite(ceiling)) return value;
  const current = numberOr(pool.value, pool.max - numberOr(pool.damage ?? pool.spent, 0));
  return Math.min(value, Math.max(current, ceiling));
}

export function adjustedResourceSpent(pool, action, amount = 1) {
  if (action === "fill") return pool.max - Math.min(pool.max, numberOr(pool.currentLimit, Infinity));
  amount = numberOr(amount, null);
  if (amount === null || amount < 0) throw new Error("Enter a non-negative recovery amount.");
  if (!["spend", "restore", "recover"].includes(action)) throw new Error("Choose a resource action.");
  const spent = pool.max - pool.value;
  if (action === "spend") {
    if (amount > 0 && pool.value - amount < numberOr(pool.min, 0))
      throw new Error(
        `Not enough resource points: spending would go below the minimum (${numberOr(pool.min, 0)}). Correct Current or Minimum on the sheet if needed.`
      );
    return spent + amount;
  }
  const restored = pool.allowOverflow ? pool.value + amount : pool.value >= pool.max ? pool.value : Math.min(pool.max, pool.value + amount);
  return pool.max - boundedResourceCurrent(pool, restored);
}

export function resourceEntries(system) {
  const magic = Object.entries(MAGIC_RESOURCES)
    .filter(([key]) => system[key]?.enabled)
    .map(([key, def]) => ({
      key,
      label: def.label,
      path: `system.${key}`,
      custom: false,
      ...system[key]
    }));
  const custom = Object.entries(system.customResources ?? {})
    .filter(([id]) => customResourceId(id))
    .map(([key, data]) => ({
      key,
      label: data.name || "Resource",
      path: `system.customResources.${key}`,
      custom: true,
      ...data
    }));
  return [...magic, ...custom].map(pool => ({
    ...wholeDisplay(pool),
    ...resourcePresentation(pool),
    scaled: !!pool.scaleStat,
    scalingChoices: Object.entries(RESOURCE_SCALING).map(([value, label]) => ({
      value,
      label,
      selected: value === (pool.scaleStat ?? "")
    })),
    displayChoices: Object.entries(RESOURCE_DISPLAYS).map(([value, label]) => ({
      value,
      label,
      selected: value === (pool.display ?? "number")
    }))
  }));
}

export function resourceRestUpdates(system) {
  const updates = {};
  for (const key of Object.keys(MAGIC_RESOURCES)) if (system[key] && system[key].refillOnRest !== false) updates[`system.${key}.spent`] = 0;
  for (const [id, data] of Object.entries(system.customResources ?? {})) {
    if (customResourceId(id) && data.refillOnRest) updates[`system.customResources.${id}.spent`] = 0;
  }
  return updates;
}
