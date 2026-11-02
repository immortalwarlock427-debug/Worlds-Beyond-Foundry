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
  tabGroups = Object.fromEntries(Object.entries(this.constructor.TABS ?? {}).map(([group, config]) => [group, config.initial]));
  async _prepareContext() {
    const entries = Object.entries(this.constructor.TABS ?? {});
    if (entries.length !== 1) return {};
    const [group, config] = entries[0];
    return { tabs: Object.fromEntries(config.tabs.map(tab => [tab.id, { ...tab, group, active: this.tabGroups[group] === tab.id, cssClass: this.tabGroups[group] === tab.id ? "active" : "" }])) };
  }
  async _onRender() {}
  _processFormData(event, form, formData) { return structuredClone(formData.object); }
}
globalThis.foundry = {
  documents: { Actor: ActorStub, Combatant: class {} },
  abstract: { TypeDataModel: class { async _preCreate() {} } },
  data: { fields: {} },
  applications: { api: { HandlebarsApplicationMixin: base => base, ApplicationV2: class {}, DocumentSheetV2: SheetStub }, sheets: { ActorSheetV2: SheetStub, ItemSheetV2: SheetStub } },
  utils: { getProperty, setProperty, hasProperty: (object, path) => getProperty(object, path) !== undefined }
};
globalThis.Hooks = { once() {}, on() {}, call() { return true; } };
const { CharacterActor } = await import("../module/character-actor.mjs");
const { CharacterSheet, CharacterData } = await import("../module/worlds-beyond.mjs");
const { createAbility } = await import("../module/abilities.mjs");

test("stat awards prepare from stored bases without accumulating or rewriting reset history", () => {
  const source = { level: 8, stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 19, manual: true, resetValue: 18 }])),
    advancement: { level4: { str: 2, dex: 2 }, level8: { str: 2, vit: 2 } } };
  const original = structuredClone(source);
  const model = new CharacterData();
  model.stats = structuredClone(source.stats);
  model.toObject = () => structuredClone(source);
  model.prepareBaseData();
  assert.equal(model.stats.str.value, 23);
  assert.equal(model.stats.dex.value, 21);
  model.prepareBaseData();
  assert.equal(model.stats.str.value, 23);
  source.level = 4;
  model.prepareBaseData();
  assert.equal(model.stats.str.value, 21);
  assert.equal(model.stats.vit.value, 19);
  assert.deepEqual(source.stats, original.stats);
  assert.deepEqual(source.advancement, original.advancement);
});

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
  assert.equal(agl.manual, false);
  assert.equal(agl.modLabel, "−1");
  const vit = rows.find(row => row.key === "vit");
  assert.equal(vit.value, 15);
  assert.equal(vit.baseValue, 12);
  assert.equal(vit.adjusted, true);
  assert.equal(vit.manual, false);
  assert.equal(rows.find(row => row.key === "str").adjusted, false);
  assert.equal(source.agl.value, 12);
  assert.equal(source.vit.value, 12);
});

test("earned points belong to the normal editable base; only gear/effects add the adjusted color", async () => {
  const source = {
    stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 19, manual: false, resetValue: null }])),
    advancement: { level4: { str: 2, vit: 2 }, level8: { dex: 2, wis: 2 }, level12: { agl: 2 } }
  };
  source.stats.dex = { value: 20, manual: true, resetValue: 19 };
  source.stats.wis = { value: 20, manual: true, resetValue: 19 };
  const stats = structuredClone(source.stats);
  for (const stat of Object.values(stats)) Object.assign(stat, { effective: stat.value, mod: 0, milestones: 0 });
  stats.str.effective = 21; stats.dex.effective = 22;
  stats.vit.effective = 23; stats.wis.effective = 24;
  const sheet = new CharacterSheet(); sheet.isEditable = true;
  sheet.actor = { items: [], system: { level: 12, stats, toObject: () => structuredClone(source), health: {}, ap: {}, reactions: {}, wonder: {}, core: { automatic: {} }, overrides: {} } };
  const rows = (await sheet._prepareContext({})).groups.flatMap(group => group.rows);
  for (const [key, base, adjusted, manual] of [["str", 21, false, false], ["dex", 22, false, true], ["vit", 21, true, false], ["wis", 22, true, true], ["agl", 21, true, false]]) {
    const row = rows.find(stat => stat.key === key);
    assert.equal(row.baseValue, base);
    assert.equal(row.adjusted, adjusted);
    assert.equal(row.manual, manual);
    assert.equal(row.defaultValue, 21);
  }
  assert.equal(source.stats.str.value, 19);
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

