import { test } from "node:test";
import assert from "node:assert/strict";
import { bindStatInput, editedStatInputs } from "../module/stat-input.mjs";

function fixture(base = "21", effective = "23") {
  const listeners = {};
  const classes = new Set(["is-adjusted"]);
  const input = {
    value: effective, dataset: { statScore: "agl", base, effective },
    classList: { add: key => classes.add(key), remove: key => classes.delete(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) },
    addEventListener: (event, listener) => { (listeners[event] ??= []).push(listener); }
  };
  const fire = event => listeners[event].forEach(listener => listener());
  const form = { querySelectorAll: () => [input] };
  bindStatInput(input);
  return { input, classes, fire, form };
}

test("effective score occupies one field; focusing and blurring alone never creates an edit", () => {
  const f = fixture();
  assert.deepEqual(editedStatInputs(f.form), []);
  f.fire("focus");
  assert.equal(f.input.value, "21");
  assert.equal(f.classes.has("is-adjusted"), false);
  assert.deepEqual(editedStatInputs(f.form), []);
  f.fire("blur");
  assert.equal(f.input.value, "23");
  assert.equal(f.classes.has("is-adjusted"), true);
  assert.deepEqual(editedStatInputs(f.form), []);
});

test("editing base 21 to 22 with a +2 effect displays 24 and records only the base 22", () => {
  const f = fixture();
  f.fire("focus");
  f.input.value = "22";
  f.fire("input");
  f.fire("blur");
  assert.equal(f.input.value, "24");
  assert.deepEqual(editedStatInputs(f.form), [["agl", 22]]);
  assert.equal(f.classes.has("is-manual"), true);
  assert.equal(f.classes.has("is-adjusted"), true);
});

test("penalties use the same adjusted state; zero remains editable; blanks do not overwrite scores", () => {
  const f = fixture("12", "9");
  f.fire("focus");
  f.input.value = "0";
  f.fire("input");
  f.fire("blur");
  assert.equal(f.input.value, "-3");
  assert.deepEqual(editedStatInputs(f.form), [["agl", 0]]);
  f.fire("focus");
  f.input.value = "";
  f.fire("input");
  assert.deepEqual(editedStatInputs(f.form), []);
  f.fire("blur");
  assert.equal(f.input.value, "9");
});

test("binding again does not duplicate handlers and no-change edits do not persist", () => {
  const f = fixture();
  bindStatInput(f.input);
  f.fire("focus");
  f.fire("input");
  assert.deepEqual(editedStatInputs(f.form), []);
});
