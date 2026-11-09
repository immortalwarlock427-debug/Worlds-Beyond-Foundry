// Foundry-free healing from a targeted ability. Healing lowers damage taken toward full
// Health, including from below 0, and never raises Health past its maximum.
import { restorationPlan } from "./consumable-benefits.mjs";

export function healingFor(system, amount) {
  const healed = Math.max(0, Math.floor(Number(amount) || 0));
  const plan = restorationPlan(system, "health", healed);
  return { previous: plan.previous, next: plan.next, restored: plan.restored };
}

// Undo adds the healed amount back onto whatever damage the target has now, so damage
// taken after the heal stays.
export function undoHealing(currentDamage, restored) {
  return (Number(currentDamage) || 0) + Math.max(0, Number(restored) || 0);
}

export function healingLine(name, restored) {
  return restored > 0 ? `${name} heals ${restored}.` : `${name} is already at full Health.`;
}
