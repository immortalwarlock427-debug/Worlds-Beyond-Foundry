import { test } from "node:test";
import assert from "node:assert/strict";
import { movementBlock, blockMessage, attackRange, rangeStatus, rangeText, dialogBeside } from "../module/positioning-core.mjs";
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

test("a growing form takes the nearest free placement that covers its space, or none", async () => {
  const { sizePlacement } = await import("../module/positioning-core.mjs");
  const current = at(5, 5);
  // Centered growth isn't possible for 1 → 2, so the planned spot is the current corner.
  const planned = at(5, 5, 2, 2);
  assert.deepEqual(sizePlacement({ current, planned }), at(5, 5, 2, 2));
  // Someone stands to the right: grow to the left instead, staying as close as possible.
  assert.deepEqual(sizePlacement({ current, planned, others: [at(6, 5)] }), at(4, 5, 2, 2));
  // Neighbours on all four diagonals and sides: no room.
  const ring = [at(4, 4), at(5, 4), at(6, 4), at(4, 5), at(6, 5), at(4, 6), at(5, 6), at(6, 6)];
  assert.equal(sizePlacement({ current, planned, others: ring }), null);
  // One side open is enough.
  const openUpRight = ring.filter(o => !(o.i === 6 && o.j <= 5) && !(o.i === 5 && o.j === 4));
  assert.deepEqual(sizePlacement({ current, planned, others: openUpRight }), at(5, 4, 2, 2));
  // The map edge counts as blocked.
  const bounds = { i0: 0, j0: 0, i1: 20, j1: 20 };
  assert.deepEqual(sizePlacement({ current: at(0, 0), planned: at(0, 0, 2, 2), bounds }), at(0, 0, 2, 2));
  assert.deepEqual(
    sizePlacement({ current: at(20, 20), planned: at(20, 20, 2, 2), bounds }),
    at(19, 19, 2, 2)
  );
  // 1 → 3 grows evenly around the creature when it can.
  assert.deepEqual(sizePlacement({ current, planned: at(4, 4, 3, 3) }), at(4, 4, 3, 3));
});

test("the provoke warning opens beside the tokens instead of on top of them", () => {
  const view = { left: 60, top: 0, right: 1600, bottom: 900 };
  const size = { width: 400, height: 200 };
  const overlaps = (pos, box) =>
    pos.left < box.right && pos.left + size.width > box.left && pos.top < box.bottom && pos.top + size.height > box.top;
  // Tokens in the middle: more room on the right, so it goes there.
  const middle = { left: 700, top: 400, right: 800, bottom: 500 };
  assert.deepEqual(dialogBeside(middle, size, view), { left: 824, top: 350 });
  // Tokens near the right edge: it goes on the left.
  const right = { left: 1400, top: 100, right: 1550, bottom: 200 };
  const pos = dialogBeside(right, size, view);
  assert.equal(pos.left, 1400 - 24 - 400);
  assert.equal(pos.top, 50);
  assert.ok(!overlaps(pos, right));
  // A box nearly as wide as the screen: it goes above or below.
  const wide = { left: 100, top: 100, right: 1500, bottom: 300 };
  const under = dialogBeside(wide, size, view);
  assert.equal(under.top, 324);
  assert.ok(!overlaps(under, wide));
});
