// One use rolls the current hit-die formula plus VIT, including compound hit dice.
export function hitDicePool(system) {
  const max = Math.max(0, Math.floor(Number(system.level) || 0));
  const spent = Math.max(0, Math.floor(Number(system.hitDice?.spent) || 0));
  return { max, spent, remaining: Math.max(0, max - spent) };
}

export function restDiceCount(system, value = 1) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 1) throw new Error("Choose at least 1 hit-die use.");
  if (count > hitDicePool(system).remaining) throw new Error("Not enough hit-die uses left. Take a long rest or correct Hit dice spent.");
  return count;
}

export function shortRestHealing(system, totals) {
  const count = restDiceCount(system, totals.length);
  if (!totals.every(Number.isFinite)) throw new Error("The healing roll has no valid total.");
  const before = Number(system.health.damage);
  if (!Number.isFinite(before)) throw new Error("Correct your Health before resting.");
  const rolled = totals.reduce((sum, total) => sum + Math.max(0, Math.floor(total)), 0);
  const damage = before > 0 ? Math.max(0, before - rolled) : before;
  const pool = hitDicePool(system),
    spent = pool.spent + count;
  return { count, rolled, healed: Math.max(0, before - damage), damage, spent, max: pool.max, remaining: Math.max(0, pool.max - spent) };
}
