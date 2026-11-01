import { test } from "node:test";
import assert from "node:assert/strict";
import { magicPool, customPool, poolSpentForCurrent, adjustedResourceSpent, resourceEntries, resourceRestUpdates, resourcePresentation, RESOURCE_SCALING } from "../module/resources.mjs";
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
      for (const pool of Object.values(this.system.customResources)) Object.assign(pool, customPool(pool, this.system));
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

test("custom scaling supports all eight current stats with the single standard formula and retains the manual maximum", () => {
  assert.deepEqual(Object.keys(RESOURCE_SCALING), ["", "str", "dex", "vit", "agl", "int", "wis", "cha", "fth"]);
  for (const scaleStat of Object.keys(RESOURCE_SCALING).filter(Boolean)) {
    const source = { baseMax: 77, scaleStat, bonus: 2, spent: 10 };
    const before = structuredClone(source);
    const system = { level: 4, stats: { [scaleStat]: { value: 18, effective: 21 } } };
    assert.deepEqual(customPool(source, system), { min: 0, max: 128, value: 118, automatic: 128 });
    system.level = 8; assert.equal(customPool(source, system).max, 212);
    assert.equal(customPool({ ...source, scaleStat: "" }, system).max, 79);
    assert.deepEqual(source, before);
  }
});

test("scaled pool actions use the same stat-derived maximum as the sheet", async () => {
  const f = fixture(); const pool = f.actor.system.customResources[id]; pool.scaleStat = "int"; f.actor.prepare();
  assert.equal(pool.max, 63); assert.equal(pool.value, 43);
  await resourceAction(f.actor, id, "spend", 3); assert.equal(pool.spent, 23); assert.equal(pool.value, 40);
  await resourceAction(f.actor, id, "recover"); assert.equal(pool.value, 45);
});

test("percentage presentation handles rounded totals, zero maxima and manual under/over-cap corrections", () => {
  assert.equal(resourcePresentation({ display: "percent", max: 3, value: 1 }).inputValue, 33);
  assert.equal(resourcePresentation({ display: "percent", max: 100, value: 125 }).inputValue, 125);
  assert.equal(resourcePresentation({ display: "percent", max: 100, value: 125 }).meterPercent, 100);
  assert.equal(resourcePresentation({ display: "percent", max: 100, value: -5 }).meterPercent, 0);
  assert.equal(resourcePresentation({ display: "percent", max: 0, value: 5 }).percentUnavailable, true);
  assert.equal(resourcePresentation({ display: "percent", max: 0, value: 5 }).inputValue, 5);
});

test("changing display or submitting an unchanged rounded percentage never rewrites expenditure", () => {
  const f = fixture(); const pool = f.actor.system.customResources[id]; pool.baseMax = 3; pool.spent = 2; pool.display = "percent"; f.actor.prepare();
  const untouched = { resourceValues: { [id]: 33.33 }, system: { customResources: { [id]: { name: "Blood" } } } };
  resourceFormUpdates(f.actor, untouched); assert.equal(untouched.system.customResources[id].spent, undefined);
  const switchMode = { resourceValues: { [id]: 33.33 }, system: { customResources: { [id]: { display: "number" } } } };
  resourceFormUpdates(f.actor, switchMode); assert.equal(switchMode.system.customResources[id].spent, undefined);
  assert.equal(pool.spent, 2); assert.equal(pool.baseMax, 3);
});

test("percentage edits convert to points using the revised maximum; zero maximum falls back to points", () => {
  const f = fixture(); const pool = f.actor.system.customResources[id]; pool.display = "percent"; f.actor.prepare();
  const edit = { resourceValues: { [id]: 50 }, system: { customResources: { [id]: { baseMax: 200 } } } };
  resourceFormUpdates(f.actor, edit); assert.equal(edit.system.customResources[id].spent, 100);
  const clear = { resourceValues: { [id]: "" } }; resourceFormUpdates(f.actor, clear); assert.equal(clear.system.customResources[id].spent, 0);
  pool.baseMax = 0; pool.spent = -5; f.actor.prepare();
  const zero = { resourceValues: { [id]: 2 } }; resourceFormUpdates(f.actor, zero); assert.equal(zero.system.customResources[id].spent, -2);
});

