import { test } from "node:test";
import assert from "node:assert/strict";
import { coreNumbers, hitDieFor, numberOr, healthFromDamage, damageFromHealth } from "../module/core-numbers.mjs";

const stats = (vit = 12, agl = 12) => ({ vit: { value: vit }, agl: { value: agl } });

test("Health uses current VIT at every level, independently of hit die", () => {
  for (const [level, vit, health] of [[1, 12, 12], [5, 18, 90], [20, 28, 560], [3, 0, 0]]) {
    assert.equal(coreNumbers({ level, stats: stats(vit) }).healthMax, health);
  }
});

test("hit dice match every score in the Notion chart, including row boundaries", () => {
  const rows = [[3, 11, "1d4"], [12, 15, "1d6"], [16, 18, "1d8"], [19, 21, "1d10"],
    [22, 24, "1d12"], [25, 27, "1d12+1d4"], [28, 30, "1d12+1d6"], [31, 33, "1d12+1d8"],
    [34, 36, "1d12+1d10"], [37, 39, "2d12"], [40, 42, "2d12+1d4"], [43, 45, "2d12+1d6"], [46, 48, "2d12+1d8"]];
  for (const [low, high, die] of rows) {
    for (let vit = low; vit <= high; vit++) assert.equal(hitDieFor(vit), die, `VIT ${vit}`);
  }
});

test("AP increases at levels 5, 10, 15 and 20", () => {
  for (const [level, expected] of [[1, 15], [4, 15], [5, 17], [9, 17], [10, 19], [14, 19], [15, 21], [19, 21], [20, 23]]) {
    assert.equal(coreNumbers({ level }).apMax, expected, `level ${level}`);
  }
});

test("reactions follow current AGL at 21 and 28 in both directions", () => {
  for (const [agl, expected] of [[20, 1], [21, 2], [27, 2], [28, 3], [27, 2], [20, 1]]) {
    assert.equal(coreNumbers({ stats: stats(12, agl) }).reactionsMax, expected);
  }
});

test("Evasion and movement use the AGL modifier with the Notion 5 ft floor", () => {
  for (const [agl, movement, evasion] of [[3, 5, 9], [11, 5, 11], [12, 5, 12], [13, 10, 13], [18, 15, 14], [21, 20, 15], [28, 35, 18]]) {
    const core = coreNumbers({ stats: stats(12, agl), bonuses: { evasion: 2 } });
    assert.equal(core.movement, movement);
    assert.equal(core.evasion, evasion + 2);
  }
});

test("Armor Rating has a zero floor and uses Adamantine Body at current VIT 28", () => {
  for (const [vit, armor, expected] of [[3, 0, 0], [3, 5, 2], [18, 4, 6], [27, 4, 9], [28, 4, 18], [29, 4, 18], [30, 4, 19], [27, 4, 9]]) {
    assert.equal(coreNumbers({ stats: stats(vit), bonuses: { armor } }).armorRating, expected);
  }
});

test("blank overrides restore automatic values; zero, negatives and custom hit dice remain explicit", () => {
  const overrides = { healthMax: 0, apMax: 0, reactionsMax: 0, evasion: 0, armorRating: -1, movement: 0, hitDie: " 3d8+2 " };
  const core = coreNumbers({ overrides });
  assert.equal(core.healthMax, 0);
  assert.equal(core.apMax, 0);
  assert.equal(core.reactionsMax, 0);
  assert.equal(core.evasion, 0);
  assert.equal(core.armorRating, -1);
  assert.equal(core.movement, 0);
  assert.equal(core.hitDie, "3d8+2");
  for (const blank of [null, undefined, "", " "]) {
    const cleared = coreNumbers({ overrides: Object.fromEntries(Object.keys(overrides).map(key => [key, blank])) });
    assert.deepEqual(cleared, coreNumbers());
  }
  assert.equal(numberOr(NaN, 15), 15);
});

test("changing Health max preserves the damage deficit through increases, decreases and reloads", () => {
  const damage = damageFromHealth(60, 41);
  assert.equal(damage, 19);
  assert.equal(healthFromDamage(80, damage), 61);
  assert.equal(healthFromDamage(60, JSON.parse(JSON.stringify(damage))), 41);
  assert.equal(healthFromDamage(10, damage), -9);
  assert.equal(healthFromDamage(0, damage), -19);
  assert.equal(healthFromDamage(60, damageFromHealth(60, 0)), 0);
  assert.equal(healthFromDamage(60, damageFromHealth(60, 75)), 75);
});

test("calculating core numbers never changes the supplied character", () => {
  const data = { level: 5, stats: stats(18, 21), bonuses: { armor: 4 }, overrides: { apMax: 20 } };
  const before = structuredClone(data);
  assert.deepEqual(coreNumbers(data), coreNumbers(data));
  assert.deepEqual(data, before);
});
