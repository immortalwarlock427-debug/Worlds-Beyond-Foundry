import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { itemEffectState } from "../module/effects-core.mjs";
import {
  activeLoadoutForm,
  equipmentPlan,
  formShowsAbility,
  formShowsResource,
  formLoadoutFormUpdates
} from "../module/form-loadout-core.mjs";
import { syncFormLoadout, copyFormEquipment, setCharacterPortrait, registerFormLoadouts } from "../module/form-loadouts.mjs";
import { reversibleAction } from "../module/action-support.mjs";
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  applications: { api: { DocumentSheetV2: class {}, HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } }
};
const { useAbility } = await import("../module/abilities.mjs");
const { captureFormTriggers, processFormTriggers } = await import("../module/form-triggers.mjs");
const { returnToBase } = await import("../module/forms.mjs");
const get = (data, path) => path.split(".").reduce((value, key) => value?.[key], data);
class DeleteField {}
class ReplaceField {
  constructor(value) {
    this.value = structuredClone(value);
  }
}
function merge(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof DeleteField) delete target[key];
    else if (value instanceof ReplaceField) target[key] = structuredClone(value.value);
    else if (value && typeof value === "object" && !Array.isArray(value)) merge((target[key] ??= {}), value);
    else target[key] = value;
  }
}
function apply(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split("."),
      key = parts.pop(),
      parent = parts.reduce((value, key) => (value[key] ??= {}), target);
    merge(parent, { [key]: value });
  }
}
function fixture() {
  const calls = [],
    errors = [];
  const actor = {
    uuid: "Actor.hero",
    type: "character",
    isOwner: true,
    img: "base.png",
    flags: {},
    items: new Map(),
    effects: [],
    system: {
      ap: { value: 17, max: 17 },
      health: { damage: 12.5 },
      customResources: { blood: { value: 80, max: 100, spent: 20 } },
      stats: {}
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update(changes, options) {
      calls.push({ changes: structuredClone(changes), options });
      apply(this, changes);
      return this;
    },
    async updateEmbeddedDocuments(type, updates, options) {
      calls.push({ updates: structuredClone(updates), options });
      for (const { _id, ...changes } of updates) apply(this.items.get(_id), changes);
      return updates.map(update => this.items.get(update._id));
    }
  };
  const item = (id, type, system) => {
    const doc = {
      id,
      uuid: `${actor.uuid}.Item.${id}`,
      documentName: "Item",
      actor,
      name: id,
      type,
      isOwner: true,
      system,
      effects: new Map(),
      async update(changes, options) {
        apply(this, changes);
        return this;
      }
    };
    actor.items.set(id, doc);
    return doc;
  };
  const sword = item("sword", "weapon", { equipped: true, shots: 2, properties: {} });
  const axe = item("axe", "weapon", { equipped: false, shots: 1, properties: { twoHanded: true } });
  const shield = item("shield", "shield", { equipped: false });
  const form = (id, equipment, portrait) =>
    item(id, "ability", {
      kind: "form",
      effectsActive: false,
      apCost: 3,
      uses: { max: 5, spent: 1 },
      cooldown: { remaining: 0 },
      loadout: { gearEnabled: true, equipment, portrait }
    });
  const first = form("first", { axe: true }, "first.png"),
    second = form("second", { sword: true, shield: true }, "second.png");
  globalThis.game = {
    user: { id: "gm", isActiveGM: true },
    users: { activeGM: {} },
    combats: [{ started: true, combatants: [{ actor }] }],
    settings: { get: () => "public" },
    actors: [actor]
  };
  Object.assign(foundry, {
    data: { operators: { ForcedDeletion: DeleteField, ForcedReplacement: ReplaceField } },
    utils: { getProperty: get, equals: isDeepStrictEqual },
    documents: { ChatMessage: { implementation: { getSpeaker: () => ({}), create: async data => ({ id: "post", ...data }) } } }
  });
  globalThis.ui = { notifications: { error: text => errors.push(text), info() {}, warn() {} } };
  return { actor, item, first, second, sword, axe, shield, calls, errors };
}
const sync = (actor, options) => reversibleAction(change => syncFormLoadout(actor, change, options));

function tokenFixture(f) {
  f.actor.prototypeToken = { width: 1, height: 1, texture: { src: "prototype.webp", scaleX: 1, scaleY: 1 } };
  const calls = [],
    tokens = [];
  for (const [id, linked] of [
    ["one", true],
    ["two", true],
    ["copy", false]
  ]) {
    const token = {
      id,
      actorLink: linked,
      parent: { id: "scene", grid: { size: 100 } },
      x: 300,
      y: 400,
      width: 1,
      height: 1,
      texture: { src: id + ".webp", scaleX: 1.2, scaleY: 0.8 },
      async update(changes, options) {
        assert.equal(options.parentUuid, undefined, "fresh token operation");
        options.parentUuid = "Scene.scene";
        calls.push({ id, changes, options });
        if (token.failOnce) {
          token.failOnce = false;
          return null;
        }
        apply(token, changes);
        return token;
      }
    };
    tokens.push(token);
  }
  f.actor.getActiveTokens = (linked, document) => {
    assert.equal(linked, true);
    assert.equal(document, true);
    return tokens.filter(t => t.actorLink);
  };
  f.actor.getDependentTokens = () => tokens.filter(t => t.actorLink);
  Object.assign(f.first.system.loadout, {
    tokenImg: "monstrous.webp",
    tokenWidth: 2,
    tokenHeight: 2,
    tokenScale: 1.15,
    transitionSeconds: 1.5
  });
  return { tokens, calls };
}

test("linked forms transform the prototype and active linked tokens, then Base restores each original", async () => {
  const f = fixture(),
    t = tokenFixture(f);
  await useAbility(f.actor, f.first.id);
  assert.equal(f.actor.prototypeToken.width, 2);
  assert.equal(f.actor.prototypeToken.texture.scaleX, 1.15);
  for (const token of t.tokens.slice(0, 2)) {
    assert.equal(token.width, 2);
    assert.equal(token.height, 2);
    assert.equal(token.texture.src, "monstrous.webp");
    assert.equal(token.x, 300);
    assert.equal(token.y, 400);
  }
  assert.equal(t.tokens[2].texture.src, "copy.webp");
  assert.equal(t.calls[0].options.animate, true);
  assert.equal(t.calls[0].options.animation.duration, 1500);
  assert.equal(t.calls[0].options.animation.transition, "fade");
  f.actor.flags = JSON.parse(JSON.stringify(f.actor.flags));
  await returnToBase(f.actor);
  assert.equal(f.actor.prototypeToken.texture.src, "prototype.webp");
  assert.equal(f.actor.prototypeToken.width, 1);
  for (const token of t.tokens) {
    assert.equal(token.texture.src, token.id + ".webp");
    assert.equal(token.width, 1);
    assert.equal(token.texture.scaleX, 1.2);
    assert.equal(token.texture.scaleY, 0.8);
  }
});

test("encoded form art and fractional art scale use only native token document updates", async () => {
  for (const seconds of [0, 1.25]) {
    const f = fixture(),
      t = tokenFixture(f),
      src = "assets/Characters/Aran%20Transformed%20(Token).png";
    Object.assign(f.first.system.loadout, { tokenImg: src, transitionSeconds: seconds });
    // No renderer, PIXI texture loader, mesh, or filter exists in this fixture.
    // Animated and immediate entry must commit the same appearance.
    await useAbility(f.actor, f.first.id);
    const appearance = { src, scaleX: 1.15, scaleY: 1.15 };
    for (const token of t.tokens.slice(0, 2)) {
      assert.deepEqual(token.texture, appearance);
      assert.equal(token.width, 2);
      assert.equal(token.height, 2);
    }
    assert.equal(t.calls.length, 2, "one native update per active linked token");
    for (const { changes, options } of t.calls) {
      assert.deepEqual(changes, { "texture.src": src, "texture.scaleX": 1.15, "texture.scaleY": 1.15, width: 2, height: 2 });
      assert.equal(options.animate, seconds > 0);
      assert.equal(options.animation.duration, seconds * 1000);
      assert.equal(options.animation.transition, "fade");
      assert.equal(options.movement.showRuler, false);
    }
    await returnToBase(f.actor);
    assert.equal(t.calls.length, 4);
    for (const token of t.tokens.slice(0, 2)) {
      assert.equal(token.texture.src, `${token.id}.webp`);
      assert.equal(token.texture.scaleX, 1.2);
      assert.equal(token.texture.scaleY, 0.8);
      assert.equal(token.width, 1);
      assert.equal(token.height, 1);
    }
  }
});

test("synthetic forms update only their own unlinked token and restore even-growth offsets after movement", async () => {
  const f = fixture(),
    t = tokenFixture(f);
  f.actor.isToken = true;
  f.actor.token = t.tokens[2];
  f.actor.getActiveTokens = () => {
    throw new Error("Must not visit sibling tokens");
  };
  f.first.system.loadout.tokenWidth = 3;
  f.first.system.loadout.tokenHeight = 3;
  await useAbility(f.actor, f.first.id);
  assert.equal(t.tokens[2].x, 200);
  assert.equal(t.tokens[2].y, 300);
  t.tokens[2].x += 100;
  assert.equal(f.actor.prototypeToken.width, 1);
  assert.equal(t.tokens[0].width, 1);
  await useAbility(f.actor, f.first.id, { end: true });
  assert.equal(t.tokens[2].x, 400);
  assert.equal(t.tokens[2].y, 400);
  assert.equal(t.tokens[2].width, 1);
});

test("animated tokens are checked against stored values, not mid-animation display values", async () => {
  const f = fixture(),
    t = tokenFixture(f);
  // Model v14: the stored source changes at once, while the prepared values
  // keep showing the old size and art until the animation finishes.
  const token = t.tokens[2];
  token._source = { x: token.x, y: token.y, width: 1, height: 1, texture: { ...token.texture } };
  token.update = async (changes, options) => {
    t.calls.push({ id: token.id, changes, options });
    apply(token._source, changes);
    if (!options.animate) apply(token, changes);
    return token;
  };
  f.actor.isToken = true;
  f.actor.token = token;
  await useAbility(f.actor, f.first.id);
  assert.equal(token._source.width, 2);
  assert.equal(token._source.texture.src, "monstrous.webp");
  assert.equal(token._source.texture.scaleX, 1.15);
  assert.equal(f.first.system.effectsActive, true);
  await useAbility(f.actor, f.first.id, { end: true });
  assert.equal(token._source.width, 1);
  assert.equal(token._source.texture.src, "copy.webp");
  assert.equal(token._source.texture.scaleX, 1.2);
  assert.equal(token._source.texture.scaleY, 0.8);
});

test("unlinked token actors keep their own form receipt while the sidebar actor is transformed", async () => {
  const f = fixture(),
    t = tokenFixture(f);
  const token = t.tokens[2];
  // Model v14 ActorDelta: the token actor's flags are the sidebar flags with the
  // token's own stored flags merged on top, so sidebar keys can never be dropped.
  const sidebar = {
    "worlds-beyond": {
      formLoadoutState: {
        currentId: "first",
        basePortrait: "base.png",
        baseEquipment: { sword: true },
        gearEnabled: true,
        tokenState: {
          seconds: 1.5,
          targets: { prototype: { base: { src: "prototype.webp" }, fields: { src: true }, offsetX: 0, offsetY: 0 } }
        }
      }
    }
  };
  token.delta = { _source: { flags: {} } };
  const view = () => {
    f.actor.flags = structuredClone(sidebar);
    merge(f.actor.flags, structuredClone(token.delta._source.flags));
  };
  view();
  const update = f.actor.update;
  f.actor.update = async (changes, options) => {
    const own = {},
      rest = {};
    for (const [path, value] of Object.entries(changes)) {
      if (path.startsWith("flags.")) own[path.slice(6)] = value;
      else rest[path] = value;
    }
    apply(token.delta._source.flags, own);
    const result = await update.call(f.actor, rest, options);
    view();
    return result;
  };
  f.actor.isToken = true;
  f.actor.token = token;
  await useAbility(f.actor, f.first.id);
  const receipt = () => token.delta._source.flags["worlds-beyond"].formLoadoutState;
  assert.equal(receipt().currentId, "first");
  assert.equal(receipt().tokenState.targets.prototype, undefined);
  assert.equal(token.width, 2);
  assert.equal(f.actor.img, "first.png");
  await useAbility(f.actor, f.first.id, { end: true });
  assert.equal(token.width, 1);
  assert.equal(token.texture.src, "copy.webp");
  assert.equal(receipt().currentId, "");
});

test("failed token updates compensate prior tokens, prototype, form bonuses and costs", async () => {
  const f = fixture(),
    t = tokenFixture(f);
  t.tokens[1].failOnce = true;
  const effect = { parent: f.first, flags: { "worlds-beyond": { managed: true, itemBound: true } }, system: { changes: [] } };
  f.first.effects.set("bonus", effect);
  await assert.rejects(useAbility(f.actor, f.first.id), /transformation/);
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(itemEffectState(effect), "Ability inactive");
  assert.equal(f.actor.prototypeToken.width, 1);
  assert.equal(f.actor.prototypeToken.texture.src, "prototype.webp");
  for (const token of t.tokens) assert.equal(token.texture.src, token.id + ".webp");
  assert.equal(f.actor.system.ap.value, 17);
  assert.ok(t.calls.some(call => call.options.animate === false));
});

test("resource-triggered forms use the same animation and blank defaults leave token art untouched", async () => {
  let f = fixture(),
    t = tokenFixture(f),
    native = nativeOperations(f);
  f.actor.system.customResources[native.resource] = { value: 100, max: 100, spent: 0 };
  f.first.system.trigger = { mode: "automatic", resourceId: native.resource, comparison: "above", threshold: 100, endMode: "automatic" };
  await f.actor.update({ [`system.customResources.${native.resource}.spent`]: -1 });
  await native.drain();
  assert.equal(t.tokens[0].width, 2);
  assert.equal(t.calls[0].options.animation.duration, 1500);
  await f.actor.update({ [`system.customResources.${native.resource}.spent`]: 0 });
  await native.drain();
  assert.equal(t.tokens[0].width, 1);
  f = fixture();
  t = tokenFixture(f);
  f.first.system.loadout = { tokenImg: "", tokenWidth: null, tokenHeight: null, tokenScale: null, transitionSeconds: 0 };
  f.first.system.effectsActive = true;
  await sync(f.actor);
  assert.equal(f.calls.length, 0);
  assert.equal(t.calls.length, 0);
});

// v14 mutates operation objects: embedded writes add parentUuid, and subsequent
// root writes resolve that UUID even after Document.update sets parent to null.
// Model that lifecycle, including the real resource-trigger hook callbacks.
function nativeOperations(f) {
  const documents = new Map(),
    jobs = [],
    warnings = [],
    resource = "resource00000001";
  const actor = f.actor;
  actor.documentName = "Actor";
  actor.parent = null;
  game.user.id = "owner";
  ui.notifications.warn = text => warnings.push(text);
  const request = (documentName, parent, operation) => {
    operation.parent = parent;
    const resolved = parent ?? documents.get(operation.parentUuid);
    if (resolved && documentName === "Actor")
      throw new Error(`Actor is not a valid embedded Document within the ${resolved.documentName} Document`);
    if (resolved) operation.parentUuid = resolved.uuid;
    delete operation.parent;
  };
  const wrap = doc => {
    documents.set(doc.uuid, doc);
    const update = doc.update;
    doc.update = async (changes, operation = {}) => {
      request(doc.documentName, doc.parent, operation);
      if (doc === actor) captureFormTriggers(actor, changes, operation, "owner");
      const result = await update.call(doc, changes, operation);
      if (doc === actor) {
        const pool = actor.system.customResources[resource];
        if (pool) pool.value = pool.max - pool.spent;
        const job = processFormTriggers(actor, changes, operation, "owner");
        if (job) jobs.push(job);
      }
      return result;
    };
  };
  wrap(actor);
  for (const item of actor.items.values()) {
    item.parent = actor;
    wrap(item);
  }
  const batch = actor.updateEmbeddedDocuments;
  actor.updateEmbeddedDocuments = async (type, changes, operation = {}) => {
    request(type, actor, operation);
    return batch.call(actor, type, changes, operation);
  };
  return {
    resource,
    jobs,
    warnings,
    async drain() {
      for (let i = 0; i < jobs.length; i++) {
        assert.ok(i < 20, "Form hooks must settle instead of looping");
        await jobs[i];
      }
    }
  };
}

test("v14 operation metadata cannot leak from equipped Items into Actor portrait updates or Base restoration", async () => {
  const f = fixture(),
    native = nativeOperations(f);
  await useAbility(f.actor, f.first.id);
  assert.equal(f.actor.img, "first.png");
  assert.equal(f.axe.system.equipped, true);
  await useAbility(f.actor, f.second.id);
  assert.equal(f.actor.img, "second.png");
  assert.equal(f.first.system.effectsActive, false);
  await returnToBase(f.actor);
  await native.drain();
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.second.system.effectsActive, false);
  assert.equal(f.actor.system.ap.value, 11);
  assert.deepEqual(native.warnings, []);
});

