// Native clock projections, without Foundry globals or stored-value mutation.
import { effectTimeLeft } from "./effect-duration.mjs";
export const timerKind = effect => effect.flags?.["worlds-beyond"]?.abilityTimer ?? "";
export const timerEffects = item => Array.from(item.effects?.values?.() ?? item.effects ?? []).filter(effect => timerKind(effect));
export function abilityClock(item, kind) { return timerEffects(item).find(effect => effect.id === item.system.timers?.[`${kind}Id`] && timerKind(effect) === kind); }
export function abilityActive(item) {
  const clock = abilityClock(item, "duration");
  return !!item.system.effectsActive && (!item.system.timers?.durationId || (!!clock && !clock.disabled && !clock.duration?.expired));
}
export function cooldownRemaining(item) {
  const clock = abilityClock(item, "cooldown");
  if (!clock) return item.system.timers?.cooldownId ? 0 : Number(item.system.cooldown?.remaining) || 0;
  if (clock.disabled || clock.duration?.expired) return 0;
  // A native round clock can reach zero before its owner's expiry event.
  return Math.max(1, Math.ceil(clock.duration?.remaining ?? clock.duration?.value ?? 0));
}
export function abilityTimeLeft(item) { const clock = abilityClock(item, "duration"); return abilityActive(item) && clock ? effectTimeLeft(clock) : ""; }

export function abilityTimerFormUpdates(item, data) {
  if (!data.system) return data;
  const system = data.system;
  if (system.effectsActive !== undefined) {
    if (!!system.effectsActive === abilityActive(item)) delete system.effectsActive;
    else { system.timers ??= {}; system.timers.durationId = ""; }
  }
  if (system.cooldown && Object.hasOwn(system.cooldown, "remaining")) {
    if (Number(system.cooldown.remaining) === Math.floor(cooldownRemaining(item))) delete system.cooldown.remaining;
    else { system.timers ??= {}; system.timers.cooldownId = ""; }
  }
  if (item.system.cooldown?.automatic && system.cooldown?.automatic === false) {
    system.cooldown.remaining ??= cooldownRemaining(item); system.timers ??= {}; system.timers.cooldownId = "";
  }
  return data;
}
