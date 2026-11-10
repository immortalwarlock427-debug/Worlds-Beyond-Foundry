import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDeath } from "../module/death.mjs";
import { registerUnconscious } from "../module/unconscious.mjs";

const get = (o, p) => (Object.hasOwn(o, p) ? o[p] : p.split(".").reduce((v, k) => v?.[k], o));
const set = (o, p, value) => {
  const keys = p.split("."),
    last = keys.pop();
  keys.reduce((v, k) => (v[k] ??= {}), o)[last] = value;
};
class Collection extends Map {
  [Symbol.iterator]() {
    return this.values();
  }
}

function fixture() {
  const hooks = {},
    errors = [],
    settings = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] ??= []).push(fn) };
  globalThis.game = { user: { id: "owner" }, combats: [], settings: { register() {}, get: (_scope, key) => settings[key] } };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  globalThis.foundry = {
    utils: { getProperty: get, setProperty: set, hasProperty: (o, p) => get(o, p) !== undefined },
    documents: {
      ActiveEffect: {
        implementation: {
          fromStatusEffect: async id => ({ toObject: () => ({ statuses: [id] }) }),
          create: async (data, { parent }) => parent.addEffect(`new-${data.statuses[0]}`, data.statuses)
        }
      }
    }
  };
  registerDeath();
  registerUnconscious();
  function actor(id, health = 10, damage = 100 - health) {
    const a = {
      uuid: `Actor.${id}`,
      name: id,
      type: "character",
      effects: new Collection(),
      system: {
        level: 5,
        stats: { vit: { value: 12 } },
        health: { max: 100, value: health, damage },
        exhaustion: 0,
        dying: { trauma: 0, stabilized: false }
      },
      get statuses() {
        return new Set([...a.effects].filter(e => !e.disabled).flatMap(e => [...e.statuses]));
      },
      addEffect(id, statuses = ["unconscious"], cause = "health") {
        const e = {
          id,
          statuses: new Set(statuses),
          flags: { "worlds-beyond": { unconsciousCause: cause } },
          async update(changes) {
            for (const [p, v] of Object.entries(changes)) p === "statuses" ? (e.statuses = new Set(v)) : set(e, p, v);
            return e;
          }
        };
        a.effects.set(id, e);
        return e;
      },
      async update(changes) {
        for (const [p, v] of Object.entries(changes)) set(a, p, v);
        return a;
      },
      async deleteEmbeddedDocuments(_type, ids) {
        for (const id of ids) a.effects.delete(id);
        return ids;
      },
      async toggleStatusEffect(id) {
        return a.addEffect(id, [id]);
      }
    };
    return a;
  }
  const pre = (a, changes, options) => {
    for (const fn of hooks.preUpdateActor) fn(a, changes, options);
  };
  const post = async (a, changes, options, userId = "owner") => {
    for (const fn of hooks.updateActor) await fn(a, changes, options, userId);
    // Original callback did not return its promise; drain its bounded async work too.
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { actor, pre, post, errors, settings };
}
const healthChange = damage => ({ system: { health: { damage } } });
const finishHealth = (a, damage) => {
  a.system.health.damage = damage;
  a.system.health.value = a.system.health.max - damage;
};

test("batch recoveries use each actor's own before Health in either update order", async () => {
  for (const reverse of [false, true]) {
    const f = fixture(),
      down = f.actor("down", 0),
      up = f.actor("up", 40),
      options = {};
    down.addEffect("sleep");
    down.system.dying.stabilized = true;
    const changes = [
      [down, healthChange(99)],
      [up, healthChange(50)]
    ];
    if (reverse) changes.reverse();
    for (const [a, c] of changes) f.pre(a, c, options);
    finishHealth(down, 99);
    finishHealth(up, 50);
    for (const [a, c] of changes) await f.post(a, c, options);
    assert.equal(down.system.dying.trauma, 1);
    assert.equal(down.system.dying.stabilized, false);
    assert.equal(down.statuses.has("unconscious"), false);
    assert.equal(up.system.dying.trauma, 0);
    assert.deepEqual(f.errors, []);
  }
});

