import { test } from "node:test";
import assert from "node:assert/strict";
import { commandAmount, commandTurn, apSpendPlan, apAvailable } from "../module/ap.mjs";
test("Command grants 2 + CHA capped at 5 and payments use eligible grant first without altering inputs", () => {
  for (const [mod, amount] of [[-3, 0], [-1, 1], [0, 2], [2, 4], [3, 5], [9, 5]]) assert.equal(commandAmount(mod), amount);
  const state = { ap: { value: 7.4 }, command: { value: 4, fresh: true } }, before = structuredClone(state);
  assert.equal(apAvailable(state), 11.4); assert.equal(apAvailable(state, false), 7.4);
  assert.deepEqual(apSpendPlan(state, 6), { own: 5.4, given: 0, fromGiven: 4, fromOwn: 2 });
  assert.deepEqual(apSpendPlan(state, 5, false), { own: 2.4000000000000004, given: 0, fromGiven: 0, fromOwn: 5 });
  assert.throws(() => apSpendPlan(state, 12), /Not enough AP/); assert.throws(() => apSpendPlan(state, -1), /non-negative/);
  assert.deepEqual(state, before);
});
test("a fresh Command grant survives the first incoming turn and expires on the next", () => {
  let state = { command: { value: 4, fresh: true } };
  assert.deepEqual(commandTurn(state), { value: 4, fresh: false });
  state.command = commandTurn(state); assert.deepEqual(commandTurn(state), { value: 0, fresh: false });
});
