import { test } from "node:test";
import assert from "node:assert/strict";
import { exhaustionLevel, exhaustionEffects, exhaustionHealth } from "../module/exhaustion-core.mjs";
import { coreNumbers } from "../module/core-numbers.mjs";
import { movementCost } from "../module/movement-core.mjs";

test("all eleven exhaustion levels accumulate and replace only the weaker attack/AP effects", () => {
  for (let level = 0; level <= 10; level++) {
    assert.deepEqual(exhaustionEffects(level), {
      level,
      attackDie: level >= 5 ? "1d8" : level >= 1 ? "1d4" : "",
      apReduction: level >= 6 ? 4 : level >= 2 ? 2 : 0,
      checkDisadvantage: level >= 3,
      movementMultiplier: level >= 4 ? 2 : 1,
      defenseDisadvantage: level >= 7,
      halfHealth: level >= 8,
      forcedProne: level >= 9,
      collapse: level === 10
    });
  }
  assert.equal(exhaustionLevel(-5), 0);
  assert.equal(exhaustionLevel(99), 10);
  assert.equal(exhaustionLevel(4.9), 4);
  assert.equal(exhaustionLevel("invalid"), 0);
});

test("AP replacement and halved maximum apply before final manual overrides", () => {
  const stats = { vit: { value: 21 } };
  const max = exhaustion => coreNumbers({ level: 5, stats, exhaustion });
  assert.equal(max(1).apMax, 17);
  assert.equal(max(2).apMax, 15);
  assert.equal(max(5).apMax, 15);
  assert.equal(max(6).apMax, 13);
  assert.equal(max(7).healthMax, 105);
  assert.equal(max(8).healthMax, 52);
  const overridden = coreNumbers({ level: 5, stats, exhaustion: 10, overrides: { healthMax: 200, apMax: 22 } });
  assert.equal(overridden.healthMax, 200);
  assert.equal(overridden.apMax, 22);
});

test("changing exhaustion preserves Health below the cap and clips only excess, with level 10 dropping to zero", () => {
  assert.equal(exhaustionHealth({ health: 90, maximum: 50 }), 0);
  assert.equal(exhaustionHealth({ health: 30, maximum: 50 }), 20);
  assert.equal(exhaustionHealth({ health: -8, maximum: 50 }), 58);
  assert.equal(exhaustionHealth({ health: 50, maximum: 100 }), 50);
  assert.equal(exhaustionHealth({ health: 30, maximum: 50, collapse: true }), 50);
});

test("movement doubles before bank, Surge and paid AP, without assuming a Prone multiplier", () => {
  assert.equal(movementCost({ feet: 15, rate: 5 }).ap, 3);
  assert.equal(movementCost({ feet: 15, rate: 5, multiplier: 2 }).ap, 6);
  const cost = movementCost({ feet: 15, rate: 5, multiplier: 2, bank: 5, surgeLeft: 2 });
  assert.equal(cost.ap, 3);
  assert.equal(cost.surge, 2);
  assert.equal(cost.feet, 30);
});
