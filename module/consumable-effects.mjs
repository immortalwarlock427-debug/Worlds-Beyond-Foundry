import { EFFECT_SCOPE, effectChanges, effectFlags } from "./effects-core.mjs";
import { bonusDuration } from "./effect-duration.mjs";

export function consumableDurationStart(actor, duration) {
  if (!duration) return null;
  const combat = Array.from(game.combats ?? []).find(combat => combat.started && combat.combatants.some(entry => entry.actor?.uuid === actor.uuid));
  if (duration.units === "rounds" && !combat) throw new Error("Round-based bonuses need a started encounter. Choose minutes or hours for a game-time duration.");
  const start = foundry.documents.ActiveEffect.implementation.getEffectStart(combat ?? null);
  if (combat) start.combatant = combat.combatants.find(entry => entry.actor?.uuid === actor.uuid).id;
  return start;
}

// Definitions stay on the consumable. Applied copies outlive the consumed item.
export function consumableBonusData(item) {
  const duration = bonusDuration(item.system?.bonusDuration);
  return Array.from(item.effects?.values?.() ?? item.effects ?? []).filter(effect => !effect.disabled).map(effect => ({
    name: effect.name || item.name, img: item.img || effect.img, description: effect.description || "", transfer: false, disabled: false,
    ...(duration ? { duration: { ...duration } } : {}),
    system: structuredClone(effect.system?.toObject?.() ?? { changes: effectChanges(effect) }),
    flags: { [EFFECT_SCOPE]: { ...effectFlags(effect), managed: true, kind: "effect", itemBound: false, source: item.name, consumableUse: { id: "", name: item.name } } }
  }));
}

export async function applyConsumableBonuses(actor, definitions, useId, change) {
  if (!definitions.length) return;
  if (Array.from(actor.effects?.values?.() ?? actor.effects ?? []).some(effect => !effect.disabled && !effect.duration?.expired && effectFlags(effect).consumableUse?.id === useId)) throw new Error("Bonuses from this card remain active. End them in Status before retrying.");
  const data = structuredClone(definitions);
  for (const effect of data) {
    effect.flags[EFFECT_SCOPE].consumableUse.id = useId;
    if (effect.duration) effect.start = consumableDurationStart(actor, effect.duration);
  }
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