test("triggered physical forms enter and end once without retrying their own portrait and equipment writes", async () => {
  const f = fixture(),
    native = nativeOperations(f),
    id = native.resource;
  f.actor.system.customResources[id] = { name: "Blood", max: 100, value: 100, spent: 0 };
  f.first.system.trigger = { mode: "automatic", resourceId: id, comparison: "above", threshold: 100, endMode: "automatic" };
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 });
  await native.drain();
  assert.equal(f.first.system.effectsActive, true);
  assert.equal(f.actor.img, "first.png");
  assert.equal(f.actor.system.ap.value, 14);
  assert.deepEqual(native.warnings, []);
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 });
  await native.drain();
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.actor.system.ap.value, 14);
  assert.deepEqual(native.warnings, []);
  assert.equal(native.jobs.length, 2, "Only the two external resource updates may evaluate triggers");
});

test("v14 form rollback restores gear, portrait, Base receipt and AP without reentering the trigger queue", async () => {
  const f = fixture(),
    native = nativeOperations(f);
  foundry.documents.ChatMessage.implementation.create = async () => {
    throw new Error("offline");
  };
  await assert.rejects(useAbility(f.actor, f.first.id), /offline/);
  await native.drain();
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.first.system.uses.spent, 1);
  assert.equal(f.actor.getFlag("worlds-beyond", "formLoadoutState"), undefined);
  assert.deepEqual(native.warnings, []);
});

