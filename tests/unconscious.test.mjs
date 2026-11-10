import { test } from "node:test";
import assert from "node:assert/strict";
import { unconsciousHeldGear, unconsciousCause, unconsciousWakes } from "../module/unconscious-core.mjs";
import {
  prepareUnconsciousCreate,
  prepareUnconsciousUpdate,
  prepareUnconsciousHealth,
  startUnconscious,
  dropUnconsciousGear,
  wakeUnconscious,
  registerUnconscious
} from "../module/unconscious.mjs";
import { applyCondition, removeCondition } from "../module/conditions.mjs";
import { syncDying } from "../module/death.mjs";

const get = (d, p) => (Object.hasOwn(d, p) ? d[p] : p.split(".").reduce((o, k) => o?.[k], d));
const set = (d, p, v) => {
  const keys = p.split("."),
    last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), d)[last] = v;
};
const gear = (id, type = "weapon", properties = {}) => ({ id, name: id, type, system: { equipped: true, quantity: 1, properties } });
class Collection extends Map {
  [Symbol.iterator]() {
    return this.values();
  }
}

function fixture() {
  const calls = { items: [], updates: [], notices: [], errors: [], hooks: {}, settings: {}, failDrop: false, cancelRemove: false };
  let counter = 0;
  const actor = {
    documentName: "Actor",
    type: "character",
    uuid: "Actor.sleeper",
    name: "Sleeper",
    isOwner: true,
    system: {
      level: 5,
      health: { max: 100, value: 100, damage: 0 },
      ap: { value: 5 },
      exhaustion: 0,
      dying: { trauma: 0, stabilized: false },
      stats: { vit: { value: 12 } }
    },
    items: new Collection(
      [
        gear("sword"),
        gear("shield", "shield"),
        gear("strapped", "weapon", { strapped: true }),
        gear("armor", "armor"),
        gear("ring", "accessory")
      ].map(i => [i.id, i])
    ),
    effects: new Collection(),
    get statuses() {
      return new Set([...this.effects].filter(e => !e.disabled && !e.isSuppressed).flatMap(e => [...e.statuses]));
    },
    async update(changes) {
      calls.updates.push(changes);
      for (const [p, v] of Object.entries(changes)) set(this, p, v);
      this.system.health.value = this.system.health.max - this.system.health.damage;
      return this;
    },
    async updateEmbeddedDocuments(type, changes, options = {}) {
      calls.items.push({ type, changes, options });
      for (const [n, change] of changes.entries()) {
        const item = this.items.get(change._id);
        if (item) item.system.equipped = change["system.equipped"];
        if (calls.failDrop && options.worldsBeyondConditionDrop && n === 0) throw new Error("partial drop failure");
      }
      return changes;
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (calls.cancelRemove) return [];
      for (const id of ids) this.effects.delete(id);
      return ids;
    },
    async toggleStatusEffect(id) {
      return create([id]);
    }
  };
  const effect = (statuses, extra = {}) => {
    const e = {
      id: `effect${++counter}`,
      parent: actor,
      statuses: new Set(statuses),
      disabled: false,
      isSuppressed: false,
      flags: {},
      ...extra
    };
    e.uuid = `${actor.uuid}.ActiveEffect.${e.id}`;
    e.updateSource = changes => {
      for (const [p, v] of Object.entries(changes)) set(e, p, v);
    };
    e.clone = changes => {
      const n = effect([...e.statuses], { ...e, flags: structuredClone(e.flags) });
      for (const [p, v] of Object.entries(changes)) p === "statuses" ? (n.statuses = new Set(v)) : set(n, p, v);
      return n;
    };
    e.update = async (changes, options = {}) => {
      prepareUnconsciousUpdate(e, changes, options);
      for (const [p, v] of Object.entries(changes)) p === "statuses" ? (e.statuses = new Set(v)) : set(e, p, v);
      await startUnconscious(e, options, "tester", true);
      return e;
    };
    return e;
  };
  const create = async (statuses, extra = {}, options = {}) => {
    const e = effect(statuses, extra);
    prepareUnconsciousCreate(e, {}, options);
    actor.effects.set(e.id, e);
    await startUnconscious(e, options, "tester");
    return e;
  };
  globalThis.game = {
    user: { id: "tester" },
    combats: [],
    settings: {
      get: (_s, k) => calls.settings[k],
      register: (_s, k, d) => {
        calls.setting = { key: k, ...d };
      }
    }
  };
  globalThis.ui = { notifications: { info: m => calls.notices.push(m), error: m => calls.errors.push(m) } };
  globalThis.Hooks = {
    on: (k, fn) => {
      calls.hooks[k] = fn;
    }
  };
  globalThis.foundry = {
    utils: { getProperty: get, setProperty: set, hasProperty: (d, p) => get(d, p) !== undefined },
    documents: {
      ActiveEffect: {
        implementation: {
          fromStatusEffect: async id => ({ toObject: () => ({ statuses: [id] }) }),
          create: async data => create(data.statuses, { flags: data.flags ?? {} })
        }
      }
    }
  };
  const health = async (damage, options = {}) => {
    options.worldsBeyondHealthBefore = actor.system.health.value;
    prepareUnconsciousHealth(actor, { "system.health.damage": damage }, options);
    await actor.update({ "system.health.damage": damage });
    await syncDying(actor, options, {});
  };
  return { actor, calls, effect, create, health };
}

