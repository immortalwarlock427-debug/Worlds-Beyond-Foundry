import { test } from "node:test";
import assert from "node:assert/strict";
import { magicPool, customPool, poolSpentForCurrent, adjustedResourceSpent, resourceEntries, resourceRestUpdates } from "../module/resources.mjs";
import { resourceAction, resourceFormUpdates, addResource } from "../module/resource-actions.mjs";
import { longRest } from "../module/roll-actions.mjs";

const id = "resource00000001";
function fixture() {
  const calls = [];
  const actor = { uuid: "Actor.resources", type: "character", isOwner: true,
    system: { level: 1, stats: { int: { value: 21, effective: 21 }, fth: { value: 18, effective: 18 } },
      mana: { enabled: true, spent: 10, amount: 1, maxOverride: null, bonus: 0 },
      holyPower: { enabled: false, spent: 3, amount: 1, maxOverride: 0, bonus: 0 },
      customResources: { [id]: { name: "Energy", baseMax: 100, bonus: 0, spent: 20, regen: 5, amount: 2, refillOnRest: true } },
      health: { damage: 6 }, ap: { value: 7 }, reactions: { value: 1 }, wonder: { value: 2 } },
    prepare() {
      Object.assign(this.system.mana, magicPool(this.system.level, this.system.stats.int.effective, this.system.mana));
      Object.assign(this.system.holyPower, magicPool(this.system.level, this.system.stats.fth.effective, this.system.holyPower));
      for (const pool of Object.values(this.system.customResources)) Object.assign(pool, customPool(pool));
    },
    async update(data) { calls.push(data); for (const [path, value] of Object.entries(data)) set(this, path, value); this.prepare(); return this; },
    clone(data) { const system = merge(this.system, data.system ?? {}); const copy = { ...this, system }; copy.prepare(); return copy; }
  };
  function set(object, path, value) { const keys = path.split("."); const last = keys.pop(); const target = keys.reduce((o, key) => o[key] ??= {}, object); if (value instanceof foundry.data.operators.ForcedDeletion) delete target[last]; else target[last] = value; }
  function merge(a, b) { const out = structuredClone(a); for (const [key, value] of Object.entries(b)) out[key] = value && typeof value === "object" && !Array.isArray(value) ? merge(out[key] ?? {}, value) : value; return out; }
  globalThis.foundry = { data: { operators: { ForcedDeletion: class {} } }, utils: { setProperty: set, randomID: () => "resource00000002" } };
  actor.prepare();
  return { actor, calls };
}

test("magic maxima use current scores, level and additive bonus; final override supports explicit zero and clear", () => {
  assert.equal(magicPool(1, 21).max, 63); assert.equal(magicPool(5, 21).max, 147);
  assert.equal(magicPool(5, 23, { bonus: 4 }).max, 165);
  assert.equal(magicPool(1, 21, { maxOverride: 0, bonus: 4 }).max, 0);
  assert.equal(magicPool(1, 21, { maxOverride: "" }).max, 63);
});

test("maximum changes preserve spent points through stat/level changes and reload without writing source", () => {
  const source = { spent: 10, bonus: 0 }; const before = structuredClone(source);
  assert.equal(magicPool(1, 21, source).value, 53);
  assert.equal(magicPool(1, 23, source).value, 59);
  assert.equal(magicPool(5, 21, source).value, 137);
  assert.equal(magicPool(1, 21, source).value, 53);
  assert.deepEqual(source, before);
  assert.equal(customPool({ baseMax: 100, bonus: 50, spent: 30 }).value, 120);
});

test("direct current corrections support zero, negative, above maximum and clearing", () => {
  for (const current of [0, -5, 120]) assert.equal(customPool({ baseMax: 100, spent: poolSpentForCurrent(100, current) }).value, current);
  assert.equal(poolSpentForCurrent(100, ""), 0); assert.equal(poolSpentForCurrent(100, null), 0);
  assert.equal(magicPool(1, 12, { spent: 50 }).value, -14, "a falling maximum preserves expenditure");
});

test("spend, restore, fill and recovery cap gains without silently reducing a manual excess", () => {
  const pool = { max: 100, value: 80 };
  assert.equal(adjustedResourceSpent(pool, "spend", 5), 25);
  assert.equal(adjustedResourceSpent(pool, "restore", 50), 0);
  assert.equal(adjustedResourceSpent(pool, "recover", 5), 15);
  assert.equal(adjustedResourceSpent({ max: 100, value: 120 }, "restore", 5), -20);
  assert.equal(adjustedResourceSpent(pool, "fill"), 0);
  assert.throws(() => adjustedResourceSpent(pool, "spend", 81), /Not enough/);
  assert.throws(() => adjustedResourceSpent(pool, "spend", -1), /non-negative/);
});

