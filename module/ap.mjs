// Foundry-free AP payments. Command AP is separate and is spent first.
import { numberOr } from "./core-numbers.mjs";
export const commandAmount = modifier => Math.max(0, Math.min(5, 2 + numberOr(modifier, 0)));
export function apAvailable(system, commandReady = true) {
  return numberOr(system.ap?.value, 0) + (commandReady ? Math.max(0, numberOr(system.command?.value, 0)) : 0);
}
export function apSpendPlan(system, cost, commandReady = true) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Enter a non-negative AP cost.");
  if (apAvailable(system, commandReady) < cost) throw new Error(`Not enough AP: this costs ${cost}.`);
  const given = commandReady ? Math.max(0, numberOr(system.command?.value, 0)) : 0;
  const fromGiven = Math.min(given, cost);
  return { own: numberOr(system.ap?.value, 0) - (cost - fromGiven), given: given - fromGiven, fromGiven, fromOwn: cost - fromGiven };
}
export function commandTurn(system) {
  return { value: system.command?.fresh ? numberOr(system.command.value, 0) : 0, fresh: false };
}
