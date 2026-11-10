import { petrifiedResistance, blockedPetrifiedStatuses } from "./petrified-core.mjs";
import { resistantTo } from "./strike-core.mjs";

const SCOPE = "worlds-beyond";
export function petrifiedAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automatePetrified") !== false;
  } catch {
    return true;
  }
}
export const actorPetrified = actor => petrifiedAutomated() && petrifiedResistance(actor?.statuses ?? []);
export const actorResistantTo = (actor, damageType) => actorPetrified(actor) || resistantTo(actor?.system?.resistances, damageType);

export function blockedStatusApplication(actor, incoming, { existing = [], active = true, worldsBeyondCorrection = false } = {}) {
  return blockedPetrifiedStatuses({ petrified: !worldsBeyondCorrection && actorPetrified(actor), incoming, existing, active });
}

function notifyBlocked(actor, statuses) {
  if (statuses.length)
    ui.notifications.info(
      `${actor.name}: Petrified prevents new status effects (${statuses.join(", ")}). For a ruling, turn off Automate Petrified in world settings.`
    );
}
export function allowStatusApplication(actor, statuses, options = {}) {
  const blocked = blockedStatusApplication(actor, statuses, options);
  notifyBlocked(actor, blocked);
  return !blocked.length;
}

// Only live Actor-embedded status effects are applications. Item effect
// definitions and bonus-only effects remain editable and are never stripped.
const parentActor = effect => (effect.parent?.documentName === "Actor" ? effect.parent : null);
const active = effect => !effect.disabled && !effect.isSuppressed;

export function preventPetrifiedCreate(effect, data, options = {}) {
  const actor = parentActor(effect);
  if (!actor || !actorPetrified(actor)) return;
  if (!allowStatusApplication(actor, effect.statuses ?? [], { ...options, active: active(effect) })) return false;
}

export function preventPetrifiedUpdate(effect, changes, options = {}) {
  const actor = parentActor(effect);
  if (!actor) return;
  // Batch updates share options. Retain each source rather than letting another
  // effect's pre-hook overwrite whether this one used to apply Petrified.
  if (active(effect) && effect.statuses?.has("petrified")) {
    options.worldsBeyondPetrifiedBefore ??= [];
    if (!options.worldsBeyondPetrifiedBefore.includes(effect.uuid)) options.worldsBeyondPetrifiedBefore.push(effect.uuid);
  }
  if (!actorPetrified(actor) || options.worldsBeyondCorrection) return;
  // Native clone/updateSource applies v14 field operators without mutating the
  // live effect. Re-enabling a disabled/expired effect applies its statuses anew.
  const next = effect.clone(changes, { keepId: true });
  const existing = active(effect) ? (effect.statuses ?? []) : [];
  if (!allowStatusApplication(actor, next.statuses ?? [], { ...options, existing, active: active(next) })) return false;
}

async function reconcileHealth(effect, options, userId, deleted = false) {
  const actor = parentActor(effect);
  const wasPetrified = deleted ? effect.statuses?.has("petrified") : options.worldsBeyondPetrifiedBefore?.includes(effect.uuid);
  if (
    !wasPetrified ||
    !actor ||
    userId !== game.user.id ||
    actor.type !== "character" ||
    actor.statuses?.has("petrified") ||
    !(actor.system.health?.value <= 0)
  )
    return;
  // Immunity can prevent a new Unconscious icon while stone. On release, restore
  // the existing Health invariant without another knockout, Trauma or AP cost.
  const { deathAutomated, syncDying } = await import("./death.mjs");
  if (deathAutomated())
    await syncDying(
      actor,
      { worldsBeyondHealthBefore: actor.system.health.value, worldsBeyondDeathSync: true, worldsBeyondCorrection: true },
      {}
    );
}

export function registerPetrified() {
  game.settings.register(SCOPE, "automatePetrified", {
    name: "Automate Petrified",
    hint: "Petrified resists all damage and prevents new native Actor status effects. Existing conditions, bonus-only effects and manual tracker corrections remain. Off allows GM rulings; separate incapacitation settings still apply.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.on("preCreateActiveEffect", preventPetrifiedCreate);
  Hooks.on("preUpdateActiveEffect", preventPetrifiedUpdate);
  Hooks.on("updateActiveEffect", (effect, changes, options, userId) =>
    reconcileHealth(effect, options, userId).catch(error => ui.notifications.error(`Petrified recovery: ${error.message}`))
  );
  Hooks.on("deleteActiveEffect", (effect, options, userId) =>
    reconcileHealth(effect, options, userId, true).catch(error => ui.notifications.error(`Petrified recovery: ${error.message}`))
  );
}
