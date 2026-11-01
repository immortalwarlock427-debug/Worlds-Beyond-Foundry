import { test } from "node:test";
import assert from "node:assert/strict";
import { dodgeContext, dodgeOutcome } from "../module/defenses.mjs";

test("direct Dodge must beat the attack, while an area Dodge meets the save DC", () => {
  const direct = dodgeContext({ target: 17 });
  const area = dodgeContext({ against: "area", target: 17 });
  assert.deepEqual([16, 17, 18].map(total => dodgeOutcome(direct, total).damageMultiplier), [1, 1, 0]);
  assert.deepEqual([16, 17, 18].map(total => dodgeOutcome(area, total).damageMultiplier), [1, 0.5, 0.5]);
});

test("blank defense targets stay unresolved; an explicit zero remains a comparison target", () => {
  for (const target of [undefined, null, "", " "]) {
    assert.deepEqual(dodgeContext({ target }), { type: "dodge", area: false, target: null });
    assert.deepEqual(dodgeOutcome(dodgeContext({ target }), 20), { resolved: false, success: false, damageMultiplier: null });
  }
  assert.equal(dodgeContext({ target: "0" }).target, 0);
  assert.equal(dodgeOutcome(dodgeContext({ target: 0 }), 0).success, false);
  assert.equal(dodgeOutcome(dodgeContext({ against: "area", target: 0 }), 0).success, true);
  assert.equal(dodgeContext({ target: " 17.5 " }).target, 17.5);
});

test("an incoming natural 20 prevents direct Dodge, while the area save compares only its DC", () => {
  assert.throws(() => dodgeContext({ natural20: true }), /natural 20 cannot be Dodged/);
  assert.equal(dodgeContext({ against: "area", target: 20, natural20: true }).target, 20);
  // The defender's own natural 20 or 1 is not an automatic success or failure.
  assert.equal(dodgeOutcome(dodgeContext({ target: 25 }), 20).success, false);
  assert.equal(dodgeOutcome(dodgeContext({ target: -1 }), 1).success, true);
});

test("Defy Fate declares Dodge successful, including manual comparisons, without changing area damage rules", () => {
  assert.deepEqual(dodgeOutcome(dodgeContext({ target: 30 }), 2, true), { resolved: true, success: true, damageMultiplier: 0 });
  assert.equal(dodgeOutcome(dodgeContext(), 2, true).success, true);
  assert.equal(dodgeOutcome(dodgeContext({ against: "area", target: 30 }), 2, true).damageMultiplier, 0.5);
});

test("invalid comparison values and modes fail before any roll can be spent", () => {
  for (const target of [NaN, Infinity, "unknown"]) assert.throws(() => dodgeContext({ target }), /numeric attack total/);
  assert.throws(() => dodgeContext({ against: "mind-control" }), /Choose an attack/);
  assert.equal(dodgeOutcome(dodgeContext({ target: 10 }), NaN).resolved, false);
});
