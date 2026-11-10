import { test } from "node:test";
import assert from "node:assert/strict";
import { registerConditions } from "../module/conditions.mjs";
import { queuedAction } from "../module/action-support.mjs";

function fixture() {
  const hooks = {},
    errors = [];
  let automated = true;
  globalThis.Hooks = {
    on: (name, callback) => {
      hooks[name] = callback;
    }
  };
  globalThis.CONFIG = { statusEffects: [] };
  globalThis.game = { user: { id: "owner" }, settings: { register() {}, get: () => automated } };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  globalThis.foundry = { utils: { getProperty: (object, path) => path.split(".").reduce((o, k) => o?.[k], object) } };
  registerConditions();
  function actor(id = "hero") {
    const effects = new Map(),
      deleted = [];
    const a = {
      uuid: `Actor.${id}`,
      type: "character",
      system: { health: { value: 80, damage: 20, max: 100 } },
      effects: { [Symbol.iterator]: () => effects.values(), get: id => effects.get(id) },
      get statuses() {
        return new Set([...effects.values()].filter(e => !e.disabled).flatMap(e => [...e.statuses]));
      },
      async deleteEmbeddedDocuments(type, ids) {
        deleted.push(...ids);
        for (const id of ids) effects.delete(id);
        return ids;
      }
    };
    const add = (id, statuses = ["bleeding"], disabled = false) => {
      const effect = {
        id,
        statuses: new Set(statuses),
        disabled,
        async update(changes) {
          effect.statuses = new Set(changes.statuses);
          return effect;
        }
      };
      effects.set(id, effect);
      return effect;
    };
    add("old");
    return { a, add, effects, deleted };
  }
  const finish = async (a, changes, options, userId = "owner") => {
    await hooks.updateActor(a, changes, options, userId);
    await queuedAction(a.uuid, async () => {});
  };
  return {
    actor,
    hooks,
    finish,
    errors,
    setAutomated: value => {
      automated = value;
    }
  };
}

const healing = () => ({ system: { health: { damage: 10 } } });

test("healing respects the Bleeding automation opt-out", async () => {
  const f = fixture(),
    { a } = f.actor(),
    changes = healing(),
    options = {};
  f.setAutomated(false);
  f.hooks.preUpdateActor(a, changes, options);
  a.system.health = { value: 90, damage: 10, max: 100 };
  await f.finish(a, changes, options);
  assert.equal(a.statuses.has("bleeding"), true);
});

test("reducing stored damage without an actual Health gain is not healing", async () => {
  for (const value of [80, 70]) {
    const f = fixture(),
      { a } = f.actor(),
      changes = healing(),
      options = {};
    f.hooks.preUpdateActor(a, changes, options);
    a.system.health = { value, damage: 10, max: value + 10 };
    await f.finish(a, changes, options);
    assert.equal(a.statuses.has("bleeding"), true);
  }
});

test("actual healing ends only the Bleeding present before the update", async () => {
  const f = fixture(),
    { a, effects, add } = f.actor(),
    changes = healing(),
    options = {};
  f.hooks.preUpdateActor(a, changes, options);
  a.system.health = { value: 90, damage: 10, max: 100 };
  effects.delete("old");
  add("new");
  await f.finish(a, changes, options);
  assert.equal(effects.has("new"), true);
});

test("shared batch options cannot transfer one character's healing to another", async () => {
  const f = fixture(),
    one = f.actor("one"),
    two = f.actor("two"),
    changes = healing(),
    options = {};
  f.hooks.preUpdateActor(one.a, changes, options);
  f.hooks.preUpdateActor(two.a, { system: { ap: { value: 10 } } }, options);
  one.a.system.health.value = 90;
  one.a.system.health.damage = 10;
  await f.finish(one.a, changes, options);
  await f.finish(two.a, { system: { ap: { value: 10 } } }, options);
  assert.equal(one.a.statuses.has("bleeding"), false);
  assert.equal(two.a.statuses.has("bleeding"), true);
});