test("hidden pools retain balances and rest policies; resource identifiers remain stable", () => {
  const f = fixture(); const before = structuredClone(f.actor.system);
  const entries = resourceEntries(f.actor.system);
  assert.deepEqual(entries.map(row => row.key), ["mana", id]);
  assert.equal(entries[1].path, `system.customResources.${id}`);
  assert.equal(resourceRestUpdates(f.actor.system)["system.holyPower.spent"], 0);
  f.actor.system.customResources[id].refillOnRest = false;
  assert.equal(resourceRestUpdates(f.actor.system)[`system.customResources.${id}.spent`], undefined);
  assert.equal(before.holyPower.spent, f.actor.system.holyPower.spent);
});

test("resource actions update only the named balance and retain settings and other pools", async () => {
  const f = fixture(); await resourceAction(f.actor, id, "spend", 7);
  assert.deepEqual(f.calls[0], { [`system.customResources.${id}.spent`]: 27 });
  await resourceAction(f.actor, id, "recover"); assert.equal(f.actor.system.customResources[id].spent, 22);
  assert.equal(f.actor.system.customResources[id].regen, 5); assert.equal(f.actor.system.health.damage, 6);
  assert.equal(f.actor.system.mana.spent, 10); assert.equal(f.actor.system.ap.value, 7);
  await resourceAction(f.actor, "mana", "restore", 2); assert.equal(f.actor.system.mana.spent, 8);
});

test("whole-sheet saves omit unchanged displayed totals; deliberate current edits use the revised maximum", () => {
  const f = fixture(); const unchanged = { resourceValues: { mana: 53, [id]: 80 }, system: { mana: { bonus: 5 } } };
  resourceFormUpdates(f.actor, unchanged);
  assert.equal(unchanged.resourceValues, undefined); assert.equal(unchanged.system.mana.spent, undefined);
  const edit = { resourceValues: { mana: 20, [id]: 0 }, system: { mana: { maxOverride: 100 }, customResources: { [id]: { baseMax: 50 } } } };
  resourceFormUpdates(f.actor, edit); assert.equal(edit.system.mana.spent, 80); assert.equal(edit.system.customResources[id].spent, 50);
  const clear = { resourceValues: { mana: "" } }; resourceFormUpdates(f.actor, clear); assert.equal(clear.system.mana.spent, 0);
  assert.throws(() => resourceFormUpdates(f.actor, { resourceValues: { mana: "bad" } }), /numeric/);
});

test("add/remove use stable IDs and field updates rather than replacing the entire resource collection", async () => {
  const f = fixture(); const created = await addResource(f.actor); assert.equal(created, "resource00000002");
  assert.equal(f.actor.system.customResources[id].spent, 20);
  await resourceAction(f.actor, created, "remove"); assert.equal(f.actor.system.customResources[created], undefined);
  assert.equal(f.actor.system.customResources[id].name, "Energy");
  await assert.rejects(resourceAction(f.actor, created, "fill"), /no longer exists/);
});

test("long rest fills magic and opted-in custom pools without changing settings or opted-out pools", async () => {
  const f = fixture(); f.actor.system.customResources.resource00000003 = { baseMax: 10, spent: 4, regen: 1, refillOnRest: false };
  await longRest(f.actor);
  assert.equal(f.actor.system.mana.spent, 0); assert.equal(f.actor.system.holyPower.spent, 0);
  assert.equal(f.actor.system.customResources[id].spent, 0); assert.equal(f.actor.system.customResources.resource00000003.spent, 4);
  assert.equal(f.actor.system.holyPower.enabled, false); assert.equal(f.actor.system.holyPower.maxOverride, 0);
  assert.equal(f.actor.system.customResources[id].regen, 5);
});

test("serialized spends cannot overdraw; unowned actors and cancelled updates do not post results", async () => {
  const f = fixture(); f.actor.system.customResources[id].spent = 99; f.actor.prepare();
  const results = await Promise.allSettled([resourceAction(f.actor, id, "spend", 1), resourceAction(f.actor, id, "spend", 1)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(f.actor.system.customResources[id].value, 0);
  f.actor.isOwner = false; const count = f.calls.length; await addResource(f.actor); await resourceAction(f.actor, id, "fill"); assert.equal(f.calls.length, count);
  f.actor.isOwner = true; f.actor.update = async () => undefined; await assert.rejects(resourceAction(f.actor, id, "fill"), /cancelled/);
});
