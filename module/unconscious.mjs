import { unconsciousHeldGear, unconsciousCause, unconsciousWakes } from "./unconscious-core.mjs";
import { applyCondition, removeCondition } from "./conditions.mjs";
import { queuedAction } from "./action-support.mjs";

const SCOPE = "worlds-beyond";
const CAUSE = `flags.${SCOPE}.unconsciousCause`;
const active = effect => !effect.disabled && !effect.isSuppressed;
const parentActor = effect => (effect.parent?.documentName === "Actor" && effect.parent.type === "character" ? effect.parent : null);
export function unconsciousAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateUnconscious") !== false;
  } catch {
    return true;
  }
}
const causeOf = (effect, health) => unconsciousCause(effect.flags?.[SCOPE]?.unconsciousCause, health);

// Store the cause on each Actor effect, not on a global actor flag. A later
// knockout cannot inherit the cause of a deleted source.
export function prepareUnconsciousCreate(effect, data, options = {}) {
  const actor = parentActor(effect);
  if (!actor || !effect.statuses?.has("unconscious")) return;
  options.worldsBeyondAlreadyUnconscious = actor.statuses?.has("unconscious") ?? false;
  if (!effect.flags?.[SCOPE]?.unconsciousCause) effect.updateSource({ [CAUSE]: unconsciousCause(null, actor.system.health.value) });
}

export function prepareUnconsciousUpdate(effect, changes, options = {}) {
  const actor = parentActor(effect);
  if (!actor) return;
  const next = effect.clone(changes, { keepId: true });
  if (!next.statuses?.has("unconscious") || !active(next) || (effect.statuses?.has("unconscious") && active(effect))) return;
  options.worldsBeyondUnconsciousActivations ??= [];
  options.worldsBeyondUnconsciousActivations.push(effect.uuid);
  options.worldsBeyondAlreadyUnconscious ??= actor.statuses?.has("unconscious") ?? false;
  // Reactivating is a fresh knockout. An explicit cause correction wins.
  if (!foundry.utils.hasProperty(changes, CAUSE))
    foundry.utils.setProperty(changes, CAUSE, unconsciousCause(null, actor.system.health.value));
}

export async function dropUnconsciousGear(actor) {
  const held = unconsciousHeldGear(actor.items);
  if (!held.length) return [];
  const ids = held.map(item => item.id);
  try {
    await actor.updateEmbeddedDocuments(
      "Item",
      ids.map(_id => ({ _id, "system.equipped": false })),
      { worldsBeyondConditionDrop: true, worldsBeyondFormRestore: true }
    );
    if (ids.some(id => actor.items.get(id)?.system.equipped)) throw new Error("Some held gear stayed equipped.");
  } catch (error) {
    // A native batch may have partially saved. Restore only affected extant
    // records, without charging AP or normalizing unrelated hand/body slots.
    const restore = ids.filter(id => actor.items.has(id) && !actor.items.get(id).system.equipped);
    if (restore.length) {
      try {
        await actor.updateEmbeddedDocuments(
          "Item",
          restore.map(_id => ({ _id, "system.equipped": true })),
          { worldsBeyondFormRestore: true, worldsBeyondCorrection: true }
        );
      } catch {
        /* Verified below, with a correction message if incomplete. */
      }
    }
    const incomplete = ids.some(id => actor.items.has(id) && !actor.items.get(id).system.equipped);
    throw new Error(
      `${error.message} ${incomplete ? "Gear recovery also failed;" : "Held gear was retained;"} correct the dropped items on Equipment.`
    );
  }
  ui.notifications.info(
    `${actor.name} dropped: ${held.map(item => item.name).join(", ")}. Items remain on the sheet; retrieve and re-equip them manually.`
  );
  return ids;
}

