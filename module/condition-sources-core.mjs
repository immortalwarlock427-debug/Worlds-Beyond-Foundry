export const CONDITION_SOURCE_TYPES = Object.freeze({ grappled: "Grappled", fear: "Frightened", charmed: "Charmed" });
export const sourceConditions = effect => [...(effect?.statuses ?? [])].filter(id => Object.hasOwn(CONDITION_SOURCE_TYPES, id));
export const validConditionSourceUuid = uuid => typeof uuid === "string" && /^(Actor\.[\w-]+|Scene\.[\w-]+\.Token\.[\w-]+)$/.test(uuid);

export function conditionSource(effect, id) {
  if (!Object.hasOwn(CONDITION_SOURCE_TYPES, id)) return null;
  const saved = effect?.flags?.["worlds-beyond"]?.conditionSources?.[id];
  return validConditionSourceUuid(saved?.uuid)
    ? {
        uuid: saved.uuid,
        name: String(saved.name ?? "")
          .trim()
          .slice(0, 200)
      }
    : null;
}

export const conditionSourceText = effect =>
  sourceConditions(effect)
    .flatMap(id => {
      const source = conditionSource(effect, id);
      return source ? [`${CONDITION_SOURCE_TYPES[id]} from ${source.name || "linked source"}`] : [];
    })
    .join(" · ");

// A check's DC is frozen at roll time. A later Wonder reroll must not clear a
// source that was replaced on the same effect record in the meantime.
export function sameGrappleSource(effect, snapshots) {
  if (!snapshots) return true; // Cards created before source tracking.
  return Object.hasOwn(snapshots, effect.id) && snapshots[effect.id] === (conditionSource(effect, "grappled")?.uuid ?? "");
}
