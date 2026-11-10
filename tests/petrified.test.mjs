import { test } from "node:test";
import assert from "node:assert/strict";
import { petrifiedResistance, blockedPetrifiedStatuses } from "../module/petrified-core.mjs";
import {
  actorResistantTo,
  blockedStatusApplication,
  preventPetrifiedCreate,
  preventPetrifiedUpdate,
  registerPetrified
} from "../module/petrified.mjs";
import { CONDITIONS } from "../module/conditions-core.mjs";
import { applyCondition, tick } from "../module/conditions.mjs";
import { strikeDamage } from "../module/strike-core.mjs";
import { syncDying } from "../module/death.mjs";

function fixture() {
  const calls = { notices: [], errors: [], posts: [], created: [], updates: [], hooks: {}, settings: {} };
  const actor = {
    documentName: "Actor",
    uuid: "Actor.stone",
    name: "Stone",
    type: "character",
    statuses: new Set(["petrified"]),
    effects: [],
    system: { level: 5, resistances: [], immunities: [], health: { max: 100, value: 100, damage: 0 }, exhaustion: 2, dying: { trauma: 1 } },
    async update(changes) {
      calls.updates.push(changes);
      if ("system.health.damage" in changes) this.system.health.damage = changes["system.health.damage"];
      return this;
    },
    async toggleStatusEffect(id) {
      this.statuses.add(id);
      return {};
    }
  };
  globalThis.ui = { notifications: { info: message => calls.notices.push(message), error: message => calls.errors.push(message) } };
  globalThis.game = {
    user: { id: "tester" },
    combats: [],
    settings: {
      get: (_s, key) => calls.settings[key],
      register: (_s, key, data) => {
        calls.setting = { key, ...data };
      }
    }
  };
  globalThis.Hooks = {
    on: (name, fn) => {
      calls.hooks[name] = fn;
    }
  };
  globalThis.foundry = {
    utils: {
      setProperty(data, path, value) {
        const keys = path.split("."),
          last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), data)[last] = value;
      },
      hasProperty: () => false
    },
    dice: {
      Roll: class {
        async evaluate() {
          this.total = 9;
          return this;
        }
        async render() {
          return "<div>9</div>";
        }
      }
    },
    documents: {
      ActiveEffect: {
        implementation: {
          async fromStatusEffect(id) {
            calls.created.push(id);
            return { toObject: () => ({ statuses: [id] }) };
          },
          async create(data) {
            actor.statuses.add(data.statuses[0]);
            return data;
          }
        }
      },
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({}),
          create: async data => {
            calls.posts.push(data);
            return data;
          }
        }
      }
    }
  };
  function effect(statuses = [], extra = {}) {
    return {
      uuid: `Actor.stone.ActiveEffect.${actor.effects.length}`,
      parent: actor,
      statuses: new Set(statuses),
      disabled: false,
      isSuppressed: false,
      clone(changes) {
        return effect(changes.statuses ?? [...this.statuses], {
          ...this,
          ...changes,
          statuses: new Set(changes.statuses ?? this.statuses)
        });
      },
      ...extra
    };
  }
  return { actor, calls, effect };
}

test("Petrified resists typed, mixed, custom and untyped damage once without changing saved resistances", () => {
  const { actor, calls } = fixture();
  assert.equal(petrifiedResistance(new Set(["petrified"])), true);
  for (const type of ["Fire", "Slashing, Fire", "Cosmic", "", undefined]) assert.equal(actorResistantTo(actor, type), true);
  actor.system.resistances = ["Slashing"];
  assert.equal(strikeDamage({ rolled: 17, resistant: actorResistantTo(actor, "Slashing"), armor: 2, block: 1 }).total, 5);
  assert.deepEqual(actor.system.resistances, ["Slashing"]);
  assert.equal(strikeDamage({ rolled: 17, resistant: true, immune: true, overwhelming: true }).total, 0);
  assert.equal(strikeDamage({ rolled: 17, resistant: true, armor: 20, overwhelming: true }).total, 8);
  calls.settings.automatePetrified = false;
  assert.equal(actorResistantTo(actor, "Slashing"), true);
  assert.equal(actorResistantTo(actor, "Fire"), false);
  assert.equal(actorResistantTo(actor, ""), false);
});

test("new conditions are blocked, old ones remain, and death bookkeeping isn't stone immortality", () => {
  for (const { id } of CONDITIONS) assert.deepEqual(blockedPetrifiedStatuses({ petrified: true, incoming: [id] }), [id]);
  assert.deepEqual(blockedPetrifiedStatuses({ petrified: true, incoming: ["dead", "custom", "poison", "custom"], existing: ["poison"] }), [
    "custom"
  ]);
  assert.deepEqual(blockedPetrifiedStatuses({ petrified: true, incoming: ["poison"], active: false }), []);
  assert.deepEqual(blockedPetrifiedStatuses({ incoming: ["poison"] }), []);
});

test("native Actor status create blocks whole composite applications but leaves disabled/item/bonus definitions and corrections editable", () => {
  const { actor, calls, effect } = fixture();
  const composite = effect(["poison", "blind"]);
  assert.equal(preventPetrifiedCreate(composite, {}), false);
  assert.deepEqual([...composite.statuses], ["poison", "blind"], "no saved definition stripped");
  assert.equal(preventPetrifiedCreate(effect(["poison"], { disabled: true }), {}), undefined);
  assert.equal(preventPetrifiedCreate(effect(["poison"], { isSuppressed: true }), {}), undefined);
  assert.equal(preventPetrifiedCreate(effect(["poison"], { parent: { documentName: "Item" } }), {}), undefined);
  assert.equal(preventPetrifiedCreate(effect([]), {}), undefined);
  assert.equal(preventPetrifiedCreate(effect(["dead"]), {}), undefined);
  assert.equal(preventPetrifiedCreate(effect(["poison"]), {}, { worldsBeyondCorrection: true }), undefined);
  assert.equal(calls.notices.length, 1);
  calls.settings.automatePetrified = false;
  assert.deepEqual(blockedStatusApplication(actor, ["poison"]), []);
});

