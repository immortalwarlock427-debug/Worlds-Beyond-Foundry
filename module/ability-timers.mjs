import { abilityClock, timerEffects, timerKind } from "./ability-timers-core.mjs";
import { bonusDuration } from "./effect-duration.mjs";
import { consumableDurationStart } from "./consumable-effects.mjs";
import { queuedAction } from "./action-support.mjs";
const options = { worldsBeyondAbilityTimers: true };

export function abilityTimerPlans(item) {
  const duration = bonusDuration(item.system.activeDuration);
  const cooldown = item.system.cooldown?.automatic ? bonusDuration({ value: item.system.cooldown.rounds, units: "rounds" }) : null;
  return Object.entries({ duration, cooldown }).filter(([, value]) => value).map(([kind, duration]) => ({ kind, duration }));
}
export function validateAbilityTimers(item, plans) { for (const plan of plans) consumableDurationStart(item.actor, plan.duration); }

export async function startAbilityTimers(item, plans, change) {
  const ids = { durationId: item.system.timers?.durationId ?? "", cooldownId: item.system.timers?.cooldownId ?? "" };
  for (const kind of ["duration", "cooldown"]) {
    const plan = plans.find(plan => plan.kind === kind);
    if (!plan) { await stopAbilityClock(item, kind, change); ids[`${kind}Id`] = ""; continue; }
    await stopAbilityClock(item, kind, change);
    const data = { name: `${item.name} · ${kind}`, img: item.img, disabled: false, transfer: false,
      system: { changes: [] }, duration: plan.duration, start: consumableDurationStart(item.actor, plan.duration),
      flags: { "worlds-beyond": { abilityTimer: kind } } };
    let created;
    await change(async () => { [created] = await item.createEmbeddedDocuments("ActiveEffect", [data], options); return created; }, () => created.delete(options));
    ids[`${kind}Id`] = created.id;
  }
  return ids;
}
export async function cleanupAbilityClocks(item) {
  const current = new Set(Object.values(item.system.timers ?? {}));
  const unused = timerEffects(item).filter(effect => !current.has(effect.id)).map(effect => effect.id);
  if (unused.length) await item.deleteEmbeddedDocuments("ActiveEffect", unused, options);
}
export async function stopAbilityClock(item, kind, change) {
  const effect = abilityClock(item, kind);
  if (effect && !effect.disabled) await change(() => effect.update({ disabled: true }, options), () => effect.update({ disabled: false }, options));
}

// Native clocks control expiry. Reconcile persistent flags once on the active GM;
// projections suppress expired bonuses immediately while that update is pending.
export async function reconcileAbilityTimers(item, deleted) {
  const actor = item?.actor;
  if (!game.users?.activeGM?.isSelf || actor?.type !== "character" || item.type !== "ability") return;
  return queuedAction(actor.uuid, async () => {
    if (actor.items.get(item.id) !== item) return;
    const updates = {};
    for (const kind of ["duration", "cooldown"]) {
      const clock = abilityClock(item, kind), id = item.system.timers?.[`${kind}Id`];
      const removed = (!!id && !clock) || (deleted && deleted.id === id);
      if (!removed && (!clock || (!clock.disabled && !clock.duration?.expired))) continue;
      const path = kind === "duration" ? "system.effectsActive" : "system.cooldown.remaining", value = kind === "duration" ? false : 0;
      if ((kind === "duration" ? item.system.effectsActive : item.system.cooldown.remaining) !== value) updates[path] = value;
      if (removed) updates[`system.timers.${kind}Id`] = "";
    }
    if (Object.keys(updates).length && !await item.update(updates, options)) throw new Error("Ability timer expiry could not be saved. Correct its active/cooldown tracker.");
  });
}
export function registerAbilityTimers() {
  const check = (effect, operation = {}, deleted = false) => {
    if (!timerKind(effect) || operation.worldsBeyondAbilityTimers) return;
    reconcileAbilityTimers(effect.parent, deleted ? effect : undefined).catch(error => ui.notifications.warn(error.message));
  };
  Hooks.on("updateActiveEffect", (effect, changes, operation) => check(effect, operation));
  Hooks.on("deleteActiveEffect", (effect, operation) => check(effect, operation, true));
  const resume = () => {
    const actors = new Set([...game.actors, ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)].filter(Boolean));
    for (const actor of actors) for (const item of actor.items) if (item.type === "ability") reconcileAbilityTimers(item).catch(error => ui.notifications.warn(error.message));
  };
  Hooks.once("ready", resume); Hooks.on("canvasReady", resume);
}
