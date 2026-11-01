import { test } from "node:test";
import assert from "node:assert/strict";
import { queuedAction } from "../module/action-support.mjs";

const { refillTurnResources } = await import("../module/character-combat.mjs");
const start = f => refillTurnResources(f.combat, f.combat.previous, { ...f.context, combatantId: f.combatant.id });

function fixture() {
  const updates = [], errors = [];
  const actor = { uuid: "Actor.hero", name: "Hero", type: "character", system: {
    ap: { value: 2, max: 17 }, reactions: { value: 0, max: 2 }, health: { damage: 9 }, wonder: { value: 1 }
  }, async update(data) {
    updates.push(data);
    this.system.ap.value = data["system.ap.value"];
    this.system.reactions.value = data["system.reactions.value"];
    return this;
  } };
  const combatant = { id: "hero-turn", actor };
  const combat = { combatant };
  Object.assign(combat, { started: true, previous: { round: 0, turn: null }, current: { round: 1, turn: 0, combatantId: combatant.id } });
  const context = { round: 1, turn: 0, skipped: false };
  globalThis.game = { user: { isActiveGM: true } };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  return { actor, combatant, combat, context, updates, errors };
}

test("first combat turn refills only AP/reactions without touching other resources", async () => {
  const f = fixture();
  await start(f);
  assert.deepEqual(f.updates, [{ "system.ap.value": 17, "system.reactions.value": 2 }]);
  assert.equal(f.actor.system.health.damage, 9);
  assert.equal(f.actor.system.wonder.value, 1);
});

test("next turns, round wrap and a single-combatant next round refill current maxima including zero", async () => {
  for (const [previous, current] of [
    [{ round: 1, turn: 0 }, { round: 1, turn: 1 }],
    [{ round: 1, turn: 3 }, { round: 2, turn: 0 }],
    [{ round: 1, turn: 0 }, { round: 2, turn: 0 }]
  ]) {
    const f = fixture();
    f.combat.previous = previous; Object.assign(f.combat.current, current); Object.assign(f.context, current);
    f.actor.system.ap.max = 0; f.actor.system.reactions.max = 3;
    await start(f);
    assert.deepEqual(f.updates, [{ "system.ap.value": 0, "system.reactions.value": 3 }]);
  }
});

test("inactive clients, setup, rewinds, reorder and stale contexts do not refill", async () => {
  for (const change of [
    f => game.user.isActiveGM = false,
    f => f.combat.started = false,
    f => f.combat.previous = { round: 1, turn: 1 },
    f => f.combat.previous = { round: 2, turn: 0 },
    f => f.combat.previous = { round: 1, turn: 0, combatantId: "other" },
    f => f.context.round = 2,
    f => f.combat.current.combatantId = "other",
    f => f.combatant.actor = null,
    f => f.actor.type = "other"
  ]) {
    const f = fixture(); change(f);
    await start(f);
    assert.equal(f.updates.length, 0);
    }
});

test("native token actor resolution updates an unlinked actor without touching the world actor", async () => {
  const f = fixture();
  const world = structuredClone(f.actor.system);
  f.actor.uuid = "Scene.scene.Token.unlinked.Actor.hero";
  await start(f);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(world.ap.value, 2);
});

test("duplicate concurrent start calls coalesce and a pending spend finishes before refill", async () => {
  const f = fixture();
  let release; const gate = new Promise(resolve => release = resolve);
  const spend = queuedAction(f.actor.uuid, async () => { await gate; f.actor.system.ap.value = 0; });
  const first = start(f);
  const second = start(f);
  release(); await Promise.all([spend, first, second]);
  assert.equal(f.updates.length, 1);
  assert.equal(f.actor.system.ap.value, 17);
});

test("moving on while refill is queued skips stale work and reads newly prepared maxima", async () => {
  const f = fixture();
  let release; const gate = new Promise(resolve => release = resolve);
  const wait = queuedAction(f.actor.uuid, () => gate);
  const refill = start(f);
  await Promise.resolve();
  f.combat.current.turn = 1;
  release(); await Promise.all([wait, refill]);
  assert.equal(f.updates.length, 0);
  f.combat.current.turn = 0;
  f.actor.system.ap.max = 19;
  await start(f);
  assert.equal(f.actor.system.ap.value, 19);
});

test("failed or cancelled resource updates notify the GM without throwing out of the turn lifecycle", async () => {
  for (const throws of [true, false]) {
    const f = fixture();
    f.actor.update = async () => { if (throws) throw new Error("offline"); return undefined; };
    await start(f);
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0], /Correct them on the sheet/);
    assert.equal(f.actor.system.ap.value, 2);
  }
});

test("already-full combatants do not produce writes or false cancellation warnings on later rounds", async () => {
  const f = fixture();
  await start(f);
  f.combat.previous = { round: 1, turn: 0 };
  f.combat.current.round = 2; f.context.round = 2;
  f.actor.update = async () => { throw new Error("An already-full actor should not be updated"); };
  await start(f);
  assert.equal(f.updates.length, 1);
  assert.equal(f.errors.length, 0);
});

test("an empty update response is successful when the requested pools are already satisfied", async () => {
  const f = fixture();
  f.actor.update = async data => {
    f.actor.system.ap.value = data["system.ap.value"];
    f.actor.system.reactions.value = data["system.reactions.value"];
    return undefined;
  };
  await start(f);
  assert.equal(f.errors.length, 0);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.actor.system.reactions.value, 2);
});

test("one full pool does not prevent the other from refilling", async () => {
  for (const pool of ["ap", "reactions"]) {
    const f = fixture(); f.actor.system[pool].value = f.actor.system[pool].max;
    await start(f);
    assert.equal(f.updates.length, 1);
    assert.equal(f.actor.system.ap.value, 17);
    assert.equal(f.actor.system.reactions.value, 2);
    assert.equal(f.errors.length, 0);
  }
});