test("only held weapons/shields drop; worn, Strapped and stowed records stay", () => {
  const { actor } = fixture();
  actor.items.set("stowed", { ...gear("stowed"), system: { equipped: false } });
  assert.deepEqual(
    unconsciousHeldGear(actor.items).map(i => i.id),
    ["sword", "shield"]
  );
  actor.items.get("sword").system.properties.twoHanded = true;
  assert.deepEqual(
    unconsciousHeldGear(actor.items).map(i => i.id),
    ["sword", "shield"],
    "both valid or legacy held records release once"
  );
});

test("waking needs actual healing or damaging positive-Health non-damage knockouts, never corrections or zero damage", () => {
  assert.equal(unconsciousCause(null, 100), "other");
  assert.equal(unconsciousCause(null, 0), "health");
  assert.equal(unconsciousCause("health", 50), "health");
  const base = { cause: "other", beforeDamage: 0, afterDamage: 5, afterHealth: 95, damage: true };
  assert.equal(unconsciousWakes(base), true);
  for (const changes of [{ damage: false }, { afterDamage: 0 }, { afterHealth: 0 }, { correction: true }, { cause: "health" }])
    assert.equal(unconsciousWakes({ ...base, ...changes }), false);
  assert.equal(unconsciousWakes({ ...base, cause: "health", beforeDamage: 10, afterDamage: 5, damage: false }), true);
});

test("new Unconscious marks its cause, drops gear for no AP, adds Prone and does not auto-retrieve on waking", async () => {
  const { actor, calls, create, health } = fixture();
  const e = await create(["unconscious"]);
  assert.equal(e.flags["worlds-beyond"].unconsciousCause, "other");
  assert.equal(actor.statuses.has("prone"), true);
  assert.equal(actor.items.get("sword").system.equipped, false);
  assert.equal(actor.items.get("shield").system.equipped, false);
  assert.equal(actor.items.get("strapped").system.equipped, true);
  assert.equal(actor.items.get("armor").system.equipped, true);
  assert.equal(actor.system.ap.value, 5);
  assert.equal(calls.items.length, 1);
  assert.equal(calls.items[0].options.worldsBeyondFormRestore, true, "skip unrelated normalization");
  await health(5, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), false);
  assert.equal(actor.statuses.has("prone"), true);
  assert.equal(actor.items.get("sword").system.equipped, false);
  assert.equal(actor.system.dying.trauma, 0);
  assert.equal(actor.system.exhaustion, 0);
});

test("a zero-Health knockout stays down on damage and only wakes once healed above zero", async () => {
  const { actor, health } = fixture();
  await health(100, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), true);
  assert.equal(actor.system.exhaustion, 1);
  const e = [...actor.effects].find(e => e.statuses.has("unconscious"));
  assert.equal(e.flags["worlds-beyond"].unconsciousCause, "health");
  await health(104, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), true);
  assert.equal(actor.system.exhaustion, 1);
  await health(100);
  assert.equal(actor.statuses.has("unconscious"), true);
  await health(99);
  assert.equal(actor.statuses.has("unconscious"), false);
  assert.equal(actor.statuses.has("prone"), true);
  assert.equal(actor.system.dying.trauma, 1);
});

test("damage that knocks a sleeper to zero converts the cause instead of briefly leaving it awake", async () => {
  const { actor, create, health } = fixture();
  const e = await create(["unconscious"]);
  await health(100, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), true);
  assert.equal(actor.effects.has(e.id), true);
  assert.equal(e.flags["worlds-beyond"].unconsciousCause, "health");
  assert.equal(actor.system.exhaustion, 1);
  await health(101, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), true);
});

