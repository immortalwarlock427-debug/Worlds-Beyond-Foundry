import { queuedAction } from "./action-support.mjs";

const pendingRefills = new WeakMap();

// On the active GM, Foundry emits this hook after native turn-start effects finish.
// Other clients also receive the hook, but must not perform the document update.
export async function refillTurnResources(combat, previous, current) {
  const forward = previous && (current.round > previous.round
    || (current.round === previous.round && current.turn > previous.turn));
  if (!game.user.isActiveGM || !combat.started || !forward || current.round < 1) return;
  const combatant = combat.combatant;
  const actor = combatant?.actor; // Native resolution includes unlinked/synthetic actors.
  if (actor?.type !== "character" || combatant.id !== current.combatantId) return;
  const state = { round: current.round, turn: current.turn, combatantId: current.combatantId };
  const matches = () => combat.started && combat.current.round === state.round
    && combat.current.turn === state.turn && combat.current.combatantId === state.combatantId;
  if (!matches()) return;
  const key = `${state.round}:${state.turn}:${state.combatantId}`;
  const pending = pendingRefills.get(combat);
  if (pending?.key === key) return pending.operation;
  const operation = queuedAction(actor.uuid, async () => {
    // A fast Next Turn may move the tracker while an earlier action is pending.
    if (!game.user.isActiveGM || !matches()) return;
    try {
      const ap = actor.system.ap.max;
      const reactions = actor.system.reactions.max;
      if (!Number.isFinite(ap) || !Number.isFinite(reactions)) throw new Error("Invalid resource maximum.");
      const updated = await actor.update({ "system.ap.value": ap, "system.reactions.value": reactions });
      if (!updated) throw new Error("Resource update was cancelled.");
    } catch (error) {
      ui.notifications.error(`${actor.name}: AP/reactions could not be restored. Correct them on the sheet. ${error.message}`);
    }
  });
  const entry = { key, operation };
  pendingRefills.set(combat, entry);
  try { await operation; }
  finally { if (pendingRefills.get(combat) === entry) pendingRefills.delete(combat); }
}
