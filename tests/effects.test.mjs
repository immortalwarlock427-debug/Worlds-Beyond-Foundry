import { test } from "node:test";
import assert from "node:assert/strict";
import { effectTargets, effectContext, effectSnapshot, newEffectChange, effectFormUpdates, formUpdates, itemEffectState } from "../module/effects-core.mjs";
import { coreNumbers } from "../module/core-numbers.mjs";
const id = "resource00000001";
const flags = (kind = "effect", source = "") => ({ "worlds-beyond": { managed: true, kind, source } });
const effect = (id, key, value, options = {}) => ({ id, uuid: `Actor.hero.ActiveEffect.${id}`, name: id, flags: flags(), system: { changes: [{ ...newEffectChange(), key, value }] }, disabled: false, ...options });

test("managed item bonuses follow equipped state or passive/activated abilities without changing native unrelated effects", () => {
  const item = { documentName: "Item", type: "weapon", name: "Sword", system: { equipped: false } };
  const bound = effect("Sword bonus", "system.stats.str.value", 3, { parent: item, flags: { "worlds-beyond": { managed: true, itemBound: true } } });
  assert.equal(itemEffectState(bound), "Not equipped"); item.system.equipped = true; assert.equal(itemEffectState(bound), "");
  item.type = "ability"; item.system = { kind: "active", effectsActive: false }; assert.equal(itemEffectState(bound), "Ability inactive");
  item.system.effectsActive = true; assert.equal(itemEffectState(bound), "");
  item.system = { kind: "passive" }; assert.equal(itemEffectState(bound), "");
  bound.flags = {}; item.type = "weapon"; item.system.equipped = false; assert.equal(itemEffectState(bound), "");
});

test("friendly targets cover current stats, movement/defenses and stable custom maximum IDs", () => {
  const system = { customResources: { [id]: { name: "Blood" } } };
  const choices = effectTargets(system, `system.customResources.${id}.bonus`);
  assert.equal(choices.length, 14); assert.equal(choices.at(-1).selected, true); assert.equal(choices.at(-1).label, "Blood maximum");
  system.customResources[id].name = "Vital essence"; assert.equal(effectTargets(system).at(-1).label, "Vital essence maximum");
  assert.match(effectTargets({}, `system.customResources.${id}.bonus`).at(-1).label, /Missing/);
  assert.deepEqual(newEffectChange(), { key: "system.stats.str.value", type: "add", value: 0, phase: "initial", priority: 20 });
});

test("Status excludes inactive equipment/abilities/expired effects, keeps live sources, and saves old definitions under Abilities", () => {
  const actor = { items: [], effects: [], system: {} };
  const off = effect("Power", "system.stats.str.value", 3, { parent: actor, disabled: true });
  const oldForm = effect("Monstrous", "system.stats.str.value", 3, { parent: actor, disabled: true, flags: flags("form") });
  const expired = effect("Expired", "system.stats.dex.value", 1, { parent: actor, active: false, flags: {} });
  const status = effect("Poisoned", "system.stats.vit.value", -1, { parent: actor, flags: {} });
  const sword = { id: "sword", documentName: "Item", type: "weapon", name: "Sword", system: { equipped: false } };
  const gear = effect("bonus", "system.stats.str.value", 3, { parent: sword, flags: { "worlds-beyond": { managed: true, itemBound: true } } });
  actor.allApplicableEffects = () => [off, oldForm, expired, status, gear];
  let context = effectContext(actor);
  assert.deepEqual(context.statuses.map(row => row.name), ["Poisoned"]);
  assert.deepEqual(context.savedAbilities.map(row => [row.name, row.kind, row.effectsActive]), [["Power", "active", false], ["Monstrous", "form", false]]);
  sword.system.equipped = true; context = effectContext(actor);
  assert.deepEqual(context.statuses.map(row => row.name), ["Poisoned", "Sword"]); assert.equal(context.statuses[1].canEnd, false);
  assert.equal(off.disabled, true); assert.equal(oldForm.disabled, true);
});