test("batch knockouts add exhaustion only to the actor actually crossing zero", async () => {
  for (const reverse of [false, true]) {
    const f = fixture(),
      down = f.actor("down", 0),
      up = f.actor("up", 40),
      options = {};
    down.addEffect("sleep");
    const changes = [
      [down, healthChange(102)],
      [up, healthChange(100)]
    ];
    if (reverse) changes.reverse();
    for (const [a, c] of changes) f.pre(a, c, options);
    finishHealth(down, 102);
    finishHealth(up, 100);
    for (const [a, c] of changes) await f.post(a, c, options);
    assert.equal(down.system.exhaustion, 0);
    assert.equal(up.system.exhaustion, 1);
    assert.equal(up.statuses.has("unconscious"), true);
  }
});

test("an AP-only batch member cannot inherit another actor's recovery", async () => {
  const f = fixture(),
    down = f.actor("down", 0),
    other = f.actor("other", 30),
    options = {};
  down.addEffect("sleep");
  const change = healthChange(99),
    ap = { system: { ap: { value: 4 } } };
  f.pre(down, change, options);
  f.pre(other, ap, options);
  finishHealth(down, 99);
  await f.post(down, change, options);
  await f.post(other, ap, options);
  assert.equal(down.system.dying.trauma, 1);
  assert.equal(other.system.dying.trauma, 0);
});

test("waking snapshots isolate colliding embedded effect IDs and pre-hit damage", async () => {
  const f = fixture(),
    one = f.actor("one", 80),
    two = f.actor("two", 100),
    options = {};
  one.addEffect("same", ["unconscious", "poison"], "other");
  two.addEffect("same", ["unconscious"], "other");
  const heal = healthChange(10),
    unchanged = healthChange(0);
  f.pre(one, heal, options);
  f.pre(two, unchanged, options);
  finishHealth(one, 10);
  await f.post(one, heal, options);
  await f.post(two, unchanged, options);
  assert.equal(one.statuses.has("unconscious"), false);
  assert.equal(one.statuses.has("poison"), true);
  assert.equal(two.statuses.has("unconscious"), true);
});

test("unrelated batch members never wake from another character's sleeper snapshot", async () => {
  const f = fixture(),
    one = f.actor("one", 80),
    two = f.actor("two", 100),
    options = {};
  one.addEffect("same", ["unconscious"], "other");
  two.addEffect("same", ["unconscious"], "other");
  const heal = healthChange(10),
    ap = { system: { ap: { value: 4 } } };
  f.pre(one, heal, options);
  f.pre(two, ap, options);
  finishHealth(one, 10);
  await f.post(one, heal, options);
  await f.post(two, ap, options);
  assert.equal(two.statuses.has("unconscious"), true);
});

test("reusing options for an unrelated edit clears only that actor's stale snapshots", async () => {
  const f = fixture(),
    a = f.actor("a", 0),
    b = f.actor("b", 0),
    options = {};
  a.addEffect("same");
  b.addEffect("same");
  const heal = healthChange(99),
    name = { name: "Renamed" };
  f.pre(a, heal, options);
  f.pre(b, heal, options);
  f.pre(a, name, options);
  finishHealth(a, 99);
  finishHealth(b, 99);
  await f.post(a, name, options);
  await f.post(b, heal, options);
  assert.equal(a.system.dying.trauma, 0);
  assert.equal(a.statuses.has("unconscious"), true);
  assert.equal(b.system.dying.trauma, 1);
  assert.equal(b.statuses.has("unconscious"), false);
});