export async function startUnconscious(effect, options = {}, userId, updated = false) {
  const actor = parentActor(effect);
  if (
    !actor ||
    userId !== game.user.id ||
    !unconsciousAutomated() ||
    options.worldsBeyondCorrection ||
    options.worldsBeyondAlreadyUnconscious ||
    !active(effect) ||
    !effect.statuses?.has("unconscious")
  )
    return;
  if (updated && !options.worldsBeyondUnconsciousActivations?.includes(effect.uuid)) return;
  return queuedAction(`unconscious:${actor.uuid}`, async () => {
    // Both consequences are independent; a failed drop must not prevent Prone.
    let failure;
    try {
      await applyCondition(actor, "prone");
    } catch (error) {
      failure = error;
    }
    try {
      await dropUnconsciousGear(actor);
    } catch (error) {
      failure = error;
    }
    if (failure) throw failure;
  });
}

export function prepareUnconsciousHealth(actor, changes, options = {}) {
  options.worldsBeyondUnconsciousHealth = (options.worldsBeyondUnconsciousHealth ?? []).filter(entry => entry.actorUuid !== actor.uuid);
  if (actor.type !== "character" || !unconsciousAutomated() || options.worldsBeyondCorrection || options.worldsBeyondDeathSync) return;
  const next = foundry.utils.getProperty(changes, "system.health.damage");
  if (next == null || !Number.isFinite(Number(next)) || !Number.isFinite(actor.system.health.damage)) return;
  options.worldsBeyondUnconsciousHealth.push({
    actorUuid: actor.uuid,
    damage: actor.system.health.damage,
    effects: Array.from(actor.effects?.values?.() ?? actor.effects ?? [])
      .filter(effect => active(effect) && effect.statuses?.has("unconscious"))
      .map(effect => ({ id: effect.id, cause: causeOf(effect, actor.system.health.value) }))
  });
}

// Called in the ordered death/Health pipeline before it enforces zero Health.
// Only effects present before this hit can wake; a new knockout is not erased.
export async function wakeUnconscious(actor, options = {}) {
  const before = options.worldsBeyondUnconsciousHealth?.find(entry => entry.actorUuid === actor.uuid);
  if (!before || !unconsciousAutomated() || options.worldsBeyondCorrection || options.worldsBeyondDeathSync) return;
  const waking = [];
  for (const saved of before.effects) {
    const effect = actor.effects.get(saved.id);
    if (!effect || !active(effect) || !effect.statuses?.has("unconscious")) continue;
    const health = actor.system.health;
    if (
      unconsciousWakes({
        cause: saved.cause,
        beforeDamage: before.damage,
        afterDamage: health.damage,
        afterHealth: health.value,
        damage: options.worldsBeyondDamage
      })
    )
      waking.push(effect.id);
    else if (options.worldsBeyondDamage && health.damage > before.damage && health.value <= 0 && saved.cause === "other")
      await effect.update({ [CAUSE]: "health" });
  }
  if (waking.length) await removeCondition(actor, "unconscious", { effectIds: waking });
}

export function registerUnconscious() {
  game.settings.register(SCOPE, "automateUnconscious", {
    name: "Automate Unconscious gear and waking",
    hint: "New Unconscious applications drop held weapons/shields without AP and leave Prone. Healing wakes; damage wakes positive-Health knockouts. Dropped items stay on the sheet for manual retrieval. Off allows manual rulings.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.on("preCreateActiveEffect", prepareUnconsciousCreate);
  Hooks.on("preUpdateActiveEffect", prepareUnconsciousUpdate);
  Hooks.on("preUpdateActor", prepareUnconsciousHealth);
  Hooks.on("createActiveEffect", (effect, options, userId) =>
    startUnconscious(effect, options, userId).catch(error => ui.notifications.error(`Unconscious: ${error.message}`))
  );
  Hooks.on("updateActiveEffect", (effect, changes, options, userId) =>
    startUnconscious(effect, options, userId, true).catch(error => ui.notifications.error(`Unconscious: ${error.message}`))
  );
}