test("percentage mode leaves action amounts in points for custom and built-in pools", async () => {
  const f = fixture(); f.actor.system.customResources[id].display = "percent"; f.actor.system.mana.display = "percent";
  await resourceAction(f.actor, id, "spend", 5); assert.equal(f.actor.system.customResources[id].value, 75);
  await resourceAction(f.actor, "mana", "spend", 5); assert.equal(f.actor.system.mana.value, 48);
  const edit = { resourceValues: { mana: 50 } }; resourceFormUpdates(f.actor, edit); assert.equal(edit.system.mana.spent, 31.5);
});

test("custom final maximum overrides replace scaled or manual totals and all bonuses; clearing restores the source", () => {
  const system = { level: 4, stats: { vit: { effective: 21 } } };
  for (const scaleStat of ["", "vit"]) {
    const source = { scaleStat, baseMax: 77, bonus: 23, spent: 10 };
    const before = structuredClone(source);
    for (const maxOverride of [0, 40, 200]) {
      const pool = customPool({ ...source, maxOverride }, system);
      assert.equal(pool.max, maxOverride);
      assert.equal(pool.value, maxOverride - 10);
    }
    for (const maxOverride of [null, ""]) assert.equal(customPool({ ...source, maxOverride }, system).max, scaleStat ? 149 : 100);
    assert.deepEqual(source, before);
  }
});

test("minimum overrides support negative and positive spending floors without clamping manual corrections", () => {
  const pool = customPool({ baseMax: 100, minOverride: -20, spent: 100 });
  assert.equal(pool.min, -20); assert.equal(pool.value, 0);
  assert.equal(adjustedResourceSpent(pool, "spend", 5), 105);
  assert.equal(adjustedResourceSpent(pool, "spend", 20), 120);
  assert.throws(() => adjustedResourceSpent(pool, "spend", 21), /minimum \(-20\)/);
  assert.equal(magicPool(1, 12, { minOverride: -20 }).min, -20);
  assert.equal(customPool({ minOverride: "" }).min, 0);
  const positive = customPool({ baseMax: 100, minOverride: 10, spent: 85 });
  assert.equal(adjustedResourceSpent(positive, "spend", 5), 90);
  assert.throws(() => adjustedResourceSpent(positive, "spend", 6), /minimum \(10\)/);
  const correction = customPool({ baseMax: 100, minOverride: -20, spent: 130 });
  assert.equal(correction.value, -30);
  assert.equal(adjustedResourceSpent(correction, "spend", 0), 130);
  assert.equal(adjustedResourceSpent(correction, "restore", 5), 125);
  assert.equal(adjustedResourceSpent(correction, "fill"), 0);
});

test("minimum-aware actions use final overrides, stop at the floor and keep restore/fill capped", async () => {
  const f = fixture(); const pool = f.actor.system.customResources[id];
  Object.assign(pool, { scaleStat: "int", maxOverride: 40, minOverride: -20, spent: 40, display: "percent" }); f.actor.prepare();
  await resourceAction(f.actor, id, "spend", 5); assert.equal(pool.value, -5);
  await resourceAction(f.actor, id, "spend", 15); assert.equal(pool.value, -20);
  await assert.rejects(resourceAction(f.actor, id, "spend", 1), /minimum/);
  await resourceAction(f.actor, id, "restore", 100); assert.equal(pool.value, 40);
  pool.spent = 45; f.actor.prepare();
  await resourceAction(f.actor, id, "recover"); assert.equal(pool.value, 0);
  await resourceAction(f.actor, id, "fill"); assert.equal(pool.value, 40);
  Object.assign(f.actor.system.mana, { maxOverride: 40, minOverride: -20, spent: 40 }); f.actor.prepare();
  await resourceAction(f.actor, "mana", "spend", 20); assert.equal(f.actor.system.mana.value, -20);
  await assert.rejects(resourceAction(f.actor, "mana", "spend", 1), /minimum/);
});

