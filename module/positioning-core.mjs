// Foundry-free positioning rules: who blocks movement, and whether a target is in
// a weapon's reach or range. Footprints are { i, j, w, h } in grid spaces.
import { numberOr } from "./core-numbers.mjs";
import { spacesBetween, weaponReach } from "./opportunity-core.mjs";

// Allies and downed creatures can be moved through, but you can't end your move in
// their square (Notion, Oct 2026). Enemies block. `others` are the other tokens:
// { name, footprint, enemy, downed }.
export function movementBlock(path, others = []) {
  const overlaps = (a, b) => spacesBetween(a, b) === 0;
  for (const position of path ?? []) {
    const enemy = others.find(other => other.enemy && !other.downed && overlaps(position, other.footprint));
    if (enemy) return { kind: "through", name: enemy.name };
  }
  const end = path?.at(-1);
  const occupant = end && others.find(other => overlaps(end, other.footprint));
  return occupant ? { kind: "end", name: occupant.name } : null;
}

export function blockMessage(block) {
  return block.kind === "through"
    ? `${block.name} is an enemy in the way. Go around it.`
    : `You can't end your move in ${block.name}'s space.`;
}

// How far an attack reaches in a mode: melee uses the weapon's reach; thrown and
// ranged use its normal and long range. Null when the weapon lists no range.
export function attackRange(weapon, mode = "melee") {
  if (mode === "melee") {
    const reach = weaponReach(weapon);
    return { normal: reach, long: reach };
  }
  const normal = numberOr(weapon?.system?.range?.normal, 0);
  const long = Math.max(normal, numberOr(weapon?.system?.range?.long, 0));
  return long > 0 ? { normal: normal || long, long } : null;
}

// "ok", "long" (past normal range: disadvantage) or "out".
export function rangeStatus(weapon, mode, distance) {
  const range = attackRange(weapon, mode);
  if (!range || !Number.isFinite(distance)) return "ok";
  if (distance > range.long) return "out";
  return distance > range.normal ? "long" : "ok";
}

export function rangeText(weapon, mode, distance, targetName = "The target") {
  const range = attackRange(weapon, mode);
  if (!range || !Number.isFinite(distance)) return "";
  const status = rangeStatus(weapon, mode, distance);
  const limit = mode === "melee" ? `reach ${range.long} ft` : `range ${range.normal}/${range.long} ft`;
  const out = mode === "melee" ? "Out of reach: move closer." : "Out of range: move closer.";
  const verdict = status === "out" ? out : status === "long" ? "Past normal range: disadvantage." : "In range.";
  return `${targetName} is ${distance} ft away · ${limit}. ${verdict}`;
}

// Where a creature that changes size can stand. Every placement of the new footprint
// that still covers its current one (or stays inside it, when shrinking) is a
// candidate; the nearest to the planned spot that overlaps no other token and stays
// inside `bounds` wins. Null when there's no room.
export function sizePlacement({ current, planned, others = [], bounds = null }) {
  const span = (start, size, next) => {
    const a = start,
      b = start + size - next;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const [iLow, iHigh] = span(current.i, current.w, planned.w);
  const [jLow, jHigh] = span(current.j, current.h, planned.h);
  const candidates = [];
  for (let i = iLow; i <= iHigh; i++)
    for (let j = jLow; j <= jHigh; j++) candidates.push({ i, j, w: planned.w, h: planned.h });
  const inside = c =>
    !bounds || (c.i >= bounds.i0 && c.j >= bounds.j0 && c.i + c.w - 1 <= bounds.i1 && c.j + c.h - 1 <= bounds.j1);
  const free = c => !others.some(other => spacesBetween(c, other) === 0);
  const distance = c => Math.abs(c.i - planned.i) + Math.abs(c.j - planned.j);
  return candidates.filter(c => inside(c) && free(c)).sort((a, b) => distance(a) - distance(b))[0] ?? null;
}