test("whole displayed Health and AP preserve hidden fractions; deliberate numeric edits floor", () => {
  const sheet = new CharacterSheet(); sheet.actor = actor();
  Object.assign(sheet.actor.system.health, { value: 120.4, max: 125 }); sheet.actor.system.ap.value = 4.9;
  const form = { querySelectorAll: selector => selector.includes("data-stat-score") ? [] : ["healthCurrent", "system.ap.value"].map(name => ({ name })) };
  const untouched = sheet._processFormData(null, form, { object: { name: "Renamed", healthCurrent: 120, system: { ap: { value: 4 } } } });
  assert.equal(untouched.system.health?.damage, undefined); assert.equal(untouched.system.ap.value, undefined);
  const edited = sheet._processFormData(null, form, { object: { healthCurrent: 119.9, system: { ap: { value: 3.9 } } } });
  assert.equal(edited.system.health.damage, sheet.actor.clone(edited).system.health.max - 119); assert.equal(edited.system.ap.value, 3);
});

test("creating an ability uses native embedded Items and never changes actor resources", async () => {
  const calls = [];
  const record = { sheet: { render: options => calls.push(options) } };
  const owner = { type: "character", isOwner: true, createEmbeddedDocuments: async (...args) => { calls.push(args); return [record]; } };
  assert.equal(await createAbility(owner), record);
  assert.deepEqual(calls[0], ["Item", [{ name: "New ability", type: "ability", img: "icons/svg/book.svg", system: { kind: "active" } }]]);
  assert.deepEqual(calls[1], { force: true });
  await createAbility(owner, "form");
  assert.deepEqual(calls[2], ["Item", [{ name: "New form", type: "ability", img: "icons/svg/book.svg", system: { kind: "form" } }]]);
  owner.isOwner = false; await createAbility(owner); assert.equal(calls.length, 4);
});

test("manual defense corrections bind to stored bonuses rather than active effect totals", async () => {
  const sheet = new CharacterSheet(); sheet.actor = actor();
  sheet.actor.system.bonuses = { armor: 4, evasion: 3, movement: 5 };
  sheet.actor.system.toObject = () => ({ bonuses: { armor: 1, evasion: 0, movement: 0 } });
  const form = { querySelectorAll: selector => selector.includes("data-stat-score") ? [] : ["armor", "evasion", "movement"].map(key => ({ name: `system.bonuses.${key}` })) };
  const unchanged = sheet._processFormData(null, form, { object: { system: { bonuses: { armor: 1, evasion: 0, movement: 0 } } } });
  assert.equal(unchanged.system.bonuses.armor, undefined);
  assert.equal(unchanged.system.bonuses.evasion, undefined);
  assert.equal(unchanged.system.bonuses.movement, undefined);
  const edited = sheet._processFormData(null, form, { object: { system: { bonuses: { armor: 4, evasion: 3, movement: 5 } } } });
  assert.deepEqual(edited.system.bonuses, { armor: 4, evasion: 3, movement: 5 });
});

test("ability controls allow read-only viewing and require permission plus confirmation for deletion", async () => {
  const calls = [], sheet = new CharacterSheet(); let confirm = false;
  const oldDialog = foundry.applications.api.DialogV2;
  foundry.applications.api.DialogV2 = { confirm: async () => { calls.push("confirm"); return confirm; } };
  sheet.actor = { items: new Map([["a", { type: "ability", sheet: { render: () => calls.push("view") }, delete: async () => calls.push("delete") }]]) };
  const target = operation => ({ dataset: { operation }, closest: () => ({ dataset: { abilityId: "a" } }) });
  const action = CharacterSheet.DEFAULT_OPTIONS.actions.ability;
  try {
    sheet.isEditable = false;
    await action.call(sheet, null, target("edit")); await action.call(sheet, null, target("delete"));
    assert.deepEqual(calls, ["view"]);
    sheet.isEditable = true;
    await action.call(sheet, null, target("delete")); assert.deepEqual(calls, ["view", "confirm"]);
    confirm = true; await action.call(sheet, null, target("delete")); assert.deepEqual(calls, ["view", "confirm", "confirm", "delete"]);
  } finally { foundry.applications.api.DialogV2 = oldDialog; }
});