test("healing preserves other composite statuses, disabled effects and later Bleeding", async () => {
  const f = fixture(),
    { a, effects, add } = f.actor(),
    changes = healing(),
    options = {};
  add("composite", ["bleeding", "poison"]);
  add("disabled", ["bleeding"], true);
  f.hooks.preUpdateActor(a, changes, options);
  a.system.health.value = 90;
  a.system.health.damage = 10;
  add("later");
  await f.finish(a, changes, options);
  assert.deepEqual([...effects.get("composite").statuses], ["poison"]);
  assert.equal(effects.has("old"), false);
  assert.equal(effects.has("disabled"), true);
  assert.equal(effects.has("later"), true);
});

test("corrections, damage, unchanged Health and unrelated edits never clear Bleeding", async () => {
  for (const [changes, options] of [
    [healing(), { worldsBeyondCorrection: true }],
    [{ system: { health: { damage: 30 } } }, {}],
    [{ system: { health: { damage: 20 } } }, {}],
    [{ system: { health: { maxOverride: 120 } } }, {}],
    [{ system: { ap: { value: 10 } } }, {}]
  ]) {
    const f = fixture(),
      { a } = f.actor();
    f.hooks.preUpdateActor(a, changes, options);
    a.system.health.value = 90;
    await f.finish(a, changes, options);
    assert.equal(a.statuses.has("bleeding"), true);
  }
});

test("only the initiating client removes Bleeding and queued cleanup rechecks the opt-out", async () => {
  const f = fixture(),
    { a } = f.actor(),
    changes = healing(),
    options = {};
  f.hooks.preUpdateActor(a, changes, options);
  a.system.health.value = 90;
  await f.finish(a, changes, options, "another-client");
  assert.equal(a.statuses.has("bleeding"), true);
  const lock = queuedAction(a.uuid, async () => {
    f.setAutomated(false);
  });
  const pending = f.finish(a, changes, options);
  await lock;
  await pending;
  assert.equal(a.statuses.has("bleeding"), true);
});

test("stale options are cleared for reused operations and non-character Health is ignored", async () => {
  const f = fixture(),
    { a } = f.actor(),
    changes = healing(),
    options = {};
  f.hooks.preUpdateActor(a, changes, options);
  f.hooks.preUpdateActor(a, { name: "Changed" }, options);
  a.system.health.value = 90;
  await f.finish(a, changes, options);
  assert.equal(a.statuses.has("bleeding"), true);
  a.type = "other";
  f.hooks.preUpdateActor(a, changes, options);
  await f.finish(a, changes, options);
  assert.equal(a.statuses.has("bleeding"), true);
});

test("suppressed sources are not ended and cancelled healing has no post-update cleanup", async () => {
  const f = fixture(),
    { a, add, effects } = f.actor(),
    changes = healing(),
    options = {};
  const suppressed = add("suppressed");
  suppressed.isSuppressed = true;
  f.hooks.preUpdateActor(a, changes, options);
  assert.equal(effects.has("old"), true, "a cancelled update never invokes the post-update hook");
  a.system.health.value = 90;
  a.system.health.damage = 10;
  await f.finish(a, changes, options);
  assert.equal(effects.has("old"), false);
  assert.equal(effects.has("suppressed"), true);
});

test("a rejected effect removal is reported without an unhandled hook rejection", async () => {
  const f = fixture(),
    { a } = f.actor(),
    changes = healing(),
    options = {};
  f.hooks.preUpdateActor(a, changes, options);
  a.system.health.value = 90;
  a.system.health.damage = 10;
  a.deleteEmbeddedDocuments = async () => {
    throw new Error("native effect deletion failed");
  };
  await f.finish(a, changes, options);
  assert.equal(a.statuses.has("bleeding"), true);
  assert.deepEqual(f.errors, ["native effect deletion failed"]);
});
