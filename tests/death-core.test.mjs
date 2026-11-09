import { test } from "node:test";
import assert from "node:assert/strict";
import { deathThreshold, isDead, mercyDamage, healthTransition, dyingSummary } from "../module/death-core.mjs";

const sheet = ({ level = 5, vit = 21, trauma = 0, health = 10, max = 100, stabilized = false } = {}) => ({
  level,
  stats: { vit: { value: vit, effective: vit } },
  dying: { trauma, stabilized },
  health: { value: health, max, damage: max - health }
});

test("Death Threshold is level + Vitality, 5 lower per Trauma", () => {
  assert.equal(deathThreshold(sheet()), 26); // Notion's example: level 5, 21 VIT, dies at -26
  assert.equal(deathThreshold(sheet({ trauma: 2 })), 16);
  assert.equal(deathThreshold(sheet({ level: 1, vit: 9, trauma: 2 })), 0);
});

test("death comes at the negative of the threshold, or below 0 once Trauma reaches 0", () => {
  assert.equal(isDead(-25, 26), false);
  assert.equal(isDead(-26, 26), true);
  assert.equal(isDead(0, 0), false);
  assert.equal(isDead(-1, 0), true);
  assert.equal(isDead(-1, -5), true);
});

test("Death's Mercy caps the hit that goes below 0 at half the threshold", () => {
  // Threshold 20: a hit that would reach -15 only reaches -10 (Notion's example).
  assert.deepEqual(mercyDamage({ max: 100, previousDamage: 100, nextDamage: 115, threshold: 20 }), {
    damage: 110,
    capped: true,
    floor: -10
  });
  // From positive Health too.
  assert.equal(mercyDamage({ max: 100, previousDamage: 90, nextDamage: 130, threshold: 20 }).damage, 110);
  // 5 then 15: the first hit isn't capped and the second hits in full while already negative.
  assert.equal(mercyDamage({ max: 100, previousDamage: 100, nextDamage: 105, threshold: 20 }).damage, 105);
  assert.equal(mercyDamage({ max: 100, previousDamage: 105, nextDamage: 120, threshold: 20 }).damage, 120);
  // No threshold left: no mercy.
  assert.equal(mercyDamage({ max: 100, previousDamage: 100, nextDamage: 140, threshold: 0 }).damage, 140);
  // Healing passes through.
  assert.equal(mercyDamage({ max: 100, previousDamage: 120, nextDamage: 90, threshold: 20 }).damage, 90);
});

test("falling to 0 knocks out; rising to 1 or more after is a recovery", () => {
  assert.deepEqual(healthTransition(5, 0), { knockedOut: true, recovered: false });
  assert.deepEqual(healthTransition(-4, 0), { knockedOut: false, recovered: false });
  assert.deepEqual(healthTransition(0, 1), { knockedOut: false, recovered: true });
  assert.deepEqual(healthTransition(-8, 12), { knockedOut: false, recovered: true });
  assert.deepEqual(healthTransition(3, 9), { knockedOut: false, recovered: false });
});

test("dying summary", () => {
  assert.deepEqual(dyingSummary(sheet({ health: -10 })), {
    health: -10,
    threshold: 26,
    diesAt: -26,
    trauma: 0,
    stabilized: false,
    down: true,
    dead: false,
    bleedingOut: true
  });
  assert.equal(dyingSummary(sheet({ health: -10, stabilized: true })).bleedingOut, false);
  assert.equal(dyingSummary(sheet({ health: -30 })).dead, true);
  assert.equal(dyingSummary(sheet({ health: 0 })).down, true);
});
