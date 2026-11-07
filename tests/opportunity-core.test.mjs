import { test } from "node:test";
import assert from "node:assert/strict";
import {
  opposed,
  threateningWeapons,
  weaponReach,
  spacesBetween,
  inReach,
  reachCrossings,
  opportunityWeapons,
  immuneToOpportunity
} from "../module/opportunity-core.mjs";

const at = (i, j, w = 1, h = 1) => ({ i, j, w, h });
const weapon = (id, { reach = false, bulwark = false, ranged = false, equipped = true } = {}) => ({
  id,
  type: "weapon",
  system: { equipped, ranged, properties: { reach }, signature: { bulwark } }
});

test("only friendly and hostile (or secret) tokens oppose each other", () => {
  assert.equal(opposed(1, -1), true);
  assert.equal(opposed(-2, 1), true);
  assert.equal(opposed(1, 1), false);
  assert.equal(opposed(-1, -2), false);
  assert.equal(opposed(0, -1), false);
});

test("held melee weapons threaten; Reach adds 5 ft", () => {
  const items = [
    weapon("sword"),
    weapon("bow", { ranged: true }),
    weapon("stowed", { equipped: false }),
    { type: "shield", system: { equipped: true } }
  ];
  assert.deepEqual(threateningWeapons(items).map(item => item.id), ["sword"]);
  assert.equal(weaponReach(weapon("glaive", { reach: true })), 10);
  assert.equal(weaponReach(weapon("sword")), 5);
});

test("reach counts diagonal neighbours and large footprints", () => {
  assert.equal(spacesBetween(at(5, 5), at(6, 6)), 1);
  assert.equal(spacesBetween(at(5, 5), at(7, 5)), 2);
  assert.equal(spacesBetween(at(5, 5, 2, 2), at(7, 7)), 1);
  assert.equal(inReach(at(5, 5), at(6, 6), 5), true);
  assert.equal(inReach(at(5, 5), at(7, 5), 5), false);
  assert.equal(inReach(at(5, 5), at(7, 5), 10), true);
});

test("leaving reach provokes; moving around inside it doesn't", () => {
  const attacker = at(5, 5);
  const away = [at(6, 5), at(7, 5), at(8, 5)];
  assert.deepEqual(opportunityWeapons({ attacker, path: away, weapons: [weapon("sword")] }), {
    kind: "leave",
    weapons: [weapon("sword")]
  });
  const around = [at(6, 5), at(6, 6), at(5, 6)];
  assert.equal(opportunityWeapons({ attacker, path: around, weapons: [weapon("sword")] }), null);
  // Passing through: enters and leaves in one move.
  const through = [at(7, 4), at(6, 5), at(7, 6)];
  assert.equal(reachCrossings(attacker, through, 5).exit, 1);
  assert.equal(opportunityWeapons({ attacker, path: through, weapons: [weapon("sword")] }).kind, "leave");
});

test("reach is the longest weapon's; only weapons reaching the last square inside can attack", () => {
  const attacker = at(5, 5);
  const glaive = weapon("glaive", { reach: true }),
    dagger = weapon("dagger");
  // 5 ft → 10 ft stays inside the glaive's reach.
  assert.equal(opportunityWeapons({ attacker, path: [at(6, 5), at(7, 5)], weapons: [glaive, dagger] }), null);
  // 10 ft → 15 ft leaves it; the dagger can't reach the 10 ft square.
  const offer = opportunityWeapons({ attacker, path: [at(7, 5), at(8, 5)], weapons: [glaive, dagger] });
  assert.deepEqual(offer.weapons.map(item => item.id), ["glaive"]);
  // 5 ft → 15 ft: the last square inside the glaive's reach is at 10 ft, out of the dagger's.
  assert.deepEqual(
    opportunityWeapons({ attacker, path: [at(6, 5), at(7, 5), at(8, 5)], weapons: [glaive, dagger] }).weapons.map(item => item.id),
    ["glaive"]
  );
});

test("Bulwark weapons attack a creature moving into reach", () => {
  const attacker = at(5, 5);
  const approach = [at(8, 5), at(7, 5), at(6, 5)];
  assert.equal(opportunityWeapons({ attacker, path: approach, weapons: [weapon("sword")] }), null);
  const offer = opportunityWeapons({ attacker, path: approach, weapons: [weapon("spear", { bulwark: true }), weapon("sword")] });
  assert.deepEqual([offer.kind, offer.weapons.map(item => item.id)], ["enter", ["spear"]]);
  const pike = weapon("pike", { bulwark: true, reach: true });
  assert.equal(opportunityWeapons({ attacker, path: [at(8, 5), at(7, 5)], weapons: [pike] }).kind, "enter");
});

test("Flicker (AGL 28) is immune", () => {
  assert.equal(immuneToOpportunity(28), true);
  assert.equal(immuneToOpportunity(27), false);
});
