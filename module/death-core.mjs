// Foundry-free Death and Dying (Notion → Game Systems → Death and Dying, checked 2026-11-09).
import { numberOr } from "./core-numbers.mjs";

export const BLEED_OUT = 4;
export const STABILIZE_DC = 12;
export const STABILIZE_AP = 5;
export const stabilizeSuccess = (total, success = false) => success === true || (Number.isFinite(total) && total >= STABILIZE_DC);
export const TRAUMA_STEP = 5;

const vitality = system => numberOr(system?.stats?.vit?.effective ?? system?.stats?.vit?.value, 12);

// Level + current Vitality, 5 lower for each Trauma. It can reach 0 or below.
export function deathThreshold(system = {}) {
  return numberOr(system.level, 1) + vitality(system) - TRAUMA_STEP * Math.max(0, numberOr(system.dying?.trauma, 0));
}

// Dead at the negative of the Death Threshold. With a threshold of 0 or less, any Health
// below 0 kills (Trauma: "the next time you go below 0 you die").
export function isDead(health, threshold) {
  return threshold > 0 ? health <= -threshold : health < 0;
}

// Death's Mercy: a hit that takes you from 0 or above into the negative can't take you
// further below 0 than half your Death Threshold, rounded down. While already below 0,
// damage hits in full. Works on Health damage taken (Health = maximum − damage).
export function mercyDamage({ max = 0, previousDamage = 0, nextDamage = 0, threshold = 0 } = {}) {
  const before = max - previousDamage,
    after = max - nextDamage;
  if (!(threshold > 0) || before < 0 || after >= 0 || nextDamage <= previousDamage) return { damage: nextDamage, capped: false };
  const floor = -Math.floor(threshold / 2);
  return after < floor ? { damage: max - floor, capped: true, floor } : { damage: nextDamage, capped: false, floor };
}

// What a Health change means: falling to 0 or below knocks you out; rising from 0 or
// below to 1 or more is a recovery, which adds a Trauma (Notion Trauma).
export function healthTransition(before, after) {
  return {
    knockedOut: before > 0 && after <= 0,
    recovered: before <= 0 && after >= 1
  };
}

export function dyingSummary(system = {}) {
  const health = numberOr(system.health?.value, 0);
  const threshold = deathThreshold(system);
  return {
    health,
    threshold,
    diesAt: threshold > 0 ? -threshold : 0,
    trauma: Math.max(0, numberOr(system.dying?.trauma, 0)),
    stabilized: !!system.dying?.stabilized,
    down: health <= 0,
    dead: isDead(health, threshold),
    bleedingOut: health <= 0 && !system.dying?.stabilized && !isDead(health, threshold)
  };
}