test("existing effects can be edited/removed, but adding a status or reactivating an inactive source is a new application", () => {
  const { effect } = fixture();
  const old = effect(["poison"]);
  assert.equal(preventPetrifiedUpdate(old, { name: "Renamed", duration: { rounds: 2 } }), undefined);
  assert.equal(preventPetrifiedUpdate(old, { statuses: [] }), undefined);
  assert.equal(preventPetrifiedUpdate(old, { statuses: ["poison", "blind"] }), false);
  assert.equal(preventPetrifiedUpdate(old, { disabled: true }), undefined);
  assert.equal(preventPetrifiedUpdate(effect(["poison"], { disabled: true }), { disabled: false }), false);
  assert.equal(preventPetrifiedUpdate(effect(["poison"], { isSuppressed: true }), { isSuppressed: false }), false);
  assert.equal(
    preventPetrifiedUpdate(effect(["poison"], { disabled: true }), { disabled: false }, { worldsBeyondCorrection: true }),
    undefined
  );
  assert.deepEqual([...old.statuses], ["poison"]);
});

test("Bleed application stops before effect allocation, while existing Bleeding and Burning still tick with resistance", async () => {
  const { actor, calls } = fixture();
  assert.equal(await applyCondition(actor, "bleeding"), null);
  assert.deepEqual(calls.created, []);
  actor.statuses.add("bleeding");
  actor.statuses.add("burning");
  await tick(actor, "bleeding", { id: "combat" });
  assert.equal(actor.system.health.damage, 4, "untyped damage is halved and rounded down");
  assert.match(calls.posts.at(-1).content, /Resistant to this damage: halved/);
  actor.system.resistances = ["Fire"];
  await tick(actor, "burning", { id: "combat" });
  assert.equal(actor.system.health.damage, 8, "typed resistance does not stack with Petrified");
  actor.system.immunities = ["Fire"];
  await tick(actor, "burning", { id: "combat" });
  assert.equal(actor.system.health.damage, 8);
  assert.equal(calls.posts.at(-1).flags["worlds-beyond"].conditionTick.amount, 0);
});

test("removing Petrified restores Unconscious at zero Health, without a second knockout or Trauma", async () => {
  const { actor, calls, effect } = fixture();
  registerPetrified();
  assert.equal(calls.setting.default, true);
  assert.equal(calls.setting.key, "automatePetrified");
  actor.system.health.value = 0;
  await syncDying(actor, { worldsBeyondHealthBefore: 0, worldsBeyondDeathSync: true }, {});
  assert.equal(actor.statuses.has("unconscious"), false);
  const stone = effect(["petrified"]),
    options = {};
  preventPetrifiedUpdate(stone, { disabled: true }, options);
  preventPetrifiedUpdate(effect(["poison"], { uuid: "other" }), { name: "old" }, options);
  actor.statuses.clear();
  await calls.hooks.updateActiveEffect(stone, { disabled: true }, options, "tester");
  assert.equal(actor.statuses.has("unconscious"), true);
  assert.deepEqual(calls.updates, []);
  assert.equal(actor.system.exhaustion, 2);
  assert.equal(actor.system.dying.trauma, 1);
  assert.deepEqual(calls.errors, []);
});

test("deletion recovery runs on the initiator only, respects other Petrified sources and the death opt-out", async () => {
  const { actor, calls, effect } = fixture();
  registerPetrified();
  const stone = effect(["petrified"]);
  actor.system.health.value = 0;
  await calls.hooks.deleteActiveEffect(stone, {}, "tester");
  assert.deepEqual(calls.created, [], "another stone source remains");
  actor.statuses.clear();
  await calls.hooks.deleteActiveEffect(stone, {}, "other-client");
  assert.deepEqual(calls.created, []);
  calls.settings.automateDeath = false;
  await calls.hooks.deleteActiveEffect(stone, {}, "tester");
  assert.deepEqual(calls.created, []);
  calls.settings.automateDeath = true;
  await calls.hooks.deleteActiveEffect(stone, {}, "tester");
  assert.deepEqual(calls.created, ["unconscious"]);
});

test("Petrified still permits the Dead/defeated marker at the death threshold", async () => {
  const { actor } = fixture();
  actor.system.health.value = -1000;
  actor.system.stats = { vit: { value: 12, mod: 0 } };
  await syncDying(actor, { worldsBeyondHealthBefore: -1000, worldsBeyondDeathSync: true }, {});
  assert.equal(actor.statuses.has("dead"), true);
  assert.equal(actor.statuses.has("unconscious"), false);
});

test("v14 duration registry suppression before its expiry update still reconciles zero Health", async () => {
  const { actor, calls, effect } = fixture();
  registerPetrified();
  const stone = effect(["petrified"], { isSuppressed: true });
  actor.statuses.clear();
  actor.system.health.value = 0;
  const options = {};
  preventPetrifiedUpdate(stone, { duration: { expired: true } }, options);
  await calls.hooks.updateActiveEffect(stone, { duration: { expired: true } }, options, "tester");
  assert.equal(actor.statuses.has("unconscious"), true);
  assert.deepEqual(calls.updates, []);
});
