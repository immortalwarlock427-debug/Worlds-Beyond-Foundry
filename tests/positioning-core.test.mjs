import { test } from "node:test";
import assert from "node:assert/strict";
import { movementBlock, blockMessage, attackRange, rangeStatus, rangeText } from "../module/positioning-core.mjs";
import { weaponReach, automaticReach } from "../module/opportunity-core.mjs";

const at = (i, j, w = 1, h = 1) => ({ i, j, w, h });
const other = (name, footprint, { enemy = false, downed = false } = {}) => ({ name, footprint, enemy, downed });
const weapon = system => ({
  type: "weapon",
  system: { properties: {}, signature: {}, range: { normal: 0, long: 0 }, reach: null, ...system }
});

test("enemies block the way; allies and downed enemies can be passed but not ended on", () => {
  const path = [at(6, 5), at(7, 5), at(8, 5)];
  assert.deepEqual(movementBlock(path, [other("Orc", at(7, 5), { enemy: true })]), { kind: "through", name: "Orc" });
  assert.equal(movementBlock(path, [other("Bram", at(7, 5))]), null);
  assert.equal(movementBlock(path, [other("Fallen orc", at(7, 5), { enemy: true, downed: true })]), null);
  assert.deepEqual(movementBlock(path, [other("Bram", at(8, 5))]), { kind: "end", name: "Bram" });
  const fallen = other("Fallen orc", at(8, 5), { enemy: true, downed: true });
  assert.deepEqual(movementBlock(path, [fallen]), { kind: "end", name: "Fallen orc" });
  // Large creatures block every square they cover; diagonal neighbours don't.
  assert.equal(movementBlock(path, [other("Ogre", at(7, 6, 2, 2), { enemy: true })])?.kind, undefined);
  assert.equal(movementBlock([at(6, 6), at(7, 6)], [other("Ogre", at(7, 6, 2, 2), { enemy: true })])?.kind, "through");
  assert.match(blockMessage({ kind: "through", name: "Orc" }), /enemy in the way/);
  assert.match(blockMessage({ kind: "end", name: "Bram" }), /can't end your move in Bram's space/);
});

test("a weapon's Reach field overrides the automatic 5 or 10 ft", () => {
  assert.equal(weaponReach(weapon({})), 5);
  assert.equal(weaponReach(weapon({ properties: { reach: true } })), 10);
  assert.equal(weaponReach(weapon({ reach: 15 })), 15);
  assert.equal(automaticReach(weapon({ reach: 15, properties: { reach: true } })), 10);
});

test("melee uses reach, thrown and ranged use normal/long range", () => {
  const sword = weapon({});
  assert.equal(rangeStatus(sword, "melee", 5), "ok");
  assert.equal(rangeStatus(sword, "melee", 10), "out");
  assert.match(rangeText(sword, "melee", 10, "Orc"), /Orc is 10 ft away · reach 5 ft\. Out of reach: move closer\./);
  const bow = weapon({ ranged: true, range: { normal: 60, long: 120 } });
  assert.deepEqual(attackRange(bow, "ranged"), { normal: 60, long: 120 });
  assert.equal(rangeStatus(bow, "ranged", 60), "ok");
  assert.equal(rangeStatus(bow, "ranged", 90), "long");
  assert.equal(rangeStatus(bow, "ranged", 125), "out");
  const dagger = weapon({ properties: { thrown: true }, range: { normal: 20, long: 40 } });
  assert.equal(rangeStatus(dagger, "melee", 20), "out");
  assert.equal(rangeStatus(dagger, "thrown", 20), "ok");
  // No listed range, or no distance (no token on the map): never blocks.
  assert.equal(rangeStatus(weapon({ ranged: true }), "ranged", 500), "ok");
  assert.equal(rangeStatus(sword, "melee", null), "ok");
  assert.equal(rangeText(sword, "melee", null), "");
});