test("selecting a form sends the complete form selection without touching independent or unmarked effects", () => {
  const a = effect("wolf", "system.stats.str.value", 2, { flags: flags("form"), disabled: false });
  const b = effect("bear", "system.stats.vit.value", 3, { flags: flags("form"), disabled: true });
  const other = effect("bless", "system.stats.fth.value", 1);
  const advanced = effect("native", "system.stats.dex.value", 1, { flags: {} });
  const list = [a, b, other, advanced]; const before = structuredClone(list);
  assert.deepEqual(formUpdates(list, "bear"), [{ _id: "wolf", disabled: true }, { _id: "bear", disabled: false }]);
  assert.deepEqual(formUpdates(list), [{ _id: "wolf", disabled: true }, { _id: "bear", disabled: true }]);
  assert.throws(() => formUpdates(list, "missing"), /no longer exists/); assert.deepEqual(list, before);
});

test("source summaries distinguish active, disabled and suppressed effects and keep actor/item origins", () => {
  const actor = { system: { customResources: { [id]: { name: "Blood" } } }, effects: [] };
  const active = effect("Blessing", "system.stats.str.value", 2, { parent: actor, flags: flags("effect", "Prayer") });
  const off = effect("Off", "system.stats.str.value", 5, { parent: actor, disabled: true });
  const suppressed = effect("Expired", "system.stats.str.value", 9, { parent: actor, active: false });
  const form = effect("Wolf", "system.stats.vit.value", 2, { parent: actor, flags: flags("form") });
  const item = effect("Amulet", "system.mana.bonus", 20, { parent: {}, item: { name: "Ruby amulet" } });
  actor.allApplicableEffects = () => [active, off, suppressed, form, item].values();
  const context = effectContext(actor);
  assert.equal(context.sources["system.stats.str.value"], "Blessing: +2 (Prayer)");
  assert.equal(context.sources["system.mana.bonus"], "Amulet: +20 (Ruby amulet)");
  assert.equal(context.hasActiveForm, true); assert.equal(context.groups[0].label, "Forms");
  assert.equal(context.groups[1].rows.find(row => row.id === "Amulet").canRemove, false);
  assert.equal(context.groups[1].rows.find(row => row.id === "Expired").state, "Suppressed / expired");
  assert.equal(active.system.changes[0].value, 2);
});

test("missing custom resources do not gain misleading active source entries", () => {
  const a = effect("Reserve", `system.customResources.${id}.bonus`, 20);
  const actor = { effects: [a], system: { customResources: {} } }; a.parent = actor;
  const context = effectContext(actor); assert.deepEqual(context.sources, {});
  assert.match(context.groups[0].rows[0].summary, /Missing/);
});

test("friendly saves preserve advanced changes and unedited fractions but floor deliberate edits", () => {
  const a = effect("Buff", "system.stats.str.value", 2.5);
  a.system.changes.push({ key: "system.stats.dex.value", type: "multiply", phase: "final", value: 1.5, priority: 10 });
  const snapshot = effectSnapshot(a);
  const untouched = { name: "Rename", effectRows: { 0: { key: "system.stats.str.value", value: 2 } } };
  effectFormUpdates(a, untouched); assert.equal(untouched.system, undefined); assert.equal(untouched.effectRows, undefined);
  const edited = { effectRows: { 0: { key: "system.bonuses.movement", value: -1.2 } } };
  effectFormUpdates(a, edited); assert.equal(edited.system.changes[0].value, -2);
  assert.deepEqual(edited.system.changes[1], a.system.changes[1]);
  const cleared = { effectRows: { 0: { value: "" } } }; effectFormUpdates(a, cleared); assert.equal(cleared.system.changes[0].value, 0);
  assert.throws(() => effectFormUpdates(a, { effectRows: { 0: { key: "system.level", value: 3 } } }), /supported/);
  assert.throws(() => effectFormUpdates(a, { effectRows: { 0: { value: "bad" } } }), /numeric/);
  assert.equal(effectSnapshot(a), snapshot);
});

test("movement bonuses use the unmodified base once and final overrides still win", () => {
  const options = { stats: { agl: { value: 15 } }, bonuses: { movement: 5 } };
  assert.equal(coreNumbers(options).movement, 15); assert.equal(coreNumbers(options).movement, 15);
  assert.equal(coreNumbers({ ...options, bonuses: { movement: -30 } }).movement, 0);
  assert.equal(coreNumbers({ ...options, overrides: { movement: 7 } }).movement, 7);
});
