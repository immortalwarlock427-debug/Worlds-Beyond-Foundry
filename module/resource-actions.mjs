import { queuedAction } from "./action-support.mjs";
import { MAGIC_RESOURCES, customResourceId, magicPool, customPool, adjustedResourceSpent, poolSpentForCurrent, resourcePresentation, resourceInputPoints } from "./resources.mjs";

function resourcePath(system, key) {
  if (Object.hasOwn(MAGIC_RESOURCES, key) && system[key]) return `system.${key}`;
  if (customResourceId(key) && Object.hasOwn(system.customResources ?? {}, key)) return `system.customResources.${key}`;
  throw new Error("That resource no longer exists. Reopen the sheet.");
}

export function resourceFormUpdates(actor, data) {
  const values = data.resourceValues;
  delete data.resourceValues;
  if (!values) return data;
  let revised;
  for (const [key, current] of Object.entries(values)) {
    const path = resourcePath(actor.system, key);
    const pool = Object.hasOwn(MAGIC_RESOURCES, key) ? actor.system[key] : actor.system.customResources[key];
    // A whole-sheet submit must not save a displayed total after changing its stat/max.
    if (current !== "" && current != null && Number(current) === resourcePresentation(pool).inputValue) continue;
    if (current !== "" && current != null && !Number.isFinite(Number(current))) throw new Error("Enter a numeric resource total.");
    revised ??= actor.clone(data).system;
    const next = Object.hasOwn(MAGIC_RESOURCES, key) ? revised[key] : revised.customResources[key];
    foundry.utils.setProperty(data, `${path}.spent`, poolSpentForCurrent(next.max, resourceInputPoints(pool, current, next.max)));
  }
  return data;
}

export async function addResource(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, async () => {
    let id;
    do { id = foundry.utils.randomID(); } while (Object.hasOwn(actor.system.customResources ?? {}, id));
    const result = await actor.update({ [`system.customResources.${id}`]: {
      name: "Resource", baseMax: 100, spent: 0, bonus: 0, amount: 1, regen: 0, refillOnRest: true
    } });
    if (!result) throw new Error("The resource was not added. Try again.");
    return id;
  });
}

export async function resourceAction(actor, key, action, amount) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, async () => {
    const path = resourcePath(actor.system, key);
    const magic = Object.hasOwn(MAGIC_RESOURCES, key) ? MAGIC_RESOURCES[key] : null;
    const data = magic ? actor.system[key] : actor.system.customResources[key];
    if (action === "remove") {
      if (magic) throw new Error("Hide Mana or Holy power in resource settings instead.");
      const result = await actor.update({ [`system.customResources.${key}`]: new foundry.data.operators.ForcedDeletion() });
      if (!result) throw new Error("The resource was not removed.");
      return result;
    }
    const pool = magic ? magicPool(actor.system.level, actor.system.stats[magic.stat].effective ?? actor.system.stats[magic.stat].value, data) : customPool(data, actor.system);
    const spent = adjustedResourceSpent(pool, action, action === "recover" ? data.regen : amount ?? data.amount);
    if (spent === data.spent) return;
    const result = await actor.update({ [`${path}.spent`]: spent });
    if (!result) throw new Error("The resource update was cancelled. Try again.");
    return result;
  });
}
