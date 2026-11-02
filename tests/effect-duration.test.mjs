import { test } from "node:test";
import assert from "node:assert/strict";
import { bonusDuration, bonusDurationText, effectTimeLeft } from "../module/effect-duration.mjs";

test("old/cleared durations remain untimed; positive counts use native v14 expiry fields", () => {
  for (const setting of [undefined, {}, { value: null }, { value: "" }, { value: 0 }, { value: -1 }]) assert.equal(bonusDuration(setting), null);
  assert.deepEqual(bonusDuration({ value: 3.9, units: "rounds" }), { value: 3, units: "rounds", expiry: "turnStart", expired: false });
  assert.deepEqual(bonusDuration({ value: 10, units: "minutes" }), { value: 10, units: "minutes", expiry: null, expired: false });
  assert.equal(bonusDuration({ value: 2, units: "hours" }).expiry, null);
  assert.throws(() => bonusDuration({ value: 2, units: "bad" }), /Choose rounds/);
  assert.equal(bonusDurationText({ value: 1, units: "rounds" }), "1 round"); assert.equal(bonusDurationText({ value: 10, units: "minutes" }), "10 min");
  assert.equal(effectTimeLeft({ duration: { value: 3, units: "rounds", label: "2 rounds" } }), "2 rounds left");
  assert.equal(effectTimeLeft({ duration: { value: null, remaining: Infinity } }), "");
});
