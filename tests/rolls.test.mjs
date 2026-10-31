import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMode, wonderPool, wonderAction } from "../module/rolls.mjs";

test("check modes select one d20, the higher of two, or the lower of two", () => {
  assert.equal(checkMode().formula, "1d20 + @mod");
  assert.equal(checkMode("advantage").formula, "2d20kh1 + @mod");
  assert.equal(checkMode("disadvantage").formula, "2d20kl1 + @mod");
  assert.throws(() => checkMode("constructor"));
  assert.throws(() => checkMode("unknown"));
});

test("Wonder max follows FTH's modifier with no negative automatic uses", () => {
  for (const [faith, max] of [[3, 0], [11, 0], [12, 0], [13, 1], [15, 1], [16, 2], [20, 3], [21, 3], [22, 4], [28, 6]]) {
    assert.deepEqual(wonderPool(faith), { max, value: max });
  }
});

test("Wonder retains corrections and zero overrides; clearing refills to its maximum", () => {
  assert.deepEqual(wonderPool(21, { value: 0 }), { value: 0, max: 3 });
  assert.deepEqual(wonderPool(28, { value: 1 }), { value: 1, max: 6 });
  assert.deepEqual(wonderPool(12, { maxOverride: 5, value: null }), { value: 5, max: 5 });
  assert.deepEqual(wonderPool(28, { maxOverride: 0, value: -1 }), { value: -1, max: 0 });
  assert.deepEqual(wonderPool(13, { value: 10 }), { value: 10, max: 1 });
});

test("Defy Fate changes only checks/saves at current FTH 21; initiative always rerolls", () => {
  for (const kind of ["check", "save"]) {
    assert.equal(wonderAction(kind, 20), "reroll");
    assert.equal(wonderAction(kind, 21), "success");
    assert.equal(wonderAction(kind, 28), "success");
    assert.equal(wonderAction(kind, 20), "reroll");
  }
  assert.equal(wonderAction("initiative", 28), "reroll");
  assert.equal(wonderAction("attack", 28), null);
  assert.equal(wonderAction("damage", 28), null);
});
