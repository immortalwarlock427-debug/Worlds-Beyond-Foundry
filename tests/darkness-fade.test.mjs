import { test } from "node:test";
import assert from "node:assert/strict";
import { changesDarkness, darknessFadeMilliseconds, DARKNESS_FADE_MAX_SECONDS } from "../module/darkness-fade-core.mjs";
import { registerDarknessFade } from "../module/darkness-fade.mjs";

test("darkness changes are found nested or flattened, and nothing else counts", () => {
  assert.equal(changesDarkness({ environment: { darknessLevel: 1 } }), true);
  assert.equal(changesDarkness({ "environment.darknessLevel": 0 }), true);
  assert.equal(changesDarkness({ environment: { globalLight: { enabled: true } } }), false);
  assert.equal(changesDarkness({ name: "Forest" }), false);
  assert.equal(changesDarkness(undefined), false);
});

test("fade length converts seconds, caps the maximum and treats 0 or nonsense as off", () => {
  assert.equal(darknessFadeMilliseconds(10), 10000);
  assert.equal(darknessFadeMilliseconds(2.5), 2500);
  assert.equal(darknessFadeMilliseconds(DARKNESS_FADE_MAX_SECONDS + 30), DARKNESS_FADE_MAX_SECONDS * 1000);
  for (const off of [0, -4, "", null, undefined, "abc", NaN]) assert.equal(darknessFadeMilliseconds(off), null);
});

test("the hook fades instant and module-timed darkness changes, and leaves other updates alone", () => {
  let hook,
    seconds = 12;
  globalThis.game = { settings: { register: () => {}, get: () => seconds } };
  globalThis.Hooks = { on: (name, fn) => name === "preUpdateScene" && (hook = fn) };
  registerDarknessFade();

  for (const sent of [false, true, undefined, 10000]) {
    const options = { animateDarkness: sent };
    hook({}, { "environment.darknessLevel": 1 }, options);
    assert.equal(options.animateDarkness, 12000);
  }
  const unrelated = { animateDarkness: false };
  hook({}, { name: "Ruins" }, unrelated);
  assert.equal(unrelated.animateDarkness, false);

  seconds = 0;
  const off = { animateDarkness: false };
  hook({}, { environment: { darknessLevel: 0 } }, off);
  assert.equal(off.animateDarkness, false);
});