test("deleting equipped inventory between switches prunes receipts and all presets", async () => {
  const f = fixture();
  await useAbility(f.actor, f.first.id);
  assert.equal(f.actor.getFlag("worlds-beyond", "formLoadoutState").baseEquipment.sword, true);
  f.first.system.loadout.equipment.sword = true;
  f.actor.items.delete("sword");
  await useAbility(f.actor, f.second.id);
  assert.equal(Object.hasOwn(f.actor.getFlag("worlds-beyond", "formLoadoutState").baseEquipment, "sword"), false);
  for (const form of [f.first, f.second]) assert.equal(Object.hasOwn(form.system.loadout.equipment, "sword"), false);
  await returnToBase(f.actor);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(f.second.system.effectsActive, false);
});

test("receipt verification ignores key order and a failed switch suppresses the new form's bonuses", async () => {
  const f = fixture(),
    update = f.actor.update;
  f.actor.update = async (...args) => {
    const result = await update.apply(f.actor, args);
    const state = f.actor.getFlag("worlds-beyond", "formLoadoutState");
    if (state) f.actor.flags["worlds-beyond"].formLoadoutState = Object.fromEntries(Object.entries(state).reverse());
    return result;
  };
  await useAbility(f.actor, f.first.id);
  const effect = { parent: f.second, flags: { "worlds-beyond": { managed: true, itemBound: true } }, system: { changes: [] } };
  f.second.effects.set("bonus", effect);
  foundry.documents.ChatMessage.implementation.create = async () => {
    throw new Error("offline");
  };
  await assert.rejects(useAbility(f.actor, f.second.id), /offline/);
  assert.equal(f.first.system.effectsActive, true);
  assert.equal(f.second.system.effectsActive, false);
  assert.equal(itemEffectState(effect), "Ability inactive");
});

