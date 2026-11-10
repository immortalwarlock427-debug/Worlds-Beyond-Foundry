import { conditionSource } from "./condition-sources-core.mjs";
import { resolveConditionSource, conditionSourceChoices } from "./condition-sources.mjs";

const SCOPE = "worlds-beyond";
export function charmedAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateCharmed") !== false;
  } catch {
    return true;
  }
}

// Resolve the exact token first. A deleted token never falls back to its world
// actor. Linked token copies share one creature; synthetic actors do not.
export function interactionActor(target) {
  const uuid = typeof target === "string" ? target : target?.tokenUuid || target?.actorUuid;
  if (!uuid) return null;
  try {
    const doc = globalThis.foundry?.utils?.fromUuidSync?.(uuid);
    return doc?.documentName === "Token" ? (doc.actor ?? null) : doc?.documentName === "Actor" ? doc : null;
  } catch {
    return null;
  }
}

export function isLinkedCharmer(charmed, charmer) {
  if (!charmed?.statuses?.has("charmed") || !charmer?.uuid) return false;
  return Array.from(charmed.effects?.values?.() ?? charmed.effects ?? []).some(effect => {
    if (!effect.statuses?.has("charmed") || effect.disabled || effect.isSuppressed || effect.duration?.expired) return false;
    const saved = conditionSource(effect, "charmed");
    return saved && resolveConditionSource(saved.uuid)?.actor.uuid === charmer.uuid;
  });
}

export function charmBlocksTarget(actor, target, { harmful = true, ignoreCharm = false } = {}) {
  return charmedAutomated() && harmful && !ignoreCharm && isLinkedCharmer(actor, interactionActor(target));
}

export function requireCharmedTargets(actor, targets, options) {
  if ((Array.isArray(targets) ? targets : [targets]).some(target => charmBlocksTarget(actor, target, options)))
    throw new Error(
      "Charmed prevents attacking or harming the linked charmer. Remove that target or select Ignore Charmed targeting for a GM ruling."
    );
}

export function charmInteractionAdvantage(actor, { interaction = false, interactionTarget = "" } = {}) {
  return charmedAutomated() && interaction === true && isLinkedCharmer(interactionActor(interactionTarget), actor);
}

export function charmOverrideAvailable(actor) {
  return charmedAutomated() && !!actor?.statuses?.has("charmed");
}
export function charmOverrideHTML(actor) {
  return charmOverrideAvailable(actor)
    ? '<label class="wb-check-toggle" data-tooltip="Charmed normally prevents targeting your linked charmer with attacks or harmful effects."><input type="checkbox" name="ignoreCharm"> Ignore Charmed targeting (GM ruling)</label>'
    : "";
}

export function interactionChoices() {
  if (!charmedAutomated()) return [];
  const current = Array.from(game.user?.targets ?? [])[0]?.document?.uuid;
  return conditionSourceChoices().map(choice => ({ ...choice, selected: choice.uuid === current }));
}

export function registerCharmed() {
  game.settings.register(SCOPE, "automateCharmed", {
    name: "Automate linked Charmed rules",
    hint: "Prevent attacks and harmful targeted abilities against a linked charmer, and give the charmer advantage on explicitly marked interaction checks. Per-action Ignore Charmed targeting and editable dice allow rulings. Unlinked or unresolved sources remain manual.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
