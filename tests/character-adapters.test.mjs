// Exercise our adapter contracts without requiring a licensed Foundry installation.
// This is not a replacement for an in-world check of the Token HUD and sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coreNumbers, healthFromDamage } from "../module/core-numbers.mjs";

const getProperty = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const setProperty = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((parent, key) => parent[key] ??= {}, object);
  target[last] = value;
};
class ActorStub {
  async update(data) { this.lastUpdate = data; return this; }
  async modifyTokenAttribute(...args) { this.fallback = args; return this; }
}
class SheetStub {
  async _prepareContext() { return {}; }
  _processFormData(event, form, formData) { return structuredClone(formData.object); }
}
globalThis.foundry = {
  documents: { Actor: ActorStub, Combatant: class {} },
  abstract: { TypeDataModel: class { async _preCreate() {} } },
  data: { fields: {} },
  applications: { api: { HandlebarsApplicationMixin: base => base }, sheets: { ActorSheetV2: SheetStub, ItemSheetV2: SheetStub } },
  utils: { getProperty, setProperty, hasProperty: (object, path) => getProperty(object, path) !== undefined }
};
globalThis.Hooks = { once() {}, on() {}, call() { return true; } };
const { CharacterActor } = await import("../module/character-actor.mjs");
const { CharacterSheet, CharacterData } = await import("../module/worlds-beyond.mjs");

test("sheet shows effective stats and colors changes while editing only persisted base scores", async () => {
  const stats = Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 12, effective: 12, mod: 0, milestones: 0 }]));
  const source = structuredClone(stats);
  stats.agl.effective = 9; stats.agl.mod = -1;
  stats.vit.value = 15; stats.vit.effective = 15; stats.vit.mod = 1;
  const sheet = new CharacterSheet();
  sheet.actor = { items: [], system: { stats, toObject: () => ({ stats: source }), health: {}, ap: {}, reactions: {}, wonder: {}, core: { automatic: {} }, overrides: {} } };
  sheet.isEditable = true;
  const context = await sheet._prepareContext({});
  const rows = context.groups.flatMap(group => group.rows);
  const agl = rows.find(row => row.key === "agl");
  assert.equal(agl.value, 9);
  assert.equal(agl.baseValue, 12);
  assert.equal(agl.adjusted, true);
  assert.equal(agl.increased, false);
  assert.equal(agl.modLabel, "−1");
  const vit = rows.find(row => row.key === "vit");
  assert.equal(vit.value, 15);
  assert.equal(vit.baseValue, 12);
  assert.equal(vit.increased, true);
  assert.equal(rows.find(row => row.key === "str").adjusted, false);
  assert.equal(source.agl.value, 12);
  assert.equal(source.vit.value, 12);
});

function actor() {
  const actor = new CharacterActor();
  actor.type = "character";
  actor.system = { health: { value: 41, max: 60 }, ap: { value: 4, max: 15 }, reactions: { value: 0, max: 1 }, wonder: { value: 0, max: 2 } };
  actor.clone = data => ({ system: { health: { max: coreNumbers({
    level: data.system?.level ?? 5,
    stats: data.system?.stats ?? { vit: { value: 12 } },
    overrides: { healthMax: data.system?.health?.maxOverride }
  }).healthMax } } });
  return actor;
}

test("token Health damage, healing and absolute correction preserve the same deficit as the sheet", async () => {
  const a = actor();
  await a.modifyTokenAttribute("health", -50, true);
  assert.equal(healthFromDamage(60, a.lastUpdate["system.health.damage"]), -9);
  await a.modifyTokenAttribute("health", 90, false);
  assert.equal(healthFromDamage(60, a.lastUpdate["system.health.damage"]), 90);
  await a.modifyTokenAttribute("health", 0, false);
  assert.equal(a.lastUpdate["system.health.damage"], 60);
});

test("token AP and reaction corrections remain unrestricted and unrelated attributes use Foundry", async () => {
  const a = actor();
  await a.modifyTokenAttribute("ap", 30, false);
  assert.deepEqual(a.lastUpdate, { "system.ap.value": 30 });
  await a.modifyTokenAttribute("reactions", -1, true);
  assert.deepEqual(a.lastUpdate, { "system.reactions.value": -1 });
  await a.modifyTokenAttribute("other", 2, true, false);
  assert.deepEqual(a.fallback, ["other", 2, true, false]);
});

test("token updates respect cancellation through Foundry's modifyTokenAttribute hook", async () => {
  const a = actor();
  Hooks.call = () => false;
  try {
    await a.modifyTokenAttribute("health", 20);
    assert.equal(a.lastUpdate, undefined);
  } finally { Hooks.call = () => true; }
});

test("full sheet submission does not turn a VIT change into healing or refill spent pools", () => {
  const sheet = new CharacterSheet();
  sheet.actor = actor();
  const result = sheet._processFormData(null, null, { object: {
    healthCurrent: "41", system: { stats: { vit: { value: 16 } }, ap: { value: "4" }, reactions: { value: "0" }, wonder: { value: "0" } }
  } });
  assert.equal(result.healthCurrent, undefined);
  assert.equal(result.system.health?.damage, undefined);
  assert.equal(result.system.ap.value, undefined);
  assert.equal(result.system.reactions.value, undefined);
  assert.equal(result.system.wonder.value, undefined);
  assert.equal(result.system.stats.vit.value, 16);
});

test("simultaneous max and current Health corrections use the new maximum, including zero", () => {
  const sheet = new CharacterSheet();
  sheet.actor = actor();
  const result = sheet._processFormData(null, null, { object: {
    healthCurrent: 0, system: { health: { maxOverride: 100 }, ap: { value: 0 } }
  } });
  assert.equal(result.system.health.damage, 100);
  assert.equal(result.system.ap.value, 0);
  const cleared = sheet._processFormData(null, null, { object: { healthCurrent: "" } });
  assert.equal(cleared.system.health.damage, 0);
});

test("new actors get Health/AP token defaults while imported bar settings are preserved", async () => {
  const changes = [];
  const model = new CharacterData();
  model.parent = { updateSource: data => changes.push(data) };
  await model._preCreate({}, {}, {});
  assert.deepEqual(changes.pop(), { "prototypeToken.bar1.attribute": "health", "prototypeToken.bar2.attribute": "ap" });
  await model._preCreate({ prototypeToken: { bar1: { attribute: null }, bar2: { attribute: "reactions" } } }, {}, {});
  assert.deepEqual(changes.pop(), {});
});