test("paid forms switch gear/portrait and Base restores originals while balances, shots and uses stay shared", async () => {
  const f = fixture(),
    balance = structuredClone(f.actor.system);
  await useAbility(f.actor, f.first.id);
  assert.equal(f.actor.img, "first.png");
  assert.equal(f.sword.system.equipped, false);
  assert.equal(f.axe.system.equipped, true);
  assert.equal(f.actor.system.ap.value, 14);
  assert.equal(f.first.system.uses.spent, 2);
  await useAbility(f.actor, f.second.id);
  assert.equal(f.actor.img, "second.png");
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(f.second.system.effectsActive, true);
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.shield.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  await returnToBase(f.actor);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.shield.system.equipped, false);
  assert.equal(f.sword.system.shots, 2);
  assert.equal(f.axe.system.shots, 1);
  assert.deepEqual(f.actor.system.health, balance.health);
  assert.deepEqual(f.actor.system.customResources, balance.customResources);
  assert.equal(f.actor.system.ap.value, 11);
  assert.equal(f.first.system.uses.spent, 2);
  assert.equal(f.second.system.uses.spent, 2);
});

test("gear changes are remembered per form, including empty presets and newly added inventory items", async () => {
  const f = fixture();
  await useAbility(f.actor, f.first.id);
  f.axe.system.equipped = false;
  f.shield.system.equipped = true;
  const added = f.item("newgear", "armor", { equipped: true });
  await useAbility(f.actor, f.first.id, { end: true });
  assert.equal(f.first.system.loadout.equipment.shield, true);
  assert.equal(f.first.system.loadout.equipment.newgear, true);
  assert.equal(added.system.equipped, false);
  assert.equal(f.sword.system.equipped, true);
  await useAbility(f.actor, f.first.id);
  assert.equal(f.shield.system.equipped, true);
  assert.equal(added.system.equipped, true);
  assert.equal(f.sword.system.equipped, false);
  f.first.system.loadout.equipment = {};
  await sync(f.actor, { edited: true });
  assert.ok([f.sword, f.axe, f.shield, added].every(item => !item.system.equipped));
});

