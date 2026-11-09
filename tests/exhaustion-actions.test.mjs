import { test } from "node:test";
import assert from "node:assert/strict";
import { coreNumbers } from "../module/core-numbers.mjs";
import {
  actorExhaustion,
  exhaustionMode,
  exhaustionAttackDie,
  overexert,
  prepareExhaustionUpdate,
  syncExhaustion
} from "../module/exhaustion.mjs";
import { syncDying } from "../module/death.mjs";
import { rollStatCheck, longRest } from "../module/roll-actions.mjs";
import { rollDodge, rollParry } from "../module/reaction-actions.mjs";

const get = (data, path) => (Object.hasOwn(data, path) ? data[path] : path.split(".").reduce((o, k) => o?.[k], data));
const set = (data, path, value) => {
  const keys = path.split("."),
    last = keys.pop();
  const obj = keys.reduce((o, k) => (o[k] ??= {}), data);
  if (last.startsWith("-=")) delete obj[last.slice(2)];
  else obj[last] = value;
};

function fixture(level = 0) {
  const calls = { rolls: [], updates: [], posts: [], conditions: [] };
  const actor = {
    name: "Exhaustion test",
    type: "character",
    uuid: "Actor.exhaustion",
    isOwner: true,
    flags: {},
    items: [],
    statuses: new Set(),
    system: {
      level: 5,
      exhaustion: level,
      stats: Object.fromEntries(["str", "dex", "vit", "agl", "fth"].map(k => [k, { value: 21, mod: 4 }])),
      health: { max: 105, value: 105, damage: 0, maxOverride: null },
      ap: { max: 17, value: 10 },
      reactions: { value: 2, max: 2 },
      wonder: { value: 1 },
      equipment: {},
      dying: { trauma: 0, stabilized: false }
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    toObject() {
      return { system: structuredClone(this.system), flags: structuredClone(this.flags) };
    },
    async update(changes, options = {}) {
      prepareExhaustionUpdate(this, changes, options);
      calls.updates.push(structuredClone(changes));
      const apply = (object, prefix = "") => {
        for (const [key, value] of Object.entries(object)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === "object" && !Array.isArray(value)) apply(value, path);
          else set(this, path, value);
        }
      };
      apply(changes);
      this.system.health.max = coreNumbers({
        level: 5,
        stats: this.system.stats,
        exhaustion: game.settings.get("worlds-beyond", "automateExhaustion") === false ? 0 : this.system.exhaustion
      }).healthMax;
      this.system.health.value = this.system.health.max - this.system.health.damage;
      return this;
    }
  };
  class Roll {
    constructor(formula, data = {}) {
      this.formula = formula;
      this.data = data;
      this.dice = [{ faces: 20, total: 12, results: [{ result: 12, active: true }] }];
    }
    async evaluate() {
      calls.rolls.push(this.formula);
      this.total = 12 + (this.data.mod ?? 0);
      return this;
    }
    async render() {
      return "roll";
    }
    async toMessage(data) {
      calls.posts.push(data);
      return data;
    }
  }
  globalThis.foundry = {
    utils: { getProperty: get, setProperty: set, hasProperty: (d, p) => get(d, p) !== undefined },
    dice: { Roll },
    applications: { handlebars: { renderTemplate: async () => "card" } },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({}),
          create: async data => {
            calls.posts.push(data);
            return data;
          }
        }
      },
      ActiveEffect: {
        implementation: {
          fromStatusEffect: async id => ({ toObject: () => ({ statuses: [id] }) }),
          create: async data => {
            calls.conditions.push(data.statuses[0]);
            actor.statuses.add(data.statuses[0]);
            return data;
          }
        }
      }
    }
  };
  const combat = { id: "combat", started: true, round: 1, turn: 0, combatant: { actor }, combatants: [{ actor }] };
  globalThis.game = {
    user: { id: "tester" },
    socket: { emit() {} },
    settings: { get: (scope, key) => (key === "messageMode" ? "public" : true) },
    combats: [combat]
  };
  return { actor, calls, combat };
}

test("world opt-out leaves tracker alone and removes every projected exhaustion effect", () => {
  const { actor } = fixture(10);
  assert.equal(actorExhaustion(actor).collapse, true);
  game.settings.get = () => false;
  assert.equal(actorExhaustion(actor).level, 0);
  assert.equal(exhaustionAttackDie(actor), "");
  const changes = { "system.exhaustion": 10 };
  prepareExhaustionUpdate(actor, changes, {});
  assert.deepEqual(changes, { "system.exhaustion": 10 });
});

