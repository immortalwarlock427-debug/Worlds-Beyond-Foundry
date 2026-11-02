// Foundry-free restoration targets and plans. Custom pools keep stable IDs.
import { MAGIC_RESOURCES, customResourceId } from "./resources.mjs";
import { numberOr } from "./core-numbers.mjs";

export function recoveryPool(system, key = "health") {
  if (key === "health") return { ...system.health, label: "Health", path: "system.health", health: true };
  if (Object.hasOwn(MAGIC_RESOURCES, key) && system[key]?.enabled) return { ...system[key], label: MAGIC_RESOURCES[key].label, path: `system.${key}` };
  if (customResourceId(key) && system.customResources?.[key]) return { ...system.customResources[key], label: system.customResources[key].name || "Resource", path: `system.customResources.${key}` };
  return null;
}

export function recoveryChoices(system, selected = "health") {
  const choices = [{ value: "health", label: "Health" }, ...Object.entries(MAGIC_RESOURCES).filter(([key]) => !system || system[key]?.enabled).map(([value, def]) => ({ value, label: def.label })),
    ...Object.entries(system?.customResources ?? {}).filter(([id]) => customResourceId(id)).map(([value, pool]) => ({ value, label: pool.name || "Resource" }))];
  if (selected && !choices.some(choice => choice.value === selected)) choices.push({ value: selected, label: "Missing or hidden resource" });
  return choices.map(choice => ({ ...choice, selected: choice.value === selected }));
}

export function restorationPlan(system, key, amount) {
  const pool = recoveryPool(system, key);
  if (!pool) throw new Error("That restoration resource is missing or hidden. Choose an available resource on the item.");
  amount = numberOr(amount, 0);
  if (amount < 0) throw new Error("Restoration cannot be negative.");
  const previous = pool.health ? numberOr(pool.damage, 0) : numberOr(pool.spent, pool.max - pool.value);
  const next = pool.allowOverflow ? previous - amount : previous <= 0 ? previous : Math.max(0, previous - amount);
  return { label: pool.label, path: `${pool.path}.${pool.health ? "damage" : "spent"}`, previous, next, restored: previous - next };
}

export function restorationAmount(total, unit, maximum) {
  const rolled = Math.max(0, numberOr(total, 0));
  return unit === "percent" ? rolled * Math.max(0, numberOr(maximum, 0)) / 100 : rolled;
}