test("failed posting and partial/ignored equipment batches restore costs, form state, portrait and exact prior gear", async () => {
  let f = fixture();
  foundry.documents.ChatMessage.implementation.create = async () => {
    throw new Error("offline");
  };
  await assert.rejects(useAbility(f.actor, f.first.id), /offline/);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.first.system.effectsActive, false);
  assert.equal(f.first.system.uses.spent, 1);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  assert.equal(f.actor.getFlag("worlds-beyond", "formLoadoutState"), undefined);
  for (const ignored of [false, true]) {
    f = fixture();
    const update = f.actor.updateEmbeddedDocuments;
    let once = true;
    f.actor.updateEmbeddedDocuments = async (...args) => {
      if (!once) return update.apply(f.actor, args);
      once = false;
      if (ignored) return [];
      const first = args[1][0];
      apply(f.actor.items.get(first._id), { "system.equipped": first["system.equipped"] });
      throw new Error("partial");
    };
    await assert.rejects(useAbility(f.actor, f.first.id), /partial|not retained/);
    assert.equal(f.actor.system.ap.value, 17);
    assert.equal(f.sword.system.equipped, true);
    assert.equal(f.axe.system.equipped, false);
    assert.equal(f.actor.img, "base.png");
  }
});

test("expiry/deletion and disabling a preset restore Base; inherited gear edits remain Base gear", async () => {
  let f = fixture();
  await useAbility(f.actor, f.first.id);
  f.first.system.loadout.gearEnabled = false;
  await sync(f.actor, { edited: true });
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  assert.equal(f.actor.img, "first.png");
  f.sword.system.equipped = false;
  f.shield.system.equipped = true;
  await useAbility(f.actor, f.first.id, { end: true });
  assert.equal(f.shield.system.equipped, true);
  assert.equal(f.actor.img, "base.png");
  f = fixture();
  await useAbility(f.actor, f.first.id);
  f.first.system.timers = { durationId: "clock" };
  f.first.effects.set("clock", { id: "clock", flags: { "worlds-beyond": { abilityTimer: "duration" } }, duration: { expired: true } });
  await sync(f.actor);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
  f = fixture();
  await useAbility(f.actor, f.first.id);
  f.actor.items.delete(f.first.id);
  await sync(f.actor);
  assert.equal(f.actor.img, "base.png");
  assert.equal(f.sword.system.equipped, true);
});

