import { test } from "node:test";
import assert from "node:assert/strict";
import { healingFor, undoHealing, healingLine } from "../module/healing-core.mjs";

const hurt = (damage, max = 100) => ({ health: { damage, max, value: max - damage } });

test("healing lowers damage taken and stops at full Health", () => {
  assert.deepEqual(healingFor(hurt(30), 12), { previous: 30, next: 18, restored: 12 });
  assert.deepEqual(healingFor(hurt(5), 12), { previous: 5, next: 0, restored: 5 });
  assert.deepEqual(healingFor(hurt(0), 12), { previous: 0, next: 0, restored: 0 });
});

test("healing brings a character back up from below 0 Health", () => {
  // 110 damage on 100 maximum is -10 Health.
  assert.deepEqual(healingFor(hurt(110), 25), { previous: 110, next: 85, restored: 25 });
});

test("fractions and negative rolls heal whole numbers only", () => {
  assert.equal(healingFor(hurt(30), 7.9).restored, 7);
  assert.equal(healingFor(hurt(30), -4).restored, 0);
});

test("undo puts the healed amount back on top of damage taken since", () => {
  assert.equal(undoHealing(18, 12), 30);
  assert.equal(undoHealing(25, 12), 37);
  assert.equal(undoHealing(0, 0), 0);
});

test("card lines", () => {
  assert.equal(healingLine("Aran", 12), "Aran heals 12.");
  assert.equal(healingLine("Aran", 0), "Aran is already at full Health.");
});