test("serialized native-style options preserve UUID isolation for unlinked actor copies", async () => {
  const f = fixture(),
    one = f.actor("base", 0),
    two = f.actor("copy", 30),
    options = {};
  one.uuid = "Scene.test.Token.one.Actor.base";
  two.uuid = "Scene.test.Token.two.Actor.base";
  const heal = healthChange(99),
    other = healthChange(60);
  f.pre(one, heal, options);
  f.pre(two, other, options);
  finishHealth(one, 99);
  finishHealth(two, 60);
  const transported = JSON.parse(JSON.stringify(options));
  await f.post(one, heal, transported);
  await f.post(two, other, transported);
  assert.equal(one.system.dying.trauma, 1);
  assert.equal(two.system.dying.trauma, 0);
});

test("foreign clients and disabled death/exhaustion/waking automation make no recovery edits", async () => {
  for (const foreign of [false, true]) {
    const f = fixture(),
      a = f.actor("a", 0),
      options = {},
      heal = healthChange(99);
    a.addEffect("sleep");
    if (!foreign) Object.assign(f.settings, { automateDeath: false, automateExhaustion: false, automateUnconscious: false });
    f.pre(a, heal, options);
    finishHealth(a, 99);
    await f.post(a, heal, options, foreign ? "another" : "owner");
    assert.equal(a.system.dying.trauma, 0);
    assert.equal(a.statuses.has("unconscious"), true);
  }
});

test("correction recovery and explicit Trauma edits preserve existing manual semantics", async () => {
  for (const correction of [false, true]) {
    const f = fixture(),
      a = f.actor("a", 0),
      options = { worldsBeyondCorrection: correction },
      heal = healthChange(99);
    a.addEffect("sleep");
    if (!correction) heal.system.dying = { trauma: 7 };
    f.pre(a, heal, options);
    finishHealth(a, 99);
    if (!correction) a.system.dying.trauma = 7;
    await f.post(a, heal, options);
    assert.equal(a.system.dying.trauma, correction ? 0 : 7);
  }
});

test("Mercy still uses each actor's own maximum and threshold before a batch save", () => {
  const f = fixture(),
    one = f.actor("one", 5),
    two = f.actor("two", -2),
    options = { worldsBeyondDamage: true };
  const hitOne = healthChange(150),
    hitTwo = healthChange(115);
  f.pre(one, hitOne, options);
  f.pre(two, hitTwo, options);
  assert.equal(hitOne.system.health.damage, 108);
  assert.equal(hitTwo.system.health.damage, 115);
});

test("cancelled native updates have no consequences and do not spoil the next snapshot", async () => {
  const f = fixture(),
    a = f.actor("a", 0),
    options = {},
    heal = healthChange(99);
  a.addEffect("sleep");
  f.pre(a, heal, options); // Native cancellation: no save and no post hook.
  assert.equal(a.system.dying.trauma, 0);
  assert.equal(a.statuses.has("unconscious"), true);
  const unrelated = { system: { health: { maxOverride: 120 } } };
  f.pre(a, unrelated, options);
  await f.post(a, unrelated, options);
  assert.equal(a.system.dying.trauma, 0);
  assert.equal(a.statuses.has("unconscious"), true);
  f.pre(a, heal, options);
  finishHealth(a, 99);
  await f.post(a, heal, options);
  assert.equal(a.system.dying.trauma, 1);
});

test("non-characters and invalid Health changes clear reused baselines rather than consume them", async () => {
  for (const invalid of [null, "not a number", Infinity]) {
    const f = fixture(),
      a = f.actor("a", 0),
      options = {},
      heal = healthChange(99);
    f.pre(a, heal, options);
    f.pre(a, healthChange(invalid), options);
    finishHealth(a, 99);
    await f.post(a, heal, options);
    assert.equal(a.system.dying.trauma, 0);
  }
  const f = fixture(),
    a = f.actor("a", 0),
    options = {},
    heal = healthChange(99);
  f.pre(a, heal, options);
  a.type = "other";
  f.pre(a, heal, options);
  finishHealth(a, 99);
  a.type = "character";
  await f.post(a, heal, options);
  assert.equal(a.system.dying.trauma, 0);
});
