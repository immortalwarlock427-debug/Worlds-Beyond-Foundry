import { test } from "node:test";
import assert from "node:assert/strict";
import { bonusDuration, bonusDurationText, effectTimeLeft } from "../module/effect-duration.mjs";

test("old/cleared durations remain untimed; positive counts use native v14 expiry fields", () => {
  for (const setting of [undefined, {}, { value: null }, { value: "" }, { value: 0 }, { value: -1 }])
    assert.equal(bonusDuration(setting), null);
  assert.deepEqual(bonusDuration({ value: 3.9, units: "rounds" }), { value: 3, units: "rounds", expiry: "turnStart", expired: false });
  assert.deepEqual(bonusDuration({ value: 10, units: "minutes" }), { value: 10, units: "minutes", expiry: null, expired: false });
  assert.equal(bonusDuration({ value: 2, units: "hours" }).expiry, null);
  assert.throws(() => bonusDuration({ value: 2, units: "bad" }), /Choose rounds/);
  assert.equal(bonusDurationText({ value: 1, units: "rounds" }), "1 round");
  assert.equal(bonusDurationText({ value: 10, units: "minutes" }), "10 min");
  assert.equal(effectTimeLeft({ duration: { value: 3, units: "rounds", label: "2 rounds" } }), "2 rounds left");
  assert.equal(effectTimeLeft({ duration: { value: null, remaining: Infinity } }), "");
});

test("a duration can select game-time outside combat and a separate round count in combat", () => {
  const setting = { value: 5, units: "minutes", combatRounds: 6 };
  assert.equal(bonusDuration(setting).units, "minutes");
  assert.equal(bonusDuration(setting).value, 5);
  assert.equal(bonusDuration(setting, true).units, "rounds");
  assert.equal(bonusDuration(setting, true).value, 6);
  assert.match(bonusDurationText(setting), /5 min · 6 rounds in combat/);
  assert.equal(bonusDuration({ ...setting, combatRounds: 0 }, true), null);
});