test("visibility is read-only, keeps forms and active buffs reachable, and never mutates counters or definitions", () => {
  const f = fixture();
  f.first.system.effectsActive = true;
  f.first.system.loadout.abilities = { spell: false };
  f.first.system.loadout.resources = { mana: false };
  const spell = f.item("spell", "ability", { kind: "active", effectsActive: false });
  const before = JSON.stringify(f.first.system);
  assert.equal(activeLoadoutForm(f.actor), f.first);
  assert.equal(formShowsAbility(f.first, spell), false);
  spell.system.effectsActive = true;
  assert.equal(formShowsAbility(f.first, spell), true);
  assert.equal(formShowsAbility(f.first, f.second), true);
  assert.equal(formShowsResource(f.first, "mana"), false);
  assert.equal(formShowsResource(null, "mana"), true);
  assert.equal(JSON.stringify(f.first.system), before);
});

test("presets ignore deleted IDs and use existing hand rules without rewriting the saved profile", () => {
  const f = fixture(),
    profile = { sword: true, axe: true, shield: true, deleted: true },
    before = structuredClone(profile);
  const updates = equipmentPlan(f.actor, profile);
  assert.deepEqual(updates, [{ _id: "shield", "system.equipped": true }]);
  assert.deepEqual(profile, before);
});

