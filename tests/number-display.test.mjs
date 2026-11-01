import { test } from "node:test";
import assert from "node:assert/strict";
import { wholeNumber, wholeDisplay, wholeFormUpdates, bindWholeNumbers } from "../module/number-display.mjs";
import { magicPool, resourcePresentation, resourceInputPoints } from "../module/resources.mjs";
import { decorateSystemMessage } from "../module/chat-style.mjs";
import { describeD20Roll } from "../module/rolls.mjs";

test("whole presentation floors positive/negative totals without rounding formulas, text or source data", () => {
  const source = { health: 120.4, next: 119.9, negative: -0.2, maximum: null, text: "1.5×", formula: "1d6 * 1.25", nested: [{ n: 3.9 }] };
  const before = structuredClone(source);
  assert.deepEqual(wholeDisplay(source), { ...source, health: 120, next: 119, negative: -1, nested: [{ n: 3 }] });
  assert.deepEqual(source, before); assert.equal(wholeNumber(""), "");
});

test("numeric forms floor deliberate entries and preserve hidden fractions on unrelated submissions", () => {
  const original = { system: { ap: { value: 120.4 }, overrides: { armor: 2.5 } } };
  const form = { querySelectorAll: () => ["system.ap.value", "system.overrides.armor", "system.quantity", "system.empty", "system.invalid"].map(name => ({ name })) };
  const unchanged = { name: "Hero 1.5", system: { ap: { value: 120 }, overrides: { armor: 2 }, quantity: 4.9, empty: "", invalid: "bad", damage: "1d6 * 1.5" } };
  wholeFormUpdates(unchanged, form, original);
  assert.equal(unchanged.system.ap.value, undefined); assert.equal(unchanged.system.overrides.armor, undefined);
  assert.equal(unchanged.system.quantity, 4); assert.equal(unchanged.system.empty, ""); assert.equal(unchanged.system.invalid, "bad");
  assert.equal(unchanged.name, "Hero 1.5"); assert.equal(unchanged.system.damage, "1d6 * 1.5");
  const edited = { system: { ap: { value: 119.9 }, overrides: { armor: -0.2 } } };
  wholeFormUpdates(edited, form, original); assert.equal(edited.system.ap.value, 119); assert.equal(edited.system.overrides.armor, -1);
  assert.equal(original.system.ap.value, 120.4);
});

test("numeric change/submit binding floors before validation, retains blanks, and binds once", () => {
  const listeners = {};
  const root = { addEventListener: (key, fn, capture) => { assert.equal(capture, true); (listeners[key] ??= []).push(fn); }, querySelectorAll: () => inputs };
  const inputs = ["9.9", "-1.2", "", "4.5", "3.3"].map(value => ({ value, matches: selector => selector === 'input[type="number"]' }));
  inputs[3].disabled = true; inputs[4].readOnly = true;
  bindWholeNumbers(root); bindWholeNumbers(root); assert.equal(listeners.change.length, 1);
  listeners.change[0]({ target: inputs[0] }); assert.equal(inputs[0].value, "9");
  listeners.submit[0](); assert.deepEqual(inputs.map(input => input.value), ["9", "-2", "", "4.5", "3.3"]);
  inputs[0].value = "7.9"; listeners.keydown[0]({ key: "Enter" }); assert.equal(inputs[0].value, "7");
});

test("visible system dice totals and d20 equations floor without changing rolls or formula text", () => {
  const totals = [{ textContent: "14.2" }, { textContent: "-0.2" }];
  const html = { querySelector: () => ({}), classList: { add() {} }, querySelectorAll: () => totals };
  decorateSystemMessage({ isContentVisible: false }, html); assert.equal(totals[0].textContent, "14.2");
  decorateSystemMessage({ isContentVisible: true }, html); assert.deepEqual(totals.map(total => total.textContent), ["14", "-1"]);
  const roll = { total: 14.2, dice: [{ faces: 20, results: [{ result: 20, active: true }] }] };
  assert.equal(describeD20Roll(roll).equation, "20 − 6 = 14"); assert.equal(roll.total, 14.2);
});

test("percentage spending retains exact point remainders while both point and percent views are whole", () => {
  let spent = 4.6;
  const first = magicPool(3, 25, { spent }); // 125 - 4.6 = 120.4
  assert.equal(resourcePresentation(first).inputValue, 120);
  spent += 0.5;
  assert.equal(resourcePresentation(magicPool(3, 25, { spent })).inputValue, 119);
  const percentage = { ...first, display: "percent" };
  assert.equal(resourcePresentation(percentage).inputValue, 96);
  assert.equal(resourceInputPoints(percentage, 97.9), 121.25, "whole percent entry can still represent fractional points");
  assert.equal(resourceInputPoints(first, 119.9), 119);
});
