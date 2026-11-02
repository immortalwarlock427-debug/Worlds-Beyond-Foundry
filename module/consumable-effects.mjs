import { EFFECT_SCOPE, effectChanges, effectFlags } from "./effects-core.mjs";

// Definitions stay on the consumable. Applied copies outlive the consumed item.
export function consumableBonusData(item) {
  return Array.from(item.effects?.values?.() ?? item.effects ?? []).filter(effect => !effect.disabled).map(effect => ({
    name: effect.name || item.name, img: effect.img || item.img, description: effect.description || "", transfer: false, disabled: false,
    system: structuredClone(effect.system?.toObject?.() ?? { changes: effectChanges(effect) }),
    flags: { [EFFECT_SCOPE]: { ...effectFlags(effect), managed: true, kind: "effect", itemBound: false, source: item.name, consumableUse: { id: "", name: item.name } } }
  }));
}

export async function applyConsumableBonuses(actor, definitions, useId, change) {
  if (!definitions.length) return;
  if (Array.from(actor.effects?.values?.() ?? actor.effects ?? []).some(effect => !effect.disabled && effectFlags(effect).consumableUse?.id === useId)) throw new Error("Bonuses from this card remain active. End them in Status before retrying.");
  const data = structuredClone(definitions);
  for (const effect of data) effect.flags[EFFECT_SCOPE].consumableUse.id = useId;
  let created;
  await change(async () => {
    created = await actor.createEmbeddedDocuments("ActiveEffect", data);
    if (created.length !== data.length) {
      if (created.length) {
        const removed = await actor.deleteEmbeddedDocuments("ActiveEffect", created.map(effect => effect.id));
        if (removed.length !== created.length) throw new Error("Partial bonuses could not be removed. End them in Status before retrying this card.");
      }
      throw new Error("The consumable bonuses were not all applied. Try the card again.");
    }
    return created;
  }, async () => {
    const removed = await actor.deleteEmbeddedDocuments("ActiveEffect", created.map(effect => effect.id));
    return removed.length === created.length;
  });
}
