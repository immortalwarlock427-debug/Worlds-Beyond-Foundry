// Foundry-free opt-in recovery plans. Existing notes are never parsed as rules.
import { numberOr } from "./core-numbers.mjs";
import { MAGIC_RESOURCES, customResourceId, adjustedResourceSpent } from "./resources.mjs";
export const USES_RECOVERY = Object.freeze({ manual: "Manual", longRest: "Long rest", combat: "New combat", turn: "Own turn" });
export function abilityRecoveryItems(items, event) {
  return Array.from(items?.values?.() ?? items ?? []).filter(item => {
    const uses = item.system?.uses;
    if (item.type !== "ability" || numberOr(uses?.max, null) === null) return false;
    const mode = uses.resetOn ?? "manual";
    return event === "longRest" ? mode !== "manual" && Object.hasOwn(USES_RECOVERY, mode)
      : event === "combat" ? ["combat", "turn"].includes(mode) : event === "turn" && mode === "turn";
  });
}
export function turnRecoveryUpdates(system) {
  const pools = [...Object.keys(MAGIC_RESOURCES).filter(key => system[key]?.enabled).map(key => [key, system[key], `system.${key}`]),
    ...Object.entries(system.customResources ?? {}).filter(([id]) => customResourceId(id)).map(([id, pool]) => [id, pool, `system.customResources.${id}`])];
  const updates = {};
  for (const [, pool, path] of pools) {
    if (!pool.autoRecover || !(numberOr(pool.regen, 0) > 0)) continue;
    const spent = adjustedResourceSpent(pool, "recover", pool.regen);
    if (spent !== pool.spent) updates[`${path}.spent`] = spent;
  }
  return updates;
}
export function hasTurnRecovery(system) {
  return [...Object.keys(MAGIC_RESOURCES).filter(key => system[key]?.enabled).map(key => system[key]),
    ...Object.entries(system.customResources ?? {}).filter(([id]) => customResourceId(id)).map(([, pool]) => pool)]
    .some(pool => pool.autoRecover && numberOr(pool.regen, 0) > 0);
}
export const newerRecoveryTurn = (previous, current) => !previous || current.round > (previous.round ?? 0)
  || (current.round === previous.round && current.turn > (previous.turn ?? -1));
