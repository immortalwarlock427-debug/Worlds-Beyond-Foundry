import { queuedAction, reversibleAction } from "./action-support.mjs";
import { abilityRecoveryItems, turnRecoveryUpdates, hasTurnRecovery, newerRecoveryTurn } from "./recovery-core.mjs";
const SCOPE = "worlds-beyond";

// Item resets compensate on failure. The actor update commits pool changes and
// the replay receipt together, last, so a failed receipt never grants recovery.
export async function recoverActor(actor, event, { updates = {}, combat, position, guard = () => true } = {}) {
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!actor.isOwner || !guard()) return;
      let events = [event],
        receipt;
      if (combat) {
        const session = combat.getFlag(SCOPE, "recoverySession") ?? "legacy";
        const history = actor.getFlag(SCOPE, "recovery") ?? {};
        const previous = history[combat.id]?.session === session ? history[combat.id] : null;
        if (event === "combat" && previous?.started) return;
        if (event === "turn" && !newerRecoveryTurn(previous, position)) return;
        if (event === "turn" && !previous?.started) events = ["combat", "turn"];
        receipt = {
          ...history,
          [combat.id]: { ...(previous ?? {}), session, started: true, ...(position ? { round: position.round, turn: position.turn } : {}) }
        };
      }
      const items = new Set(events.flatMap(event => abilityRecoveryItems(actor.items, event)));
      const changes = {
        ...(typeof updates === "function" ? updates() : updates),
        ...(event === "turn" ? turnRecoveryUpdates(actor.system) : {})
      };
      for (const item of items) {
        if (actor.items.get(item.id) !== item || !item.system.uses.spent) continue;
        const previous = item.system.uses.spent;
        await change(
          async () => (await item.update({ "system.uses.spent": 0 })) || (item.system.uses.spent === 0 && item),
          () => item.update({ "system.uses.spent": previous })
        );
      }
      if (!guard()) throw new Error("The encounter moved before recovery completed; the use resets were cancelled.");
      if (receipt) changes[`flags.${SCOPE}.recovery`] = receipt;
      const removed = [];
      if (event === "longRest" && globalThis.game?.user?.isGM && !actor.isToken && typeof game.combats?.has === "function") {
        for (const field of ["parryUses", "recovery"]) {
          for (const id of Object.keys(actor.getFlag(SCOPE, field) ?? {})) {
            if (!/^[A-Za-z0-9]{16}$/.test(id) || game.combats.has(id)) continue;
            changes[`flags.${SCOPE}.${field}.-=${id}`] = null;
            removed.push(`flags.${SCOPE}.${field}.${id}`);
          }
        }
      }
      if (!Object.keys(changes).length) return actor;
      await actor.update(changes);
      const saved = actor.toObject?.() ?? actor;
      if (
        removed.some(path => foundry.utils.getProperty(saved, path) !== undefined) ||
        Object.entries(changes).some(
          ([path, value]) => !path.includes(".-=") && JSON.stringify(foundry.utils.getProperty(saved, path)) !== JSON.stringify(value)
        )
      )
        throw new Error("Recovery was cancelled or not retained. Retry the event or correct its trackers.");
      return actor;
    })
  );
}

async function recoverCombatActor(actor, event, context) {
  if (actor?.type !== "character" || !game.user.isActiveGM) return;
  const configured = abilityRecoveryItems(actor.items, event).length || (event === "turn" && hasTurnRecovery(actor.system));
  if (!configured) return;
  const combat = context.combat,
    session = combat.getFlag(SCOPE, "recoverySession") ?? "legacy";
  const guarded = { ...context, guard: () => context.guard() && (combat.getFlag(SCOPE, "recoverySession") ?? "legacy") === session };
  try {
    return await recoverActor(actor, event, guarded);
  } catch (error) {
    ui.notifications.error(`${actor.name}: recovery could not complete. ${error.message}`);
  }
}
export async function recoverEncounter(combat) {
  if (!game.user.isActiveGM || !combat.started) return;
  const actors = new Map();
  for (const entry of combat.combatants) if (entry.actor) actors.set(entry.actor.uuid, entry.actor);
  await Promise.all(
    Array.from(actors.values(), actor =>
      recoverCombatActor(actor, "combat", { combat, guard: () => game.user.isActiveGM && combat.started })
    )
  );
}
export async function recoverTurn(combat, previous, current) {
  if (!game.user.isActiveGM || !combat.started || !previous || !newerRecoveryTurn(previous, current) || current.round < 1) return;
  const actor = combat.combatant?.actor,
    position = { round: current.round, turn: current.turn, combatantId: current.combatantId };
  const guard = () =>
    game.user.isActiveGM &&
    combat.started &&
    combat.current.round === position.round &&
    combat.current.turn === position.turn &&
    combat.current.combatantId === position.combatantId;
  if (combat.combatant?.id !== current.combatantId || !guard()) return;
  return recoverCombatActor(actor, "turn", { combat, position, guard });
}
export function registerRecovery() {
  Hooks.on("preUpdateCombat", (combat, changes) => {
    if ((combat.round ?? 0) < 1 && Number(changes.round) > 0)
      foundry.utils.setProperty(changes, `flags.${SCOPE}.recoverySession`, foundry.utils.randomID());
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (foundry.utils.hasProperty(changes, `flags.${SCOPE}.recoverySession`))
      recoverEncounter(combat).catch(error => ui.notifications.error(error.message));
  });
  Hooks.on("createCombatant", combatant => {
    if (combatant.parent.started)
      recoverCombatActor(combatant.actor, "combat", {
        combat: combatant.parent,
        guard: () => game.user.isActiveGM && combatant.parent.started
      });
  });
  Hooks.on("combatTurnChange", recoverTurn);
}
