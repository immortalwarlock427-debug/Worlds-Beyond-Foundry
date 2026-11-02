import { test } from "node:test";
import assert from "node:assert/strict";
import { restorationPlan, recoveryChoices } from "../module/consumable-benefits.mjs";
import { adjustedResourceSpent, customPool } from "../module/resources.mjs";
import { triggerCondition, triggerSnapshot, triggerTransitions } from "../module/form-trigger-core.mjs";
const id = "resource00000001";
const system = { health: { max: 100, value: 90, damage: 10 }, mana: { enabled: true, max: 125, value: 90, spent: 35 }, customResources: { [id]: { name: "Blood", max: 100, value: 100, spent: 0, allowOverflow: true } } };

test("restoration plans support Health, enabled magic and stable custom pools, preserving source data and manual overheal", () => {
  const before = structuredClone(system);
  assert.equal(restorationPlan(system, "health", 20).next, 0);
  assert.equal(restorationPlan(system, "mana", 12.5).next, 22.5);
  assert.equal(restorationPlan(system, id, 5).next, -5);
  assert.equal(restorationPlan({ health: { damage: -10 } }, "health", 5).next, -10);
  assert.equal(restorationPlan({ health: { damage: -10, allowOverflow: true } }, "health", 5).next, -15);
  assert.throws(() => restorationPlan(system, "holyPower", 1), /missing or hidden/);
  assert.deepEqual(system, before);
  assert.equal(recoveryChoices(system, id).at(-1).label, "Blood");
  assert.equal(recoveryChoices({}, id).at(-1).label, "Missing or hidden resource");
});

test("resource overflow is opt-in; Restore can cross 100 without changing the normal maximum and Fill returns to 100", () => {
  const pool = customPool({ baseMax: 100, spent: 0, allowOverflow: true });
  const spent = adjustedResourceSpent(pool, "restore", 5); assert.equal(spent, -5);
  assert.equal(customPool({ baseMax: 100, spent, allowOverflow: true }).value, 105);
  assert.equal(pool.max, 100); assert.equal(adjustedResourceSpent(pool, "fill"), 0);
  assert.equal(adjustedResourceSpent({ ...pool, allowOverflow: false }, "restore", 5), 0);
});

test("form triggers distinguish strictly over 100, dynamic maxima, other comparisons and missing pools", () => {
  const trigger = { mode: "automatic", resourceId: id, comparison: "above", threshold: 100 };
  assert.equal(triggerCondition(system, trigger), false);
  const over = structuredClone(system); over.customResources[id].value = 105;
  assert.equal(triggerCondition(over, trigger), true);
  assert.equal(triggerCondition(over, { ...trigger, threshold: null }), true);
  assert.equal(triggerCondition(system, { ...trigger, comparison: "atLeast" }), true);
  assert.equal(triggerCondition(system, { ...trigger, comparison: "atMost" }), true);
  assert.equal(triggerCondition(system, { ...trigger, comparison: "below" }), false);
  assert.equal(triggerCondition(over, { ...trigger, mode: "manual" }), null);
  assert.equal(triggerCondition({}, trigger), null);
});

test("crossings enter once, manual End above threshold does not re-enter, and optional automatic ending is separate", () => {
  const form = { id: "beast", type: "ability", system: { kind: "form", effectsActive: false, trigger: { mode: "automatic", resourceId: id, comparison: "above", threshold: 100, endMode: "automatic" } } };
  const actor = { system: structuredClone(system), items: [form] }, before = triggerSnapshot(actor);
  actor.system.customResources[id].value = 105;
  assert.deepEqual(triggerTransitions(actor, before).enter, [form]);
  const above = triggerSnapshot(actor); assert.deepEqual(triggerTransitions(actor, above).enter, []);
  form.system.effectsActive = true; actor.system.customResources[id].value = 100;
  assert.deepEqual(triggerTransitions(actor, above).end, [form]);
  form.system.trigger.endMode = "stay"; assert.deepEqual(triggerTransitions(actor, above).end, []);
});
