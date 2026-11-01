import { test } from "node:test";
import assert from "node:assert/strict";
import { STATS } from "../module/stats.mjs";

class Application {
  async _prepareContext() { return {}; }
  async render() { this.rendered = true; return this; }
  async close() { this.rendered = false; }
}
const rolls = [];
let failRoll = false;
globalThis.foundry = {
  applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: base => base } },
  dice: { Roll: class {
    constructor(formula) { assert.equal(formula, "2d6 + 1d12"); }
    async evaluate(options) {
      assert.deepEqual(options, { allowInteractive: false });
      if (failRoll) throw new Error("roll failed");
      this.dice = [{ results: [{ result: 4 }, { result: 5 }] }, { results: [{ result: 10 }] }];
      this.total = 19; rolls.push(this); return this;
    }
  } }
};
const { StatSetup, saveStatSetup } = await import("../module/stat-setup.mjs");
let serial = 0;
function actor(level = 8) {
  const source = { level, stats: Object.fromEntries(STATS.map(stat => [stat.key, { value: 12, manual: false, resetValue: null }])), advancement: {} };
  const updates = [];
  return { uuid: `Actor.${++serial}`, isOwner: true, source, updates,
    system: { level, toObject: () => structuredClone(source) },
    async update(data) {
      updates.push(structuredClone(data));
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".").slice(1), last = parts.pop();
        const parent = parts.reduce((object, key) => object[key] ??= {}, source);
        parent[last] = value;
      }
      return this;
    }
  };
}

test("roll one, fill remaining and reroll eight stay local until explicit Apply", async () => {
  rolls.length = 0;
  const a = actor(), app = new StatSetup(a);
  await app.rollScores(true);
  assert.equal(rolls.length, 1);
  assert.equal(app.rows[0].score, 19);
  assert.equal(app.rows[0].dice, "4 + 5 + 10");
  await app.rollScores();
  assert.equal(rolls.length, 8);
  await app.rollScores();
  assert.equal(rolls.length, 16);
  assert.equal(a.updates.length, 0);
  await app.apply();
  assert.equal(a.updates.length, 1);
  assert.equal(a.source.stats.str.value, 19);
  assert.equal(a.source.stats.str.manual, false);
});

test("failed rolling keeps the old draft and releases the busy state", async () => {
  const a = actor(), app = new StatSetup(a);
  app.rows[0].score = 21;
  failRoll = true;
  try { await assert.rejects(app.rollScores(), /roll failed/); }
  finally { failRoll = false; }
  assert.equal(app.busy, false);
  assert.equal(app.rows[0].score, 21);
  assert.equal(a.updates.length, 0);
});

test("award draft previews totals, enforces limits at save and writes only allocations", async () => {
  const a = actor(), app = new StatSetup(a, "advancement");
  app.advancement = { level4: { str: 2, dex: 2 }, level8: { str: 2 } };
  app.selectedLevel = 8;
  const context = await app._prepareContext({});
  assert.equal(context.award.remaining, 2);
  assert.equal(context.stats[0].total, 16);
  assert.equal(context.stats[0].canAdd, false);
  await app.apply();
  assert.equal(a.source.stats.str.value, 12);
  assert.equal(a.source.advancement.level8.str, 2);
  assert.equal(Object.keys(a.updates[0]).some(key => !key.startsWith("system.advancement.")), false);
  const bad = new StatSetup(a, "advancement");
  bad.advancement.level8 = { str: 2, dex: 2, vit: 1 };
  await assert.rejects(bad.apply(), /4 stat points/);
  assert.equal(a.updates.length, 1);
});

test("permission loss, stale stats and duplicate saves cannot overwrite a newer character", async () => {
  const a = actor(), app = new StatSetup(a);
  a.isOwner = false;
  await assert.rejects(saveStatSetup(a, app.baseline, { "system.stats.str.value": 21 }), /permission/);
  a.isOwner = true;
  const results = await Promise.allSettled([
    saveStatSetup(a, app.baseline, { "system.stats.str.value": 21 }),
    saveStatSetup(a, app.baseline, { "system.stats.str.value": 22 })
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /changed/);
  assert.equal(a.updates.length, 1);
});

test("changing level/awards invalidates a draft, while closing and unrelated resource changes do not write scores", async () => {
  const a = actor(), app = new StatSetup(a);
  a.source.level = 4;
  app.rows[0].score = 21;
  await assert.rejects(app.apply(), /changed/);
  assert.equal(a.updates.length, 0);
  const fresh = new StatSetup(a);
  a.source.ap = { value: 0 };
  fresh.rows[0].score = 18;
  await fresh.apply();
  assert.equal(a.source.stats.str.value, 18);
  const cancelled = new StatSetup(a);
  cancelled.rows[0].score = 24;
  await cancelled.close();
  assert.equal(a.source.stats.str.value, 18);
});
