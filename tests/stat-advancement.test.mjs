import { test } from "node:test";
import assert from "node:assert/strict";
import { STATS } from "../module/stats.mjs";
import { STAT_ROLL_FORMULA, statAwards, statIncreases, validateStatAwards, assignStatResult, assignedStatUpdates } from "../module/stat-advancement.mjs";

test("Notion awards four points at 4/8/12/16/19, with no new award at 20 or beyond", () => {
  assert.equal(STAT_ROLL_FORMULA, "2d6 + 1d12");
  for (const [level, count] of [[1, 0], [3, 0], [4, 1], [7, 1], [8, 2], [12, 3], [16, 4], [18, 4], [19, 5], [20, 5], [100, 5]]) {
    const awards = statAwards(level);
    assert.equal(awards.length, count);
    assert.equal(awards.reduce((sum, award) => sum + award.remaining, 0), count * 4);
  }
});

test("each award is separate; lowering level suspends later choices without deleting them", () => {
  const data = { level4: { str: 2, dex: 2 }, level8: { str: 2, vit: 1 }, level19: { fth: 2 } };
  const copy = structuredClone(data);
  assert.equal(statIncreases(8, data).str, 4);
  assert.equal(statIncreases(7, data).str, 2);
  assert.equal(statIncreases(1, data).str, 0);
  assert.equal(statAwards(8, data)[1].remaining, 1);
  assert.deepEqual(data, copy);
});

test("award validation enforces four total, two per stat, whole points and earned levels", () => {
  validateStatAwards(4, { level4: { str: 2, dex: 2 } });
  validateStatAwards(4, { level4: { str: 1 } });
  for (const bad of [{ str: 3 }, { str: 2, dex: 2, vit: 1 }, { str: -1 }, { str: 1.5 }]) {
    assert.throws(() => validateStatAwards(4, { level4: bad }));
  }
  assert.throws(() => validateStatAwards(7, { level8: { str: 1 } }), /Reach level 8/);
  const suspended = { level8: { str: 2 } };
  validateStatAwards(4, suspended, {}, suspended);
});

test("guided point spending stops at natural 28 while reductions and existing manual exceptions remain possible", () => {
  const stats = { str: { value: 27 } };
  validateStatAwards(4, { level4: { str: 1 } }, stats);
  assert.throws(() => validateStatAwards(4, { level4: { str: 2 } }, stats), /reach 28/);
  validateStatAwards(4, { level4: { str: 1, dex: 2 } }, { str: { value: 40 } }, { level4: { str: 2 } });
});

test("result assignment swaps destinations without reusing a result, including duplicate totals", () => {
  const rows = STATS.map(stat => ({ stat: stat.key, score: 12 }));
  const swapped = assignStatResult(rows, 0, "dex");
  assert.equal(swapped[0].stat, "dex");
  assert.equal(swapped[1].stat, "str");
  assert.equal(new Set(swapped.map(row => row.stat)).size, 8);
  assert.equal(rows[0].stat, "str");
  assert.throws(() => assignStatResult(rows, 0, "unknown"));
});

test("applying rolled/typed bases clears selected manual edits but leaves blank stats, increases and resources alone", () => {
  const rows = STATS.map(stat => ({ stat: stat.key, score: null }));
  rows[0].score = 21; rows[1].score = 0;
  const updates = assignedStatUpdates(rows);
  assert.deepEqual(updates, {
    "system.stats.str.value": 21, "system.stats.str.manual": false, "system.stats.str.resetValue": null,
    "system.stats.dex.value": 0, "system.stats.dex.manual": false, "system.stats.dex.resetValue": null
  });
  assert.throws(() => assignedStatUpdates(rows.map(row => ({ ...row, score: null }))), /at least one/);
  assert.throws(() => assignedStatUpdates(rows.map(row => ({ ...row, score: 1.5 }))), /whole-number/);
  assert.throws(() => assignedStatUpdates(rows.map(row => ({ ...row, stat: "str" }))), /different stat/);
});
