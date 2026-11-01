import { test } from "node:test";
import assert from "node:assert/strict";
class Sheet {
  constructor(options = {}) { this.document = options.document; this.isEditable = true; }
  async _prepareContext() { return {}; }
  render() { return this; }
  _processFormData(event, form, formData) { return structuredClone(formData.object); }
  async _processSubmitData(event, form, data) { const updated = await this.document.update(data); return updated ? { updated } : {}; }
}
globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: base => base, DocumentSheetV2: Sheet } } };
const { toggleEffect, createEffect, EffectSheet, registerEffectSupport } = await import("../module/effects.mjs");
const { newEffectChange } = await import("../module/effects-core.mjs");
const id = "resource00000001";
function fixture() {
  const calls = [];
  const actor = { uuid: "Actor.effects", documentName: "Actor", type: "character", isOwner: true, system: { stats: {}, customResources: {} }, effects: new Map(),
    updateEmbeddedDocuments: async (type, updates) => { calls.push({ type, updates }); for (const data of updates) Object.assign(actor.effects.get(data._id), data); return updates; },
    createEmbeddedDocuments: async (type, data) => { calls.push({ type, data }); const effect = make("new", data[0].flags["worlds-beyond"].kind); Object.assign(effect, data[0]); return [effect]; }
  };
  function make(name, kind = "effect") {
    const effect = { id: name, uuid: `Actor.effects.ActiveEffect.${name}`, parent: actor, name, img: "icons/svg/aura.svg", description: "", disabled: true,
      flags: { "worlds-beyond": { managed: true, kind, source: "" } }, system: { changes: [newEffectChange()] },
      async update(data) { calls.push({ effect: name, data }); for (const [key, value] of Object.entries(data)) if (key === "system.changes") this.system.changes = value; else this[key] = value; return this; }
    };
    actor.effects.set(name, effect); return effect;
  }
  return { actor, make, calls };
}

test("form switches update every form in one native batch and independent effects remain enabled", async () => {
  const f = fixture(), wolf = f.make("wolf", "form"), bear = f.make("bear", "form"), blessing = f.make("blessing"); blessing.disabled = false;
  await toggleEffect(f.actor, wolf.uuid); assert.equal(wolf.disabled, false); assert.equal(bear.disabled, true);
  await toggleEffect(f.actor, bear.uuid); assert.equal(wolf.disabled, true); assert.equal(bear.disabled, false); assert.equal(blessing.disabled, false);
  assert.deepEqual(f.calls[1], { type: "ActiveEffect", updates: [{ _id: "wolf", disabled: true }, { _id: "bear", disabled: false }] });
  await toggleEffect(f.actor, "base"); assert.equal(bear.disabled, true); assert.equal(blessing.disabled, false);
});

test("rapid local form changes serialize and selecting the active form returns to Base", async () => {
  const f = fixture(), a = f.make("a", "form"), b = f.make("b", "form");
  await Promise.all([toggleEffect(f.actor, a.uuid), toggleEffect(f.actor, b.uuid)]);
  assert.equal(a.disabled, true); assert.equal(b.disabled, false);
  await toggleEffect(f.actor, b.uuid); assert.equal(b.disabled, true);
  f.actor.isOwner = false; const count = f.calls.length; await toggleEffect(f.actor, a.uuid); assert.equal(f.calls.length, count);
});

test("cancelled batch/single updates report failure rather than claiming a form or effect activated", async () => {
  const f = fixture(), a = f.make("a", "form"), effect = f.make("effect");
  f.actor.updateEmbeddedDocuments = async () => [];
  await assert.rejects(toggleEffect(f.actor, a.uuid), /did not complete/); assert.equal(a.disabled, true);
  effect.update = async () => undefined;
  await assert.rejects(toggleEffect(f.actor, effect.uuid), /cancelled/);
  await assert.rejects(toggleEffect(f.actor, "missing"), /no longer exists/);
});

test("creation makes an inactive native v14 effect without changing scores, resources or the current form", async () => {
  const f = fixture(), active = f.make("active", "form"); active.disabled = false; const before = structuredClone(f.actor.system);
  const created = await createEffect(f.actor, "form"); assert.equal(created.disabled, true); assert.equal(active.disabled, false);
  assert.equal(f.calls[0].type, "ActiveEffect"); assert.equal(f.calls[0].data[0].transfer, false);
  assert.deepEqual(f.calls[0].data[0].system.changes, [newEffectChange()]); assert.equal(f.calls[0].data[0].changes, undefined);
  assert.deepEqual(f.actor.system, before);
  f.actor.isOwner = false; await createEffect(f.actor); assert.equal(f.calls.length, 1);
});

test("effect sheets reject stale edits and permission loss without overwriting native changes", async () => {
  const f = fixture(), effect = f.make("effect"), sheet = new EffectSheet({ document: effect });
  await sheet._prepareContext({});
  effect.name = "Renamed elsewhere";
  await assert.rejects(sheet._processSubmitData(null, null, { name: "Old name" }), /another window/);
  await sheet._prepareContext({}); f.actor.isOwner = false;
  await assert.rejects(sheet._processSubmitData(null, null, { name: "New name" }), /permission/);
  assert.equal(f.calls.length, 0);
});

test("v14 change guards skip removed managed pools, preserve initial/final phases and leave other effects alone", () => {
  class NativeEffect { shouldApplyChange(change, { phase }) { return change.phase === phase; } }
  globalThis.CONFIG = { ActiveEffect: { documentClass: NativeEffect } }; registerEffectSupport();
  const effect = new CONFIG.ActiveEffect.documentClass(); effect.flags = { "worlds-beyond": { managed: true } }; effect.target = { system: { customResources: {} } };
  const change = { ...newEffectChange(), key: `system.customResources.${id}.bonus` };
  assert.equal(effect.shouldApplyChange(change, { phase: "initial" }), false);
  effect.target.system.customResources[id] = { bonus: 0 };
  assert.equal(effect.shouldApplyChange(change, { phase: "initial" }), true);
  assert.equal(effect.shouldApplyChange(change, { phase: "final" }), false);
  assert.equal(effect.shouldApplyChange(newEffectChange(), { phase: "initial" }), true);
  effect.flags = {}; delete effect.target.system.customResources[id];
  assert.equal(effect.shouldApplyChange(change, { phase: "initial" }), true);
});
