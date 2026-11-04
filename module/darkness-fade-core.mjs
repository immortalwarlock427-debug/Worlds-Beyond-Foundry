// Presentation only: how long a scene takes to fade between light and dark.
export const DARKNESS_FADE_DEFAULT_SECONDS = 10;
export const DARKNESS_FADE_MAX_SECONDS = 60;

const DARKNESS_KEY = "environment.darknessLevel";

// Updates can arrive nested ({environment: {darknessLevel}}) or flattened ("environment.darknessLevel").
export function changesDarkness(changes) {
  if (!changes || typeof changes !== "object") return false;
  if (Object.hasOwn(changes, DARKNESS_KEY)) return true;
  const environment = changes.environment;
  return !!environment && typeof environment === "object" && Object.hasOwn(environment, "darknessLevel");
}

// The fade in milliseconds, or null to leave the update as it was sent (setting off or invalid).
export function darknessFadeMilliseconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(Math.min(value, DARKNESS_FADE_MAX_SECONDS) * 1000);
}
