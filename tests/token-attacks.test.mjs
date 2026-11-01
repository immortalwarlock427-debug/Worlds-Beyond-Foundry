import { test } from "node:test";
import assert from "node:assert/strict";
import { clickAttacker, promptTokenAttack, registerTokenAttacks } from "../module/token-attacks.mjs";
import { promptAttack, rollAttack } from "../module/attack-actions.mjs";
import { dualWieldPartners } from "../module/attacks.mjs";

function fixture() {
  const calls = { templates: [], dialogs: [], rolls: 0, targets: [] };
  const make = (id, properties = {}) => ({ id, name: id, type: "weapon", system: { equipped: true, damage: "1d6", loading: 0, properties, signature: {}, family: "balanced" } });
  const weapon = make("Sword");
  const actor = { uuid: "Actor.hero", name: "Hero", type: "character", isOwner: true, items: new Map([[weapon.id, weapon]]), system: { level: 1, ap: { value: 15 }, equipment: {}, stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 12, mod: 0 }])) } };
  const selected = { actor };
  const target = { actor: { uuid: "Scene.scene.Token.foe.Actor.foe", name: "Foe", system: { core: { evasion: 17, armorRating: 3 } } },
    name: "Foe token", document: { uuid: "Scene.scene.Token.foe" }, isVisible: true, layer: { active: true }, setTarget: (...args) => calls.targets.push(args) };
  const DialogV2 = { async input(options) { calls.dialogs.push(options); return null; } };
  globalThis.foundry = { applications: { api: { DialogV2 }, handlebars: { async renderTemplate(path, data) { calls.templates.push({ path, data }); return "template"; } } }, dice: { Roll: class { async evaluate() { calls.rolls++; return this; } } } };
  globalThis.game = { activeTool: "select", user: { targets: [] }, combats: [], settings: { get: () => "public" } };
  globalThis.canvas = { tokens: { controlled: [selected] }, regions: {}, controls: { ruler: { active: false } } };
  globalThis.CONFIG = { Canvas: { rulerClass: { canMeasure: false } } };
  return { actor, weapon, target, selected, calls, make, DialogV2 };
}

test("a plain target click uses exactly one controlled owned attacker without confusing it with the victim", () => {
  const f = fixture(); assert.equal(clickAttacker(f.target), f.actor);
  for (const key of ["altKey", "shiftKey", "ctrlKey", "metaKey"]) assert.equal(clickAttacker(f.target, { [key]: true }), null);
  f.target.isVisible = false; assert.equal(clickAttacker(f.target), null); f.target.isVisible = true;
  f.actor.isOwner = false; assert.equal(clickAttacker(f.target), null); f.actor.isOwner = true;
  canvas.tokens.controlled.push({ actor: f.actor }); assert.equal(clickAttacker(f.target), null); canvas.tokens.controlled.pop();
  assert.equal(clickAttacker(f.selected), null);
  game.activeTool = "target"; assert.equal(clickAttacker(f.target), null);
});

test("token registration grants an attack click without control/drag permissions and preserves modifier selection", () => {
  const f = fixture();
  class Base { _canControl() { return false; } _onClickLeft() { this.fallback = true; } }
  CONFIG.Token = { objectClass: Base }; registerTokenAttacks();
  const token = Object.assign(new CONFIG.Token.objectClass(), f.target);
  assert.equal(token._canControl({}, { type: "pointerdown" }), true);
  assert.equal(token._canControl({}), false);
  token._onClickLeft({ altKey: true }); assert.equal(token.fallback, true);
  canvas.controls.ruler.active = true; assert.equal(token._canControl({}, { type: "pointerdown" }), false);
});

test("one equipped weapon opens its attack dialog with the clicked target, ignoring unrelated current targets", async () => {
  const f = fixture(); game.user.targets = [{ actor: { name: "Wrong foe", system: { core: { evasion: 99 } } } }];
  await promptTokenAttack(f.actor, f.target);
  const data = f.calls.templates[0].data;
  assert.equal(data.target.name, "Foe token"); assert.equal(data.target.evasion, 17);
  assert.equal(data.target.actorUuid, f.target.actor.uuid); assert.equal(data.target.tokenUuid, f.target.document.uuid);
  assert.equal(f.calls.rolls, 0); assert.equal(f.calls.dialogs[0].ok.label, "Attack");
});

test("weapon chooser lists equipped weapons, excludes armor/stowed gear and cancellation spends nothing", async () => {
  const f = fixture(); f.weapon.system.properties.light = true;
  const off = f.make("Dagger", { light: true }); const stowed = f.make("Mace"); stowed.system.equipped = false;
  f.actor.items.set(off.id, off); f.actor.items.set(stowed.id, stowed); f.actor.items.set("Armor", { id: "Armor", type: "armor", system: { equipped: true } });
  await promptTokenAttack(f.actor, f.target);
  assert.match(f.calls.templates[0].path, /token-attack-dialog/);
  assert.deepEqual(f.calls.templates[0].data.weapons.map(w => w.id), ["Sword", "Dagger"]);
  assert.deepEqual(dualWieldPartners(f.weapon, f.actor.items).map(w => w.id), ["Dagger"]);
  assert.equal(f.calls.rolls, 0);
});

test("invalid legacy loadouts and deleted/stowed weapons cannot spend AP or shots", async () => {
  const f = fixture(); f.actor.items.set("Mace", f.make("Mace"));
  await assert.rejects(promptTokenAttack(f.actor, f.target), /Only two Light/);
  await assert.rejects(rollAttack(f.actor, f.weapon, { spendAp: true }), /Only two Light/);
  f.actor.items.delete("Mace"); f.weapon.system.equipped = false;
  await assert.rejects(promptAttack(f.actor, f.weapon.id), /no longer equipped/);
  await assert.rejects(rollAttack(f.actor, f.weapon, { spendAp: true }), /no longer equipped/);
  assert.equal(f.actor.system.ap.value, 15); assert.equal(f.calls.rolls, 0);
});

test("repeated token clicks do not open simultaneous attack dialogs", async () => {
  const f = fixture(); let release;
  f.DialogV2.input = async options => { f.calls.dialogs.push(options); return new Promise(resolve => { release = resolve; }); };
  const first = promptTokenAttack(f.actor, f.target);
  await new Promise(resolve => setImmediate(resolve));
  await promptTokenAttack(f.actor, f.target); assert.equal(f.calls.dialogs.length, 1);
  release(null); await first;
});
