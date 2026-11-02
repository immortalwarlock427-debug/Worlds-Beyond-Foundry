import { apAvailable, apSpendPlan } from "./ap.mjs";
export function inCombat(actor) {
  return !!game.combats?.some(combat => combat.started && combat.combatants.some(c => c.actor?.uuid === actor.uuid));
}
export function commandReady(actor) {
  const combats = Array.from(game.combats ?? []).filter(combat => combat.started && combat.combatants.some(c => c.actor?.uuid === actor.uuid));
  return !combats.length || combats.some(combat => combat.combatant?.actor?.uuid === actor.uuid);
}
export const availableAp = actor => apAvailable(actor.system, commandReady(actor));
export function planApPayment(actor, cost, { allowCommand = true } = {}) {
  const ready = allowCommand && commandReady(actor);
  try { return apSpendPlan(actor.system, cost, ready); }
  catch (error) {
    if (allowCommand && !ready && actor.system.command?.value > 0) throw new Error(`${error.message} Command AP can only be spent on your turn.`, { cause: error });
    throw error;
  }
}
export async function payAp(actor, cost, change, { allowCommand = true, updateOptions = {} } = {}) {
  if (!cost) return;
  const plan = planApPayment(actor, cost, { allowCommand });
  const updates = {}, restore = {};
  if (plan.fromOwn) { updates["system.ap.value"] = plan.own; restore["system.ap.value"] = actor.system.ap.value; }
  if (plan.fromGiven) { updates["system.command.value"] = plan.given; restore["system.command.value"] = actor.system.command.value; }
  await change(() => actor.update(updates, updateOptions), () => actor.update(restore, updateOptions));
  return plan;
}
