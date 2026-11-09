import { exhaustionEffects, exhaustionLevel, exhaustionSummary, exhaustionHealth } from "./exhaustion-core.mjs";
import { coreNumbers } from "./core-numbers.mjs";
import { applyCondition } from "./conditions.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";

const SCOPE = "worlds-beyond";
export function exhaustionAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateExhaustion") !== false;
  } catch {
    return true;
  }
}
export const actorExhaustion = actor => exhaustionEffects(exhaustionAutomated() ? actor?.system?.exhaustion : 0);
export const exhaustionMode = (actor, kind) => {
  const e = actorExhaustion(actor);
  return (kind === "check" ? e.checkDisadvantage : e.defenseDisadvantage) ? "disadvantage" : "normal";
};
export const exhaustionAttackDie = (actor, enabled = true) => (enabled ? actorExhaustion(actor).attackDie : "");

export function overexertTurn(actor) {
  const combats = Array.from(globalThis.game?.combats ?? []);
  const combat = combats.find(c => c.started && c.combatant?.actor?.uuid === actor.uuid);
  return combat ? `${combat.id}:${combat.round}:${combat.turn}` : null;
}

export function exhaustionContext(actor) {
  const level = exhaustionLevel(actor.system.exhaustion);
  const key = overexertTurn(actor);
  return {
    level,
    summary: exhaustionSummary(level),
    automated: exhaustionAutomated(),
    ready: !!key && actor.getFlag?.(SCOPE, "overexertTurn") !== key && level < 10
  };
}

export async function overexert(actor) {
  if (!actor?.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!exhaustionAutomated()) throw new Error("Exhaustion automation is off; correct AP and exhaustion manually.");
      const key = overexertTurn(actor);
      if (!key) throw new Error("Overexert is available on your own turn in a started encounter.");
      const previousKey = actor.getFlag?.(SCOPE, "overexertTurn");
      if (previousKey === key) throw new Error("Overexert was already used this turn.");
      const level = exhaustionLevel(actor.system.exhaustion);
      if (level >= 10) throw new Error("Exhaustion is already at level 10.");
      const ap = actor.system.ap.value;
      const health = actor.system.health.damage;
      await change(
        () => actor.update({ "system.exhaustion": level + 1, "system.ap.value": ap + 5, [`flags.${SCOPE}.overexertTurn`]: key }),
        () =>
          actor.update(
            {
              "system.exhaustion": level,
              "system.ap.value": ap,
              "system.health.damage": health,
              ...(previousKey == null ? { [`flags.${SCOPE}.-=overexertTurn`]: null } : { [`flags.${SCOPE}.overexertTurn`]: previousKey })
            },
            { worldsBeyondCorrection: true }
          )
      );
      return createActionMessage({
        speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
        content: `<div class="worlds-beyond wb-ability-card"><h3>Overexert</h3><p>+5 AP · Exhaustion ${level} → ${level + 1}</p></div>`,
        flags: { [SCOPE]: { sheetActivity: { actorUuid: actor.uuid, label: "Overexert" } } }
      });
    })
  );
}

export function prepareExhaustionUpdate(actor, changes, options) {
  if (actor.type !== "character" || !exhaustionAutomated()) return;
  const get = path => foundry.utils.getProperty(changes, path);
  const next = get("system.exhaustion");
  if (next == null || exhaustionLevel(next) === exhaustionLevel(actor.system.exhaustion)) return;
  const e = exhaustionEffects(next);
  const s = actor.system;
  const healthOverride = get("system.health.maxOverride");
  const maximum = coreNumbers({
    level: get("system.level") ?? s.level,
    stats: s.stats,
    exhaustion: e.level,
    overrides: { healthMax: healthOverride === undefined ? s.health.maxOverride : healthOverride }
  }).healthMax;
  // Explicit Health changes (long rest/healing/GM corrections) take priority.
  if (get("system.health.damage") == null && !options.worldsBeyondCorrection) {
    options.worldsBeyondHealthBefore = s.health.value;
    foundry.utils.setProperty(changes, "system.health.damage", exhaustionHealth({ health: s.health.value, maximum, collapse: e.collapse }));
  }
  if (e.collapse && !options.worldsBeyondCorrection) {
    foundry.utils.setProperty(changes, "system.health.damage", maximum);
    foundry.utils.setProperty(changes, "system.dying.stabilized", false);
  }
}

export async function syncExhaustion(actor) {
  if (actorExhaustion(actor).forcedProne && !actor.statuses?.has("prone"))
    await applyCondition(actor, "prone", { sourceName: "Exhaustion" });
  // Dropping below 9 permits standing; it does not stand the character automatically.
}

export function registerExhaustion() {
  game.settings.register(SCOPE, "automateExhaustion", {
    name: "Automate exhaustion",
    hint: "Apply exhaustion's attack, AP, roll, movement, Health and condition effects. Off keeps only the editable tracker. Restart clients after changing.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });
  Hooks.on("preUpdateActor", prepareExhaustionUpdate);
  Hooks.on("combatTurnChange", combat => {
    // A full pool can make turn refill a no-op, but Overexert's button still needs
    // to become available on the new turn (and unavailable off-turn).
    for (const combatant of combat.combatants ?? []) combatant.actor?.render?.(false);
  });
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (
      actor.type !== "character" ||
      userId !== game.user.id ||
      options.worldsBeyondCorrection ||
      !foundry.utils.hasProperty(changes, "system.exhaustion")
    )
      return;
    syncExhaustion(actor).catch(error => ui.notifications.error(`Exhaustion: ${error.message}`));
  });
}
