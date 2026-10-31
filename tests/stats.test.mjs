// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { statModifier, milestonesReached, formatModifier } from "../module/stats.mjs";

// The modifier chart from the Notion Stats page, as [low, high, modifier].
const CHART = [
  [3, 5, -3], [6, 8, -2], [9, 11, -1], [12, 12, 0], [13, 15, 1], [16, 18, 2],
  [19, 21, 3], [22, 24, 4], [25, 27, 5], [28, 30, 6], [31, 33, 7], [34, 36, 8],
  [37, 39, 9], [40, 42, 10], [43, 45, 11], [46, 48, 12]
];

test("non-STR/DEX stats follow the modifier chart", () => {
  for (const key of ["vit", "agl", "int", "wis", "cha", "fth"]) {
    for (const [lo, hi, mod] of CHART) {
      for (let s = lo; s <= hi; s++) assert.equal(statModifier(key, s), mod, `${key} ${s}`);
    }
  }
});

test("STR and DEX use (score - 12) / 2 rounded down", () => {
  for (const key of ["str", "dex"]) {
    for (let s = 3; s <= 48; s++) assert.equal(statModifier(key, s), Math.floor((s - 12) / 2), `${key} ${s}`);
  }
  assert.equal(statModifier("str", 11), -1);
  assert.equal(statModifier("str", 13), 0);
  assert.equal(statModifier("dex", 21), 4);
  assert.equal(statModifier("dex", 28), 8);
});

test("milestones light at 21 and 28", () => {
  assert.equal(milestonesReached(20), 0);
  assert.equal(milestonesReached(21), 1);
  assert.equal(milestonesReached(27), 1);
  assert.equal(milestonesReached(28), 2);
});

test("modifier labels", () => {
  assert.equal(formatModifier(0), "+0");
  assert.equal(formatModifier(3), "+3");
  assert.equal(formatModifier(-2), "−2");
});
