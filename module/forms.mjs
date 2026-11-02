import { formEffect } from "./effects-core.mjs";
import { queuedAction, reversibleAction } from "./action-support.mjs";

// A form is an ability. Retain older actor-owned forms without rewriting saves.
export async function endOtherForms(actor, change, { itemId, effectId } = {}) {
  for (const item of actor.items?.values?.() ?? actor.items ?? []) {
    if (item.type !== "ability" || item.system.kind !== "form" || !item.system.effectsActive || item.id === itemId) continue;
    await change(() => item.update({ "system.effectsActive": false }), () => item.update({ "system.effectsActive": true }));
  }
  for (const effect of actor.effects?.values?.() ?? actor.effects ?? []) {
    if (!formEffect(effect) || effect.disabled || effect.id === effectId) continue;
    await change(() => effect.update({ disabled: true }), () => effect.update({ disabled: false }));
  }
}

export async function returnToBase(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () => reversibleAction(change => endOtherForms(actor, change)));
}
