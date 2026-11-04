// Foundry-free duration configuration; the v14 registry owns ticking/expiration.
import { numberOr } from "./core-numbers.mjs";

export const BONUS_DURATION_UNITS = Object.freeze({ rounds: "Rounds", minutes: "Minutes", hours: "Hours" });
export function bonusDuration(setting, combat = false) {
  if (combat && setting?.combatRounds != null && setting.combatRounds !== "") {
    setting = { value: setting.combatRounds, units: "rounds" };
  }
  const value = Math.max(0, Math.floor(numberOr(setting?.value, 0)));
  if (!value) return null;
  if (!Object.hasOwn(BONUS_DURATION_UNITS, setting?.units)) throw new Error("Choose rounds, minutes or hours for the bonus duration.");
  return { value, units: setting.units, expiry: setting.units === "rounds" ? "turnStart" : null, expired: false };
}
export function bonusDurationText(setting) {
  if (setting?.combatRounds != null && setting.combatRounds !== "") {
    const base = bonusDurationText({ value: setting.value, units: setting.units }) || "Until ended";
    const combat = bonusDurationText({ value: setting.combatRounds, units: "rounds" }) || "until ended";
    return `${base} · ${combat} in combat`;
  }
  const duration = bonusDuration(setting);
  if (!duration) return "";
  return `${duration.value} ${duration.units === "rounds" ? `round${duration.value === 1 ? "" : "s"}` : duration.units === "minutes" ? "min" : "hr"}`;
}
export function effectTimeLeft(effect) {
  if (!Number.isFinite(effect.duration?.value)) return "";
  return effect.duration.label
    ? `${effect.duration.label} left`
    : `${Math.max(0, Math.floor(effect.duration.remaining ?? effect.duration.value))} ${effect.duration.units} left`;
}