test("form submission saves deliberate base edits and never saves displayed effect scores", () => {
  const sheet = new CharacterSheet();
  sheet.actor = actor();
  sheet.actor.system.toObject = () => ({ stats: { agl: { value: 21, manual: false, resetValue: null } } });
  const input = { dataset: { statScore: "agl", base: "21", pendingBase: "22" } };
  const form = { querySelectorAll: () => [input] };
  const data = sheet._processFormData(null, form, { object: { statScores: { agl: 24 } } });
  assert.equal(data.statScores, undefined);
  assert.deepEqual(data.system.stats.agl, { value: 22, manual: true, resetValue: 21 });
  delete input.dataset.pendingBase;
  const untouched = sheet._processFormData(null, form, { object: { statScores: { agl: 23 } } });
  assert.equal(untouched.statScores, undefined);
  assert.equal(untouched.system, undefined);
});

test("read-only actor sheets keep milestone reference buttons usable without enabling edits", async () => {
  const sheet = new CharacterSheet(); sheet.isEditable = false;
  const reference = { disabled: true }, correction = { disabled: true };
  sheet.element = { querySelectorAll: selector => {
    assert.equal(selector, '[data-action="milestones"], .wb-sheet-tabs [data-action="tab"]'); return [reference];
  } };
  await sheet._onRender({}, {});
  assert.equal(reference.disabled, false); assert.equal(correction.disabled, true);
});

test("narrative edits preserve literal text and spacing while unrelated saves omit unchanged details", () => {
  const sheet = new CharacterSheet(); sheet.actor = actor();
  const original = { class: "Mage", race: "Human", background: "  From home  ", appearance: "", backstory: "First line\n\nSecond line", notes: "Mana 120.4; 1.5×" };
  sheet.actor.system.toObject = () => ({ details: structuredClone(original) });
  const untouched = sheet._processFormData(null, null, { object: { name: "Renamed", system: { details: structuredClone(original) } } });
  assert.deepEqual(untouched.system.details, {});
  const literal = "  </textarea><script>literal</script>\n\nKeep 120.4 and 1.5×  ";
  const edited = sheet._processFormData(null, null, { object: { system: { details: { ...original, notes: literal, class: "", backstory: "" } } } });
  assert.deepEqual(edited.system.details, { notes: literal, class: "", backstory: "" });
  assert.equal(edited.system.health, undefined); assert.equal(edited.system.stats, undefined);
  assert.equal(original.notes, "Mana 120.4; 1.5×");
});

test("native tab context keeps the selected view across actor refreshes for owners and observers", async () => {
  const source = { stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 12 }])) };
  const system = { stats: Object.fromEntries(Object.entries(source.stats).map(([key, stat]) => [key, { ...stat, effective: 12, mod: 0, milestones: 0 }])),
    toObject: () => structuredClone(source), health: {}, ap: {}, reactions: {}, wonder: {}, overrides: {}, core: { automatic: {} } };
  for (const editable of [true, false]) {
    const sheet = new CharacterSheet(); sheet.actor = { items: [], system }; sheet.isEditable = editable;
    assert.equal((await sheet._prepareContext({})).tabs.character.active, true);
    for (const tab of ["equipment", "abilities", "status", "notes", "character"]) {
      sheet.tabGroups.sheet = tab;
      system.stats.str.effective = 21; system.stats.str.mod = 4;
      const context = await sheet._prepareContext({});
      assert.deepEqual(Object.keys(context.tabs), ["character", "equipment", "abilities", "status", "notes"]);
      assert.equal(Object.values(context.tabs).filter(row => row.active).length, 1);
      assert.equal(context.tabs[tab].active, true);
      assert.equal(context.groups[0].rows.find(row => row.key === "str").value, 21);
      assert.equal(source.stats.str.value, 12);
    }
  }
});

