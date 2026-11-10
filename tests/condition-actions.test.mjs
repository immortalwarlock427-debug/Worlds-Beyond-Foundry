import { test } from "node:test";
import assert from "node:assert/strict";
import { actionCapacity, incapacitationSources } from "../module/condition-actions-core.mjs";
import { actorIncapacitation, requireActionCapacity, registerConditionActions } from "../module/condition-actions.mjs";
import { planApPayment, payAp } from "../module/combat-support.mjs";
import { movementQuote } from "../module/movement.mjs";
import { provokers, showOpportunityPrompt } from "../module/opportunity.mjs";

test("only conditions that include Incapacitated stop AP spending and reactions", () => {
  for (const id of ["incapacitated", "paralysis", "petrified", "stun", "unconscious"]) {
    assert.equal(actionCapacity([id], { ap: 1 }).blocked, true, id);
    assert.equal(actionCapacity([id], { reaction: true }).blocked, true, id);
    assert.equal(actionCapacity([id], { ap: 0 }).blocked, false, "no blanket ban on free actions");
  }
  for (const id of ["blind", "deaf", "poison", "fear", "prone", "restrain", "grappled", "charmed", "invisible", "custom"])
    assert.equal(actionCapacity([id], { ap: 5, reaction: true }).blocked, false, id);
  assert.deepEqual(incapacitationSources(new Set(["stun", "stun", "incapacitated"])), ["Incapacitated", "Stunned"]);
});

function fixture() {
  const actor = {
    uuid: "Actor.hero",
    name: "Hero",
    type: "character",
    statuses: new Set(["stun"]),
    system: {
      ap: { value: 10 },
      command: { value: 5 },
      reactions: { value: 2 },
      core: { movement: 10 },
      stats: { agl: { milestones: 1 } }
    },
    getFlag: () => null,
    async update() {
      throw new Error("Must not write while blocked");
    }
  };
  let enabled = true;
  globalThis.game = { settings: { get: (scope, key) => (key === "automateIncapacitation" ? enabled : true) }, combats: [] };
  return {
    actor,
    disable: () => {
      enabled = false;
    }
  };
}

test("AP preflight/payment protects own and Command AP, with a separate default-on opt-out", async () => {
  const f = fixture();
  assert.throws(() => planApPayment(f.actor, 12), /Stunned: can't spend AP/);
  await assert.rejects(
    payAp(f.actor, 5, () => assert.fail("must not queue writes")),
    /Stunned/
  );
  assert.equal(f.actor.system.ap.value, 10);
  assert.equal(f.actor.system.command.value, 5);
  assert.doesNotThrow(() => requireActionCapacity(f.actor));
  f.disable();
  assert.deepEqual(actorIncapacitation(f.actor), []);
  assert.equal(planApPayment(f.actor, 12).fromGiven, 5);
  assert.doesNotThrow(() => requireActionCapacity(f.actor, { reaction: true }));
  let setting;
  game.settings.register = (scope, key, data) => {
    setting = { scope, key, ...data };
  };
  registerConditionActions();
  assert.equal(setting.key, "automateIncapacitation");
  assert.equal(setting.default, true);
  assert.equal(setting.scope, "world");
});

test("own-turn movement cannot buy feet with Surge or normal AP while incapacitated; corrections and banked feet stay free", () => {
  const f = fixture(),
    token = { id: "token", actor: f.actor, parent: { id: "scene" } };
  game.combats = [{ id: "combat", started: true, round: 1, turn: 0, combatant: { tokenId: "token", sceneId: "scene" } }];
  let quote = movementQuote(token, 5);
  assert.equal(quote.ap, 0);
  assert.equal(quote.surge, 1);
  assert.equal(quote.affordable, false);
  assert.match(quote.reason, /Stunned/);
  assert.equal(movementQuote(token, 30).affordable, false, "normal AP is blocked too");
  f.actor.getFlag = () => ({ key: "combat:1:0", receipts: [{ credit: 10, feet: 5, surge: 1 }] });
  assert.equal(movementQuote(token, 5).affordable, true, "already-paid feet do not spend new AP");
  game.combats[0].started = false;
  assert.equal(movementQuote(token, 30), null, "outside the charging path remains a correction");
  game.combats[0].started = true;
  f.disable();
  assert.equal(movementQuote(token, 30).affordable, true);
});

test("incapacitated opponents never provoke warnings or open stale opportunity prompts", async () => {
  const f = fixture();
  const scene = {
    id: "scene",
    grid: { size: 100, distance: 5, isHexagonal: false, getOffset: ({ x, y }) => ({ i: y / 100, j: x / 100 }) }
  };
  const mover = { id: "mover", parent: scene, disposition: -1, width: 1, height: 1 };
  const attacker = { id: "attacker", parent: scene, actor: f.actor, disposition: 1, x: 0, y: 0, width: 1, height: 1 };
  f.actor.isOwner = true;
  f.actor.items = [{ id: "sword", type: "weapon", system: { equipped: true } }];
  game.combats = [{ started: true, combatants: [{ sceneId: "scene", token: attacker, actor: f.actor }] }];
  const path = [
    { x: 100, y: 0 },
    { x: 200, y: 0 }
  ];
  assert.deepEqual(provokers(mover, path), []);
  globalThis.foundry = { utils: { fromUuidSync: id => (id === "attacker" ? attacker : mover) } };
  await showOpportunityPrompt({ attackerTokenUuid: "attacker", moverTokenUuid: "mover", weaponIds: ["sword"] });
  f.disable();
  assert.equal(provokers(mover, path).length, 1);
});