test("healing a positive-Health sleeper wakes it with no Trauma, and composite statuses survive", async () => {
  const { actor, create, health } = fixture();
  await actor.update({ "system.health.damage": 20 });
  const e = await create(["unconscious", "poison"]);
  await health(15);
  assert.equal(actor.statuses.has("unconscious"), false);
  assert.equal(actor.statuses.has("poison"), true);
  assert.equal(actor.effects.has(e.id), true);
  assert.equal(actor.system.dying.trauma, 0);
  assert.equal(actor.statuses.has("prone"), true);
});

test("raw damage edits and transaction corrections do not wake; immunity/zero damage spends no status", async () => {
  const { actor, create, health } = fixture();
  await create(["unconscious"]);
  await health(0, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), true);
  await health(5);
  assert.equal(actor.statuses.has("unconscious"), true);
  await health(8, { worldsBeyondDamage: true, worldsBeyondCorrection: true });
  assert.equal(actor.statuses.has("unconscious"), true);
});

test("only sources captured before damage wake, not another source created while the update finishes", async () => {
  const { actor, create } = fixture();
  const old = await create(["unconscious"]),
    options = { worldsBeyondDamage: true };
  prepareUnconsciousHealth(actor, { "system.health.damage": 5 }, options);
  const fresh = await create(["unconscious"]);
  await actor.update({ "system.health.damage": 5 });
  await wakeUnconscious(actor, options);
  assert.equal(actor.effects.has(old.id), false);
  assert.equal(actor.effects.has(fresh.id), true);
});

test("name edits and additional active sources don't redrop corrected gear; a fresh reactivation does", async () => {
  const { actor, create } = fixture();
  const e = await create(["unconscious"]);
  actor.items.get("sword").system.equipped = true;
  await e.update({ name: "Renamed" });
  assert.equal(actor.items.get("sword").system.equipped, true);
  const extra = await create(["unconscious"]);
  assert.equal(actor.items.get("sword").system.equipped, true);
  await e.update({ disabled: true });
  await extra.update({ disabled: true });
  await e.update({ disabled: false });
  assert.equal(actor.items.get("sword").system.equipped, false);
});

test("drop failure compensates partial item writes without changing AP, quantities or unrelated equipment", async () => {
  const { actor, calls } = fixture();
  calls.failDrop = true;
  await assert.rejects(dropUnconsciousGear(actor), /partial drop failure.*retained/);
  for (const item of actor.items) assert.equal(item.system.equipped, true);
  assert.equal(actor.system.ap.value, 5);
  assert.equal(actor.items.get("sword").system.quantity, 1);
  assert.equal(calls.items.length, 2);
});

test("default-on world opt-out, item definitions, foreign clients and rollback restoration do not drop gear", async () => {
  const { actor, calls, effect, create } = fixture();
  registerUnconscious();
  assert.equal(calls.setting.key, "automateUnconscious");
  assert.equal(calls.setting.default, true);
  const e = effect(["unconscious"]);
  await startUnconscious(e, {}, "other-client");
  await startUnconscious({ ...e, parent: { documentName: "Item" } }, {}, "tester");
  await startUnconscious(e, { worldsBeyondCorrection: true }, "tester");
  assert.equal(calls.items.length, 0);
  calls.settings.automateUnconscious = false;
  await create(["unconscious"]);
  assert.equal(calls.items.length, 0);
  assert.equal(actor.statuses.has("prone"), false);
});

test("waking works independently of death/exhaustion automation and a rejected removal reports correction", async () => {
  const { actor, calls, create, health } = fixture();
  calls.settings.automateDeath = false;
  calls.settings.automateExhaustion = false;
  await create(["unconscious"]);
  calls.cancelRemove = true;
  await assert.rejects(health(5, { worldsBeyondDamage: true }), /Could not end unconscious/);
  assert.equal(actor.statuses.has("unconscious"), true);
  calls.cancelRemove = false;
  await health(10, { worldsBeyondDamage: true });
  assert.equal(actor.statuses.has("unconscious"), false);
});

test("ending a composite condition preserves its other statuses even outside the waking pipeline", async () => {
  const { actor, create } = fixture();
  const e = await create(["bleeding", "poison"]);
  await removeCondition(actor, "bleeding");
  assert.deepEqual([...e.statuses], ["poison"]);
  assert.equal(actor.effects.has(e.id), true);
  await applyCondition(actor, "unconscious");
  assert.equal(actor.statuses.has("prone"), true);
});
