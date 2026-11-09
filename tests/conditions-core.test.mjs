import { test } from "node:test";
import assert from "node:assert/strict";
import { CONDITIONS, condition, mergeStatusEffects, tickFormula, endActionCost, TICKS } from "../module/conditions-core.mjs";
import { conditionOf } from "../module/effects-core.mjs";

test("all 16 Notion statuses, with Foundry's ids where Foundry has one", () => {
  assert.deepEqual(
    CONDITIONS.map(entry => entry.name),
    [
      "Bleeding",
      "Blinded",
      "Burning",
      "Charmed",
      "Deafened",
      "Frightened",
      "Grappled",
      "Incapacitated",
      "Invisible",
      "Paralyzed",
      "Petrified",
      "Poisoned",
      "Prone",
      "Restrained",
      "Stunned",
      "Unconscious"
    ]
  );
  assert.equal(condition("fear").name, "Frightened");
  assert.equal(condition("restrain").name, "Restrained");
  for (const entry of CONDITIONS) assert.ok(entry.description.length > 20 && entry.img.startsWith("icons/svg/"));
});

test("Notion statuses come first and Foundry's other statuses stay", () => {
  const core = [
    { id: "dead", name: "EFFECT.StatusDead", img: "icons/svg/skull.svg" },
    { id: "prone", name: "EFFECT.StatusProne", img: "icons/svg/falling.svg", hud: true },
    { id: "degen", name: "EFFECT.StatusDegen", img: "icons/svg/degen.svg" }
  ];
  const merged = mergeStatusEffects(core);
  assert.equal(merged.length, 18);
  assert.deepEqual(merged.slice(0, 2).map(entry => entry.id), ["bleeding", "blind"]);
  const prone = merged.find(entry => entry.id === "prone");
  assert.equal(prone.name, "Prone");
  assert.equal(prone.hud, true);
  assert.deepEqual(merged.slice(-2).map(entry => entry.id), ["dead", "degen"]);
});

test("Bleeding and Burning add a die at levels 5, 10, 15 and 20 of the source", () => {
  assert.equal(tickFormula("bleeding", 1), "1d4");
  assert.equal(tickFormula("bleeding", 6), "2d4");
  assert.equal(tickFormula("burning", 4), "1d6");
  assert.equal(tickFormula("burning", 20), "5d6");
  assert.equal(tickFormula("prone", 5), "");
  assert.equal(TICKS.burning.damageType, "Fire");
  assert.equal(TICKS.bleeding.damageType, "");
});

test("Shake It Off is 5 AP lowered by VIT; putting out flames is 5 AP", () => {
  assert.equal(endActionCost("bleeding", 0), 5);
  assert.equal(endActionCost("bleeding", 3), 3);
  assert.equal(endActionCost("bleeding", -2), 7);
  assert.equal(endActionCost("burning", 4), 5);
  assert.equal(endActionCost("prone", 4), null);
});

test("the Status tab shows a condition's rule", () => {
  assert.equal(conditionOf({ statuses: new Set(["degen", "burning"]) }).name, "Burning");
  assert.equal(conditionOf({ statuses: new Set(["degen"]) }), null);
  assert.equal(conditionOf({}), null);
});