test("check, Dodge, Parry and save rolls default to disadvantage at their thresholds, but Normal wins", async () => {
  const { actor, calls } = fixture(3);
  await rollStatCheck(actor, "str");
  assert.equal(calls.rolls.at(-1), "2d20kl1 + @mod");
  await rollStatCheck(actor, "str", { kind: "save" });
  assert.equal(calls.rolls.at(-1), "1d20 + @mod");
  actor.system.exhaustion = 7;
  await rollStatCheck(actor, "str", { kind: "save" });
  await rollDodge(actor);
  await rollParry(actor);
  assert.deepEqual(calls.rolls.slice(-3), Array(3).fill("2d20kl1 + @mod"));
  await rollDodge(actor, { mode: "normal" });
  await rollParry(actor, { mode: "normal" });
  await rollStatCheck(actor, "str", { kind: "save", mode: "normal" });
  assert.deepEqual(calls.rolls.slice(-3), Array(3).fill("1d20 + @mod"));
  assert.equal(exhaustionMode(actor, "save"), "disadvantage");
  assert.equal(exhaustionAttackDie(actor), "1d8");
  assert.equal(exhaustionAttackDie(actor, false), "");
});

test("Overexert grants five AP and one level once on each own turn; off-turn and failures do not grant", async () => {
  const { actor, combat } = fixture();
  await overexert(actor);
  assert.equal(actor.system.ap.value, 15);
  assert.equal(actor.system.exhaustion, 1);
  await assert.rejects(overexert(actor), /already used/);
  combat.round = 2;
  await overexert(actor);
  assert.equal(actor.system.ap.value, 20);
  assert.equal(actor.system.exhaustion, 2);
  combat.combatant = null;
  await assert.rejects(overexert(actor), /own turn/);
  combat.combatant = { actor };
  combat.round++;
  foundry.documents.ChatMessage.implementation.create = async () => {
    throw new Error("post failed");
  };
  await assert.rejects(overexert(actor), /post failed/);
  assert.equal(actor.system.ap.value, 20);
  assert.equal(actor.system.exhaustion, 2);
});

test("Knocked Out adds exhaustion on a down transition except corrections/sync, and healing level 10 lowers it to 9", async () => {
  const { actor } = fixture(1);
  actor.statuses.add("unconscious");
  actor.system.health.value = 0;
  await syncDying(actor, { worldsBeyondHealthBefore: 5, worldsBeyondDamage: true }, {});
  assert.equal(actor.system.exhaustion, 2);
  for (const options of [
    { worldsBeyondDamage: true, worldsBeyondCorrection: true },
    { worldsBeyondDamage: true, worldsBeyondDeathSync: true }
  ]) {
    actor.system.health.value = 0;
    await syncDying(actor, { worldsBeyondHealthBefore: 5, ...options }, {});
    assert.equal(actor.system.exhaustion, 2);
  }
  actor.system.health.value = 0;
  await syncDying(actor, { worldsBeyondHealthBefore: 5 }, {});
  assert.equal(actor.system.exhaustion, 3);
  actor.statuses.clear();
  actor.system.exhaustion = 10;
  actor.system.health.value = 1;
  actor.system.health.damage = 51;
  await syncDying(actor, { worldsBeyondHealthBefore: 0 }, {});
  assert.equal(actor.system.exhaustion, 9);
  assert.equal(actor.system.health.value, 1);
});

test("level 8 preserves lower Health and caps overflow; level 10 collapses and level 9 applies Prone", async () => {
  const { actor, calls } = fixture(7);
  actor.system.health.damage = 20;
  actor.system.health.value = 85;
  await actor.update({ "system.exhaustion": 8 });
  assert.equal(actor.system.health.value, 52);
  await actor.update({ "system.exhaustion": 9 });
  await syncExhaustion(actor);
  assert.deepEqual(calls.conditions, ["prone"]);
  await actor.update({ "system.exhaustion": 10 });
  assert.equal(actor.system.health.value, 0);
  assert.equal(actor.system.dying.stabilized, false);
});

test("long rest removes two exhaustion levels and explicit healing takes priority", async () => {
  const { actor } = fixture(8);
  await longRest(actor);
  assert.equal(actor.system.exhaustion, 6);
  assert.equal(actor.system.health.value, 105);
});