test("percentage display spans minimum to maximum, including a negative minimum and zero maximum", () => {
  for (const [value, percent] of [[-20, 0], [40, 50], [100, 100], [-32, -10], [112, 110]]) {
    const presentation = resourcePresentation({ min: -20, max: 100, value, display: "percent" });
    assert.equal(presentation.inputValue, percent);
    assert.equal(presentation.meterPercent, Math.max(0, Math.min(100, percent)));
  }
  assert.equal(resourcePresentation({ min: -20, max: 0, value: -10, display: "percent" }).inputValue, 50);
  for (const min of [100, 101]) {
    const presentation = resourcePresentation({ min, max: 100, value: 35, display: "percent" });
    assert.equal(presentation.percentUnavailable, true); assert.equal(presentation.inputValue, 35); assert.equal(presentation.meterPercent, 0);
  }
});

test("range changes preserve expenditure while deliberate percentages use revised limits", () => {
  const f = fixture(); const pool = f.actor.system.customResources[id];
  Object.assign(pool, { baseMax: 100, minOverride: -20, display: "percent", spent: 60 }); f.actor.prepare();
  const unchanged = { resourceValues: { [id]: 50 }, system: { customResources: { [id]: { maxOverride: 200, minOverride: -40 } } } };
  resourceFormUpdates(f.actor, unchanged); assert.equal(unchanged.system.customResources[id].spent, undefined);
  const edit = { resourceValues: { [id]: 25 }, system: { customResources: { [id]: { maxOverride: 200, minOverride: -40 } } } };
  resourceFormUpdates(f.actor, edit); assert.equal(edit.system.customResources[id].spent, 180, "25% of -40..200 is 20 points");
  const manual = { resourceValues: { [id]: -50 }, system: { customResources: { [id]: { display: "number" } } } };
  pool.display = "number";
  resourceFormUpdates(f.actor, manual); assert.equal(manual.system.customResources[id].spent, 150);
  const zeroRange = { resourceValues: { [id]: 3 } };
  Object.assign(pool, { minOverride: 100, display: "percent" }); f.actor.prepare();
  resourceFormUpdates(f.actor, zeroRange); assert.equal(zeroRange.system.customResources[id].spent, 97);
});

test("clearing limits or changing modes never resets the stored manual maximum or spent points", async () => {
  const f = fixture(); const pool = f.actor.system.customResources[id];
  Object.assign(pool, { maxOverride: 40, minOverride: -20, scaleStat: "int" }); f.actor.prepare();
  const edit = { resourceValues: { [id]: 20 }, system: { customResources: { [id]: { maxOverride: null, minOverride: null, scaleStat: "" } } } };
  resourceFormUpdates(f.actor, edit); assert.equal(edit.system.customResources[id].spent, undefined);
  Object.assign(pool, edit.system.customResources[id]); f.actor.prepare();
  assert.equal(pool.baseMax, 100); assert.equal(pool.max, 100); assert.equal(pool.min, 0); assert.equal(pool.value, 80);
  Object.assign(pool, { maxOverride: 40, minOverride: -20, spent: 60 }); f.actor.prepare();
  await longRest(f.actor); assert.equal(pool.max, 40); assert.equal(pool.min, -20); assert.equal(pool.value, 40);
});

test("whole point/percent displays survive unrelated saves without erasing fractional resource balances", async () => {
  const f = fixture(); const pool = f.actor.system.customResources[id];
  pool.baseMax = 125; pool.spent = 4.6; f.actor.prepare();
  const untouched = { resourceValues: { [id]: 120 }, system: { customResources: { [id]: { name: "Blood" } } } };
  resourceFormUpdates(f.actor, untouched); assert.equal(untouched.system.customResources[id].spent, undefined); assert.equal(pool.spent, 4.6);
  const typed = { resourceValues: { [id]: 119.9 } };
  resourceFormUpdates(f.actor, typed); assert.equal(typed.system.customResources[id].spent, 6);
  const percent = { resourceValues: { [id]: 96 }, system: { customResources: { [id]: { name: "Blood" } } } };
  pool.display = "percent"; resourceFormUpdates(f.actor, percent); assert.equal(percent.system.customResources[id].spent, undefined);
  await resourceAction(f.actor, id, "spend", "2.9"); assert.ok(Math.abs(pool.spent - 6.6) < 1e-10);
  await resourceAction(f.actor, id, "spend", 0.5); assert.ok(Math.abs(pool.spent - 7.1) < 1e-10, "internal numeric costs retain fractions");
});
