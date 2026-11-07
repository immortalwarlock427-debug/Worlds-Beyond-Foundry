// Foundry-free opportunity attack rules (Notion Defenses, Weapons Explained).
// An opportunity attack uses a reaction and no AP. Leaving an armed enemy's reach
// provokes one; a Bulwark weapon also lets you attack a creature that moves into
// your reach. Flicker (AGL 28) makes a creature immune to opportunity attacks.
import { numberOr } from "./core-numbers.mjs";

export const BASE_REACH_FEET = 5;
export const FLICKER_AGILITY = 28;

// Foundry token dispositions: friendly 1, neutral 0, hostile −1, secret −2.
export function opposed(a, b) {
  const side = value => (value === 1 ? "friendly" : value === -1 || value === -2 ? "hostile" : null);
  return !!side(a) && !!side(b) && side(a) !== side(b);
}

// Melee weapons held in hand. Ranged weapons and unequipped items threaten nothing.
export function threateningWeapons(items = []) {
  return Array.from(items?.values?.() ?? items).filter(
    item => item?.type === "weapon" && item.system?.equipped && !item.system?.ranged
  );
}

export const weaponReach = weapon => BASE_REACH_FEET + (weapon?.system?.properties?.reach ? 5 : 0);

// Gap between two tokens' footprints in grid spaces, counting any diagonal step as one
// space (reach on a grid: an adjacent diagonal square is within 5 ft).
export function spacesBetween(a, b) {
  const gap = (start, size, otherStart, otherSize) =>
    Math.max(0, otherStart - (start + size - 1), start - (otherStart + otherSize - 1));
  return Math.max(gap(a.i, a.w, b.i, b.w), gap(a.j, a.h, b.j, b.h));
}

export function inReach(attacker, position, reachFeet, gridFeet = 5) {
  return spacesBetween(attacker, position) <= Math.floor(numberOr(reachFeet, 0) / Math.max(1, numberOr(gridFeet, 5)) + 1e-6);
}

// Where a path leaves and enters a reach. `path` is every footprint the mover
// occupied, starting where it began. `exit` is the last position inside before the
// first step out (−1 if it never leaves); `enters` is true if any step comes in.
export function reachCrossings(attacker, path, reachFeet, gridFeet = 5) {
  const inside = (path ?? []).map(position => inReach(attacker, position, reachFeet, gridFeet));
  let exit = -1,
    enters = false;
  for (let k = 1; k < inside.length; k++) {
    if (inside[k - 1] && !inside[k] && exit < 0) exit = k - 1;
    if (!inside[k - 1] && inside[k]) enters = true;
  }
  return { exit, enters };
}

// The weapons a would-be attacker can use against this move. Your reach is your
// longest melee weapon's: stepping from 5 ft to 10 ft of a glaive wielder doesn't
// leave their reach, even if they also hold a dagger. When a creature does leave,
// any held weapon that reaches its last square inside your reach can make the attack.
export function opportunityWeapons({ attacker, path, weapons, gridFeet = 5 }) {
  if (!path?.length || !weapons?.length) return null;
  const reach = Math.max(...weapons.map(weaponReach));
  const { exit } = reachCrossings(attacker, path, reach, gridFeet);
  if (exit >= 0) {
    const usable = weapons.filter(weapon => inReach(attacker, path[exit], weaponReach(weapon), gridFeet));
    if (usable.length) return { kind: "leave", weapons: usable };
  }
  const bulwark = weapons.filter(
    weapon => weapon.system?.signature?.bulwark && reachCrossings(attacker, path, weaponReach(weapon), gridFeet).enters
  );
  return bulwark.length ? { kind: "enter", weapons: bulwark } : null;
}

export const immuneToOpportunity = agility => numberOr(agility, 0) >= FLICKER_AGILITY;