test("unconfigured forms do not write runtime state, copy gear configures only that form, and portraits edit the active source", async () => {
  const f = fixture();
  f.first.system.loadout = {};
  f.first.system.effectsActive = true;
  await sync(f.actor);
  assert.equal(f.calls.length, 0);
  await copyFormEquipment(f.second);
  assert.equal(f.second.system.loadout.equipment.sword, true);
  assert.equal(f.first.system.loadout.gearEnabled, undefined);
  await setCharacterPortrait(f.actor, "new.png");
  assert.equal(f.first.system.loadout.portrait, "new.png");
  assert.equal(f.actor.img, "base.png");
  f.first.system.effectsActive = false;
  await setCharacterPortrait(f.actor, "base-new.png");
  assert.equal(f.actor.img, "base-new.png");
});

test("reconciliation skips internal timer operations and non-GM duplicates; active GM resumes an expired saved loadout", async () => {
  const f = fixture();
  await useAbility(f.actor, f.first.id);
  const hooks = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] = fn), once: (name, fn) => (hooks[name] = fn) };
  registerFormLoadouts();
  f.first.system.effectsActive = false;
  game.user.isActiveGM = false;
  await hooks.updateItem(f.first, { "system.effectsActive": false }, {}, "gm");
  assert.equal(f.actor.img, "first.png");
  game.user.isActiveGM = true;
  await hooks.updateActiveEffect({ parent: f.first }, {}, { worldsBeyondAbilityTimers: true }, "gm");
  assert.equal(f.actor.img, "first.png");
  await hooks.updateItem(f.first, { "system.effectsActive": false }, {}, "gm");
  assert.equal(f.actor.img, "base.png");
});