test("Status End ends the originating ability rather than disabling its bonus definition, and observers cannot end it", async () => {
  const item = { id: "power", uuid: "Actor.hero.Item.power", documentName: "Item", type: "ability", name: "Power", system: { kind: "active", effectsActive: true },
    async update(data) { this.system.effectsActive = data["system.effectsActive"]; return this; } };
  const effect = { id: "bonus", uuid: `${item.uuid}.ActiveEffect.bonus`, parent: item, name: "Strength", disabled: false,
    flags: { "worlds-beyond": { managed: true, itemBound: true } }, system: { changes: [{ key: "system.stats.str.value", value: 3, type: "add", phase: "initial" }] } };
  const owner = { uuid: "Actor.hero", isOwner: true, system: {}, items: new Map([[item.id, item]]), allApplicableEffects: () => [effect] };
  const sheet = new CharacterSheet(); sheet.actor = owner; sheet.isEditable = false;
  const target = { dataset: { operation: "end" }, closest: () => ({ dataset: { effectUuid: effect.uuid } }) };
  await CharacterSheet.DEFAULT_OPTIONS.actions.status.call(sheet, null, target);
  assert.equal(item.system.effectsActive, true);
  sheet.isEditable = true;
  await CharacterSheet.DEFAULT_OPTIONS.actions.status.call(sheet, null, target);
  assert.equal(item.system.effectsActive, false); assert.equal(effect.disabled, false);
  // A stale second click cannot turn the source back on.
  await CharacterSheet.DEFAULT_OPTIONS.actions.status.call(sheet, null, target);
  assert.equal(item.system.effectsActive, false);
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


test("repeated edits retain the original reset score; clearing restores it without writing effects", () => {
  const sheet = new CharacterSheet(); sheet.actor = actor();
  const source = { value: 22, manual: true, resetValue: 21 };
  sheet.actor.system.toObject = () => ({ stats: { agl: source } });
  const input = { dataset: { statScore: "agl", base: "22", pendingBase: "25" } };
  const form = { querySelectorAll: () => [input] };
  let result = sheet._processFormData(null, form, { object: { statScores: { agl: 27 } } });
  assert.deepEqual(result.system.stats.agl, { value: 25, manual: true, resetValue: 21 });
  input.dataset.pendingBase = "";
  result = sheet._processFormData(null, form, { object: { statScores: { agl: "" } } });
  assert.deepEqual(result.system.stats.agl, { value: 21, manual: false, resetValue: null });
  source.resetValue = null;
  result = sheet._processFormData(null, form, { object: {} });
  assert.equal(result.system.stats.agl.value, 12);
});

test("editing the advanced base subtracts earned points exactly once; clearing preserves points and reset history", () => {
  const sheet = new CharacterSheet(); sheet.actor = actor(); sheet.actor.system.level = 8;
  const source = { stats: { agl: { value: 17, manual: false, resetValue: null } }, advancement: { level4: { agl: 2 }, level8: { agl: 2 } } };
  sheet.actor.system.toObject = () => structuredClone(source);
  const input = { dataset: { statScore: "agl", base: "21", pendingBase: "22" } };
  const form = { querySelectorAll: () => [input] };
  let result = sheet._processFormData(null, form, { object: { statScores: { agl: 24 } } });
  assert.deepEqual(result.system.stats.agl, { value: 18, manual: true, resetValue: 17 });
  source.stats.agl = { ...result.system.stats.agl };
  input.dataset.base = "22"; input.dataset.pendingBase = "";
  result = sheet._processFormData(null, form, { object: { statScores: { agl: "" } } });
  assert.deepEqual(result.system.stats.agl, { value: 17, manual: false, resetValue: null });
  assert.deepEqual(source.advancement, { level4: { agl: 2 }, level8: { agl: 2 } });
  source.stats.agl.resetValue = null;
  result = sheet._processFormData(null, form, { object: {} });
  assert.equal(result.system.stats.agl.value, 12, "legacy reset restores default plus earned points during prep");
  input.dataset.pendingBase = "0";
  result = sheet._processFormData(null, form, { object: {} });
  assert.equal(result.system.stats.agl.value, -4, "manual exceptions below the award total remain editable");
});
