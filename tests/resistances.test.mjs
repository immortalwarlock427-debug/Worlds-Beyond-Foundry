import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeResistances, resistanceEditor, resistanceSelection, isResistant } from "../module/resistances.mjs";
import { configureResistances } from "../module/resistance-actions.mjs";
import { hitDamage } from "../module/attacks.mjs";

test("resistance entries trim and deduplicate without guessing custom meanings", () => {
  const input = [" fire ", "FIRE", "", " Lightning ", "lightning", "Nonmagical   weapons", "Fire, Cold", "<test>"];
  assert.deepEqual(normalizeResistances(input), ["Fire", "Lightning", "Nonmagical weapons", "Fire, Cold", "<test>"]);
  assert.equal(input[0], " fire ");
  assert.deepEqual(normalizeResistances(), []);
});

test("preset/custom editor round trips and clears all entries", () => {
  const editor = resistanceEditor(["Slashing", "FIRE", "Lightning", "Cold"]);
  const form = Object.fromEntries(editor.types.map(type => [type.field, type.selected]));
  form.custom = editor.custom;
  assert.deepEqual(resistanceSelection(form), ["Slashing", "Fire", "Lightning", "Cold"]);
  assert.deepEqual(resistanceSelection({ custom: "\r\n " }), []);
  assert.deepEqual(resistanceSelection({ resistance3: true, custom: "fire\nFire\nBlood" }), ["Fire", "Blood"]);
});

test("exact-type lookup can feed hitDamage without interpreting mixed damage or conditional labels", () => {
  const values = ["Fire", "Lightning", "Nonmagical weapons"];
  assert.equal(isResistant(values, " lightning "), true);
  assert.equal(isResistant(values, "Fire, Cold"), false);
  assert.equal(isResistant(values, "Slashing"), false);
  assert.equal(isResistant(values, ""), false);
  assert.equal(hitDamage({ damage: 16, armor: 6, resistant: isResistant(values, "Fire") }).total, 2);
});

function fixture(response) {
  const updates = [],
    dialogs = [],
    contexts = [];
  const actor = {
    uuid: "Actor.resistances",
    type: "character",
    isOwner: true,
    system: { resistances: ["Fire", "Cold"], health: { damage: 12.5 }, ap: { value: 9 } },
    async update(data) {
      updates.push(data);
      this.system.resistances = structuredClone(data["system.resistances"]);
      return this;
    }
  };
  globalThis.foundry = {
    applications: {
      handlebars: {
        renderTemplate: async (_path, context) => {
          contexts.push(context);
          return "rendered";
        }
      },
      api: {
        DialogV2: {
          input: async options => {
            dialogs.push(options);
            return response;
          }
        }
      }
    }
  };
  return { actor, updates, dialogs, contexts };
}

test("saving updates only the resistance list and clears it without leaving old entries", async () => {
  const { actor, updates } = fixture({ resistance0: true, custom: "Radiant\n radiant " });
  await configureResistances(actor);
  assert.deepEqual(updates, [{ "system.resistances": ["Bludgeoning", "Radiant"] }]);
  assert.equal(actor.system.health.damage, 12.5);
  assert.equal(actor.system.ap.value, 9);
  globalThis.foundry.applications.api.DialogV2.input = async () => ({ custom: "" });
  await configureResistances(actor);
  assert.deepEqual(actor.system.resistances, []);
});

test("cancel, unchanged selection and read-only access do not save", async () => {
  const { actor, updates, dialogs } = fixture(null);
  await configureResistances(actor);
  assert.equal(updates.length, 0);
  globalThis.foundry.applications.api.DialogV2.input = async () => ({ resistance3: true, custom: "Cold" });
  await configureResistances(actor);
  assert.equal(updates.length, 0);
  actor.isOwner = false;
  await configureResistances(actor);
  assert.equal(dialogs.length, 1);
  assert.equal(updates.length, 0);
});

test("a cancelled or unretained document update reports a save failure", async () => {
  const { actor } = fixture({ custom: "Lightning" });
  actor.update = async () => null;
  await assert.rejects(configureResistances(actor), /not saved/);
  actor.update = async () => actor;
  await assert.rejects(configureResistances(actor), /not saved/);
});