test("portrait and visibility edits do not reset unsaved gear changes in the current form", async () => {
  const f = fixture();
  await useAbility(f.actor, f.first.id);
  const hooks = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] = fn), once() {} };
  registerFormLoadouts();
  f.axe.system.equipped = false;
  f.sword.system.equipped = true;
  f.first.system.loadout.portrait = "edited.png";
  await hooks.updateItem(f.first, { system: { loadout: { portrait: "edited.png" } } }, {}, "gm");
  assert.equal(f.actor.img, "edited.png");
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  await hooks.updateItem(f.first, { "system.loadout.abilities.spell": false }, {}, "gm");
  assert.equal(f.sword.system.equipped, true);
  await returnToBase(f.actor);
  assert.equal(f.first.system.loadout.equipment.sword, true);
  assert.equal(f.first.system.loadout.equipment.axe, false);
});

test("full-form submissions omit unchanged presets and implicit memberships while keeping deliberate edits", () => {
  const system = {
    loadout: { portrait: "first.png", gearEnabled: true, equipment: { axe: true }, abilities: { spell: false }, resources: {} }
  };
  const data = {
    system: {
      loadout: {
        portrait: "edited.png",
        gearEnabled: true,
        equipment: { sword: false, axe: true },
        abilities: { spell: false, newSpell: true },
        resources: { mana: true }
      }
    }
  };
  formLoadoutFormUpdates(system, data);
  assert.deepEqual(data, { system: { loadout: { portrait: "edited.png" } } });
  const edited = {
    system: { loadout: { equipment: { axe: false, sword: true }, abilities: { spell: true }, resources: { mana: false } } }
  };
  formLoadoutFormUpdates(system, edited);
  assert.deepEqual(edited.system.loadout, {
    equipment: { axe: false, sword: true },
    abilities: { spell: true },
    resources: { mana: false }
  });
});

test("a failed form-to-form post restores the original preset definition, current gear, selection and payment", async () => {
  const f = fixture();
  await useAbility(f.actor, f.first.id);
  f.axe.system.equipped = false;
  f.sword.system.equipped = true;
  const config = structuredClone(f.first.system.loadout),
    receipt = structuredClone(f.actor.getFlag("worlds-beyond", "formLoadoutState"));
  foundry.documents.ChatMessage.implementation.create = async () => {
    throw new Error("offline");
  };
  await assert.rejects(useAbility(f.actor, f.second.id), /offline/);
  assert.deepEqual(f.first.system.loadout, config);
  assert.deepEqual(f.actor.getFlag("worlds-beyond", "formLoadoutState"), receipt);
  assert.equal(f.first.system.effectsActive, true);
  assert.equal(f.second.system.effectsActive, false);
  assert.equal(f.actor.system.ap.value, 14);
  assert.equal(f.sword.system.equipped, true);
  assert.equal(f.axe.system.equipped, false);
  assert.equal(f.shield.system.equipped, false);
  assert.equal(f.actor.img, "first.png");
});
test("form caps preserve current resource points through entry and exit", async () => {
  const { actor, first } = fixture();
  const id = "BloodResource001";
  actor.system.customResources = { [id]: { max: 100, value: 101, spent: -1 } };
  first.system.loadout.resourceMaxima = { [id]: 200 };
  const update = actor.update.bind(actor);
  actor.update = async (...args) => {
    await update(...args);
    const cap = actor.getFlag("worlds-beyond", "formLoadoutState")?.formResources?.maxima?.[id];
    const pool = actor.system.customResources[id];
    pool.max = cap ?? 100;
    pool.normalMax = cap == null ? undefined : 100;
    pool.value = pool.max - pool.spent;
    return actor;
  };
  first.system.effectsActive = true;
  await sync(actor);
  assert.equal(actor.system.customResources[id].max, 200);
  assert.equal(actor.system.customResources[id].value, 101);
  assert.equal(actor.system.customResources[id].spent, 99);
  first.system.effectsActive = false;
  await sync(actor);
  assert.equal(actor.system.customResources[id].max, 100);
  assert.equal(actor.system.customResources[id].value, 101);
  assert.equal(actor.system.customResources[id].spent, -1);
});
