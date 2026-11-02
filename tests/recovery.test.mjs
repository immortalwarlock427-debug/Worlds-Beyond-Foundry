import { test } from "node:test";
import assert from "node:assert/strict";
import { abilityRecoveryItems, turnRecoveryUpdates } from "../module/recovery-core.mjs";
import { recoverActor, recoverEncounter, recoverTurn, registerRecovery } from "../module/recovery-actions.mjs";
import { resourceRestUpdates } from "../module/resources.mjs";
const customId = "resource00000001";
const get = (object, path) => path.split('.').reduce((entry, key) => entry?.[key], object);
const set = (object, path, value) => { const keys = path.split('.'), key = keys.pop(); keys.reduce((entry, key) => entry[key] ??= {}, object)[key] = structuredClone(value); };
function fixture() {
  const errors = [], updates = [];
  const actor = { uuid: "Scene.test.Token.hero.Actor.hero", name: "Hero", type: "character", isOwner: true, flags: {}, items: new Map(),
    system: { mana: { enabled: true, autoRecover: true, regen: 5, max: 100, value: 89.5, spent: 10.5 }, holyPower: { enabled: false, autoRecover: true, regen: 9, max: 100, value: 90, spent: 10 },
      customResources: { [customId]: { autoRecover: false, regen: 7, max: 100, value: 95, spent: 5 } } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; }, async update(data) {
      updates.push(structuredClone(data)); for (const [path, value] of Object.entries(data)) set(this, path, value);
      for (const pool of [this.system.mana, this.system.holyPower, ...Object.values(this.system.customResources)]) pool.value = pool.max - pool.spent;
      return this;
    } };
  for (const mode of ['manual', 'longRest', 'combat', 'turn']) {
    const item = { id: mode, type: 'ability', system: { uses: { max: 3, spent: 2, resetOn: mode }, effectsActive: true, cooldown: { remaining: 2 } }, async update(data) { for (const [path, value] of Object.entries(data)) set(this, path, value); return this; } };
    actor.items.set(item.id, item);
  }
  let session = 'session1';
  const combatant = { id: 'hero', actor };
  const combat = { id: 'combat', started: true, combatant, combatants: [combatant], current: { round: 1, turn: 0, combatantId: 'hero' }, getFlag: () => session };
  globalThis.game = { user: { isActiveGM: true }, combats: [combat] };
  globalThis.foundry = { utils: { getProperty: get, setProperty: set, hasProperty: (object, path) => get(object, path) !== undefined, randomID: () => 'session2' } };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  return { actor, combat, updates, errors, restart() { session = 'session2'; } };
}
test("recovery modes reset only finite configured uses, with no changes to active effects or cooldowns", async () => {
  const f = fixture(); assert.deepEqual(abilityRecoveryItems(f.actor.items, 'combat').map(item => item.id), ['combat', 'turn']);
  f.actor.items.set('unlimited', { id: 'unlimited', type: 'ability', system: { uses: { max: null, spent: 9, resetOn: 'longRest' } } });
  await recoverActor(f.actor, 'longRest', { updates: resourceRestUpdates(f.actor.system) });
  for (const [mode, item] of f.actor.items) {
    assert.equal(item.system.uses.spent, mode === 'manual' ? 2 : mode === 'unlimited' ? 9 : 0);
    if (mode !== 'unlimited') { assert.equal(item.system.effectsActive, true); assert.equal(item.system.cooldown.remaining, 2); }
  }
  assert.equal(f.actor.system.mana.spent, 0); assert.equal(f.actor.system.holyPower.spent, 0);
});
test("turn recovery preserves fractions, skips hidden/manual pools and respects cap/overflow and rest opt-out", () => {
  const { actor } = fixture();
  assert.deepEqual(turnRecoveryUpdates(actor.system), { 'system.mana.spent': 5.5 });
  actor.system.customResources[customId].autoRecover = true;
  assert.equal(turnRecoveryUpdates(actor.system)[`system.customResources.${customId}.spent`], 0);
  actor.system.customResources[customId].allowOverflow = true;
  assert.equal(turnRecoveryUpdates(actor.system)[`system.customResources.${customId}.spent`], -2);
  actor.system.mana.refillOnRest = false;
  assert.equal(resourceRestUpdates(actor.system)['system.mana.spent'], undefined);
  assert.equal(resourceRestUpdates(actor.system)['system.holyPower.spent'], 0, 'Legacy rest behavior remains enabled by default');
});
test("encounter and turn receipts prevent duplicate/rewound grants and survive reconnect; new session resets again", async () => {
  const f = fixture(); await Promise.all([recoverEncounter(f.combat), recoverEncounter(f.combat)]);
  assert.equal(f.actor.items.get('combat').system.uses.spent, 0); assert.equal(f.actor.items.get('turn').system.uses.spent, 0);
  f.actor.items.get('combat').system.uses.spent = 1;
  await recoverEncounter(f.combat); assert.equal(f.actor.items.get('combat').system.uses.spent, 1);
  const before = { round: 0, turn: null };
  await Promise.all([recoverTurn(f.combat, before, f.combat.current), recoverTurn(f.combat, before, f.combat.current)]);
  assert.equal(f.actor.system.mana.spent, 5.5);
  f.actor.items.get('turn').system.uses.spent = 1;
  f.actor.flags = structuredClone(f.actor.flags); // Reloaded receipt, not a memory-only guard.
  await recoverTurn(f.combat, before, f.combat.current); assert.equal(f.actor.system.mana.spent, 5.5); assert.equal(f.actor.items.get('turn').system.uses.spent, 1);
  f.combat.current.round = 2; await recoverTurn(f.combat, { round: 1, turn: 0 }, f.combat.current);
  assert.equal(f.actor.system.mana.spent, .5); assert.equal(f.actor.items.get('turn').system.uses.spent, 0);
  f.combat.current.round = 1; await recoverTurn(f.combat, before, f.combat.current); assert.equal(f.actor.system.mana.spent, .5);
  f.restart(); await recoverEncounter(f.combat); assert.equal(f.actor.items.get('combat').system.uses.spent, 0); assert.equal(f.errors.length, 0);
});
test("recovery does nothing on players, backward/stale turns or wholly manual settings", async () => {
  const f = fixture(); game.user.isActiveGM = false;
  await recoverEncounter(f.combat); await recoverTurn(f.combat, { round: 0 }, f.combat.current); assert.equal(f.updates.length, 0);
  game.user.isActiveGM = true;
  await recoverTurn(f.combat, { round: 2, turn: 0 }, f.combat.current); assert.equal(f.updates.length, 0);
  f.actor.system.mana.autoRecover = false; for (const item of f.actor.items.values()) item.system.uses.resetOn = 'manual';
  await recoverEncounter(f.combat); await recoverTurn(f.combat, { round: 0 }, f.combat.current); assert.equal(f.updates.length, 0);
});
test("failed item/actor recovery rolls back uses without committing pool gains or replay receipts", async () => {
  let f = fixture(); const second = f.actor.items.get('turn'); second.update = async () => undefined;
  await recoverEncounter(f.combat); assert.equal(f.actor.items.get('combat').system.uses.spent, 2); assert.equal(f.updates.length, 0); assert.equal(f.errors.length, 1);
  f = fixture(); f.actor.update = async () => undefined;
  await recoverTurn(f.combat, { round: 0 }, f.combat.current);
  assert.equal(f.actor.items.get('combat').system.uses.spent, 2); assert.equal(f.actor.items.get('turn').system.uses.spent, 2); assert.equal(f.actor.system.mana.spent, 10.5); assert.deepEqual(f.actor.flags, {});
  assert.equal(f.errors.length, 1);
});
test("native combat start gets a session in the same update; rewinds within a started encounter do not invent one", () => {
  fixture(); const hooks = {};
  globalThis.Hooks = { on: (name, fn) => hooks[name] = fn }; registerRecovery();
  const changes = { round: 1 }; hooks.preUpdateCombat({ round: 0 }, changes);
  assert.equal(get(changes, 'flags.worlds-beyond.recoverySession'), 'session2');
  const rewind = { round: 1 }; hooks.preUpdateCombat({ round: 4 }, rewind); assert.equal(rewind.flags, undefined);
});

test("stale encounters and ignored actor acknowledgements restore use resets without consuming recovery", async () => {
  let f = fixture();
  const item = f.actor.items.get('combat'), update = item.update;
  item.update = async data => { const result = await update.call(item, data); if (data['system.uses.spent'] === 0) f.combat.started = false; return result; };
  await recoverEncounter(f.combat);
  assert.equal(item.system.uses.spent, 2); assert.equal(f.actor.items.get('turn').system.uses.spent, 2); assert.equal(f.updates.length, 0);
  f = fixture(); f.actor.update = async () => f.actor;
  await recoverTurn(f.combat, { round: 0 }, f.combat.current);
  assert.equal(f.actor.items.get('combat').system.uses.spent, 2); assert.equal(f.actor.system.mana.spent, 10.5); assert.deepEqual(f.actor.flags, {});
  assert.match(f.errors[0], /not retained/);
});
