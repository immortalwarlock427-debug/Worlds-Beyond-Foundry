import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionRollPlan as plan, suggestedMode } from "../module/condition-rolls-core.mjs";

test("attacker conditions select exactly the Notion attack defaults", () => {
  for (const id of ["blind", "poison", "restrain", "prone", "unconscious", "fear"])
    assert.equal(suggestedMode(plan({ source: [id] })), "disadvantage", id);
  assert.equal(suggestedMode(plan({ source: ["invisible"] })), "advantage");
  assert.equal(suggestedMode(plan({ source: ["fear"], fearInSight: false })), "normal");
  for (const id of ["deaf", "petrified", "grappled", "incapacitated", "charmed", "stun", "paralysis", "dead"])
    assert.equal(suggestedMode(plan({ source: [id] })), "normal", `${id} must not invent a dice penalty`);
});

test("target statuses distinguish melee, thrown and ranged attacks", () => {
  for (const id of ["blind", "restrain", "paralysis", "stun"]) assert.equal(suggestedMode(plan({ target: [id] })), "advantage", id);
  assert.equal(suggestedMode(plan({ target: ["invisible"] })), "disadvantage");
  assert.equal(suggestedMode(plan({ target: ["prone"], delivery: "melee" })), "advantage");
  for (const delivery of ["thrown", "ranged"]) assert.equal(suggestedMode(plan({ target: ["prone"], delivery })), "disadvantage");
  assert.equal(suggestedMode(plan({ target: ["unconscious"], delivery: "melee" })), "advantage");
  assert.equal(suggestedMode(plan({ target: ["unconscious"], delivery: "ranged" })), "normal");
  assert.equal(suggestedMode(plan({ target: ["petrified"] })), "normal");
});

test("checks and Dodges are affected, ordinary saves and Parry are not blanket penalized", () => {
  for (const id of ["poison", "fear"]) assert.equal(suggestedMode(plan({ kind: "check", source: [id] })), "disadvantage");
  for (const id of ["blind", "restrain"]) assert.equal(suggestedMode(plan({ kind: "dodge", source: [id] })), "disadvantage");
  for (const kind of ["save", "parry", "initiative"])
    assert.equal(suggestedMode(plan({ kind, source: ["blind", "restrain", "poison", "fear", "prone"] })), "normal");
});

test("sensory failures only apply to checks explicitly requiring that sense", () => {
  assert.equal(plan({ kind: "check", source: ["blind", "deaf"] }).failures.length, 0);
  assert.equal(plan({ kind: "check", source: ["blind"], requiresSight: true }).failures.length, 1);
  assert.equal(plan({ kind: "check", source: ["deaf"], requiresHearing: true }).failures.length, 1);
  assert.equal(plan({ kind: "save", source: ["blind", "deaf"], requiresSight: true, requiresHearing: true }).failures.length, 0);
});

test("Paralyzed criticals require a measured distance of at most five feet", () => {
  for (const delivery of ["melee", "ranged", "thrown"])
    for (const distance of [0, 5]) assert.equal(plan({ target: ["paralysis"], distance, delivery }).closeCritical, true);
  for (const distance of [null, undefined, NaN, 5.01, 10, -1]) assert.equal(plan({ target: ["paralysis"], distance }).closeCritical, false);
  assert.equal(plan({ target: ["unconscious"], distance: 5 }).closeCritical, false);
});

test("multiple sources do not stack dice; provisional cancellation includes equipment disadvantage", () => {
  assert.equal(suggestedMode(plan({ source: ["blind", "poison", "restrain"] })), "disadvantage");
  assert.equal(suggestedMode(plan({ source: ["invisible", "poison"], target: ["stun"] })), "normal");
  assert.equal(suggestedMode(plan({ source: ["invisible"] }), ["Long range"]), "normal");
});
