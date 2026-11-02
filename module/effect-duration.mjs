// Foundry-free duration configuration; the v14 registry owns ticking/expiration.
import { numberOr } from "./core-numbers.mjs";

export const BONUS_DURATION_UNITS = Object.freeze({ rounds: "Rounds", minutes: "Minutes", hours: "Hours" });
export function bonusDuration(setting) {
  const value = Math.max(0, Math.floor(numberOr(setting?.value, 0)));
  if (!value) return null;
  if (!Object.hasOwn(BONUS_DURATION_UNITS, setting?.units)) throw new Error("Choose rounds, minutes or hours for the bonus duration.");
  return { value, units: setting.units, expiry: setting.units === "rounds" ? "turnStart" : null, expired: false };
}
export function bonusDurationText(setting) {
  const duration = bonusDuration(setting);
  if (!duration) return "";
  return `${duration.value} ${duration.units === "rounds" ? `round${duration.value === 1 ? "" : "s"}` : duration.units === "minutes" ? "min" : "hr"}`;
}
export function effectTimeLeft(effect) {
  if (!Number.isFinite(effect.duration?.value)) return "";
  return effect.duration.label ? `${effect.duration.label} left` : `${Math.max(0, Math.floor(effect.duration.remaining ?? effect.duration.value))} ${effect.duration.units} left`;
}
