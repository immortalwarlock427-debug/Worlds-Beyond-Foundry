import { test } from "node:test";
import assert from "node:assert/strict";
import { readyOpportunityWeapons, provokers, showOpportunityPrompt, confirmProvoking } from "../module/opportunity.mjs";
import { rollAttack } from "../module/attack-actions.mjs";

function fixture() {
  const calls = { wait: [], input: [], info: [], confirm: [] },
    settings = {},
    docs = new Map();
  const scene = {
    id: "scene",
    grid: { size: 100, distance: 5, isHexagonal: false, getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }) }
  };
  const actor = id => ({
    documentName: "Actor",
    uuid: `Actor.${id}`,
    id,
    name: id,
    type: "character",
    isOwner: true,
    statuses: new Set(),
    effects: [],
    items: new Map(),
    system: {
      level: 5,
      reactions: { value: 1 },
      ap: { value: 30 },
      equipment: {},
      stats: Object.fromEntries(
        ["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(k => [k, { mod: 0, value: 12, effective: 12 }])
      )
    },
    async update() {
      assert.fail("readiness must not spend resources");
    }
  });
  const a = actor("attacker"),
    b = actor("mover");
  const token = (id, owner, x, side) => {
    const doc = {
      documentName: "Token",
      id,
      uuid: `Scene.scene.Token.${id}`,
      name: id,
      parent: scene,
      actor: owner,
      x,
      y: 0,
      width: 1,
      height: 1,
      disposition: side,
      hidden: false
    };
    doc.object = {
      get actor() {
        return doc.actor;
      },
      name: id,
      document: doc,
      visible: true
    };
    docs.set(doc.uuid, doc);
    docs.set(owner.uuid, owner);
    return doc;
  };
  const attacker = token("attacker", a, 0, 1),
    mover = token("mover", b, 200, -1);
  const weapon = (id = "sword", extra = {}) => ({
    id,
    type: "weapon",
    name: id,
    system: { equipped: true, ranged: false, family: "balanced", damage: "1d6", properties: { light: true }, signature: {}, ...extra }
  });
  const sword = weapon();
  a.items.set(sword.id, sword);
  const combatant = { tokenId: attacker.id, sceneId: scene.id, token: attacker, actor: a, isDefeated: false };
  const combat = { started: true, combatants: [combatant] };
  const payload = {
    attackerTokenUuid: attacker.uuid,
    moverTokenUuid: mover.uuid,
    kind: "leave",
    weaponIds: [sword.id],
    movementId: "movement"
  };
  globalThis.game = {
    user: { id: "owner", targets: [] },
    combats: [combat],
    settings: { get: (_s, k) => (k === "messageMode" ? "public" : settings[k]) }
  };
  globalThis.foundry = {
    utils: { fromUuidSync: uuid => docs.get(uuid) },
    applications: {
      api: {
        DialogV2: {
          wait: async options => {
            calls.wait.push(options);
            return calls.choose ? await calls.choose(options) : "pass";
          },
          input: async options => {
            calls.input.push(options);
            return null;
          },
          confirm: async options => {
            calls.confirm.push(options);
            return false;
          }
        }
      },
      handlebars: { renderTemplate: async () => "card" }
    }
  };
  globalThis.ui = { notifications: { info: message => calls.info.push(message) } };
  globalThis.CONFIG = { Token: { movement: { actions: {} } } };
  const path = [
    { x: 100, y: 0 },
    { x: 200, y: 0 }
  ];
  const charm = (uuid = mover.uuid) => {
    a.statuses.add("charmed");
    a.effects.push({ statuses: new Set(["charmed"]), flags: { "worlds-beyond": { conditionSources: { charmed: { uuid } } } } });
  };
  return { a, b, attacker, mover, scene, combat, combatant, sword, weapon, docs, calls, settings, payload, path, charm };
}

test("linked charmer movement produces neither a provoke warning nor an opportunity chooser", async () => {
  const f = fixture();
  f.charm();
  assert.deepEqual(provokers(f.mover, f.path), []);
  assert.equal(
    await confirmProvoking(f.mover, { id: "charmMove", origin: f.path[0], passed: { waypoints: [f.path[1]] }, pending: { waypoints: [] } }),
    true
  );
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.confirm.length, 0);
  assert.equal(f.calls.wait.length, 0);
  f.settings.automateCharmed = false;
  assert.equal(provokers(f.mover, f.path).length, 1);
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.wait.length, 1);
});

test("multiple statuses respect action restrictions without treating movement penalties as reaction bans", () => {
  const f = fixture();
  for (const id of ["incapacitated", "paralysis", "petrified", "stun", "unconscious"]) {
    f.a.statuses = new Set(["prone", id]);
    assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 0, id);
  }
  f.settings.automateIncapacitation = false;
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 1);
  f.settings.automateIncapacitation = true;
  for (const id of ["prone", "fear", "poison", "grappled", "restrain", "blind"]) {
    f.a.statuses = new Set([id]);
    assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 1, id);
  }
});

test("exact synthetic charm relationships do not suppress unrelated world-actor copies", () => {
  const f = fixture();
  f.charm(f.b.uuid);
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 0);
  f.mover.actor = { ...f.b, uuid: "Scene.scene.Token.mover.Actor.synthetic" };
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 1);
  f.a.effects[0].flags["worlds-beyond"].conditionSources.charmed.uuid = f.mover.uuid;
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 0);
  f.docs.delete(f.mover.uuid);
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 1, "unresolved source stays manual");
});

test("readiness uses current equipped melee weapons and valid hands, not stale item ids", () => {
  const f = fixture();
  assert.deepEqual(readyOpportunityWeapons(f.attacker, f.mover), [f.sword]);
  for (const mutate of [
    () => (f.sword.system.equipped = false),
    () => {
      f.sword.system.equipped = true;
      f.sword.system.ranged = true;
    },
    () => {
      f.sword.system.ranged = false;
      f.sword.system.loading = 2;
      f.sword.system.shots = 0;
    }
  ]) {
    mutate();
    assert.deepEqual(readyOpportunityWeapons(f.attacker, f.mover), []);
  }
  f.sword.system.loading = 0;
  const second = f.weapon("axe", { properties: {} });
  f.a.items.set(second.id, second);
  assert.deepEqual(readyOpportunityWeapons(f.attacker, f.mover), [], "invalid two-weapon hands stay manual until corrected");
  f.a.items.delete(second.id);
  assert.equal(readyOpportunityWeapons(f.attacker, f.mover).length, 1);
});

test("delivery ignores unavailable, ended, defeated or disabled opportunities before opening UI", async () => {
  for (const change of [
    f => (f.a.system.reactions.value = 0),
    f => (f.combat.started = false),
    f => (f.combat.combatants = []),
    f => (f.combatant.isDefeated = true),
    f => (f.settings.offerOpportunityAttacks = false),
    f => (f.attacker.hidden = true),
    f => (f.mover.hidden = true),
    f => (f.a.isOwner = false),
    f => (f.mover.disposition = 1),
    f => (f.b.system.stats.agl.effective = 28),
    f => f.docs.delete(f.mover.uuid),
    f => (f.scene.grid.isHexagonal = true)
  ]) {
    const f = fixture();
    change(f);
    await showOpportunityPrompt(f.payload);
    assert.equal(f.calls.wait.length, 0);
    assert.equal(f.calls.input.length, 0);
  }
});

test("a delayed chooser reply rechecks reactions, conditions, equipment, identity and combat before attack UI", async () => {
  for (const change of [
    f => (f.a.system.reactions.value = 0),
    f => f.a.statuses.add("stun"),
    f => f.charm(),
    f => (f.sword.system.equipped = false),
    f => f.a.items.delete(f.sword.id),
    f => (f.sword.system.ranged = true),
    f => (f.combat.started = false),
    f => (f.combatant.isDefeated = true),
    f => (f.settings.offerOpportunityAttacks = false),
    f => (f.a.isOwner = false),
    f => (f.attacker.actor = { ...f.a, uuid: "Actor.replacement" }),
    f => (f.mover.actor = { ...f.b, uuid: "Actor.replacement" }),
    f => f.docs.delete(f.mover.uuid)
  ]) {
    const f = fixture();
    f.calls.choose = () => {
      change(f);
      return f.sword.id;
    };
    await showOpportunityPrompt(f.payload);
    assert.equal(f.calls.wait.length, 1);
    assert.equal(f.calls.input.length, 0);
    assert.match(f.calls.info[0], /no longer available/);
  }
});

test("only offered, still-usable weapons reach the attack dialog; reach is not remeasured after departure", async () => {
  const f = fixture();
  f.mover.x = 1000;
  f.calls.choose = () => f.sword.id;
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.input.length, 1, "mover is expected to have left reach");
  assert.equal(f.a.system.ap.value, 30);
  assert.equal(f.a.system.reactions.value, 1, "cancelled attack dialog is free");
  f.calls.choose = () => "not-offered";
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.input.length, 1);
  assert.equal(f.calls.info.length, 1);
});

test("Bulwark entry offers disappear when the signature changes while waiting", async () => {
  const f = fixture();
  f.payload.kind = "enter";
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.wait.length, 0);
  f.sword.system.signature.bulwark = true;
  f.calls.choose = () => {
    f.sword.system.signature.bulwark = false;
    return f.sword.id;
  };
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.wait.length, 1);
  assert.equal(f.calls.input.length, 0);
});

test("duplicate in-flight prompts are suppressed and failed/cancelled choosers release their key", async () => {
  const f = fixture();
  let release;
  f.calls.choose = () => new Promise(resolve => (release = resolve));
  const first = showOpportunityPrompt(f.payload);
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.wait.length, 1);
  release("pass");
  await first;
  f.calls.choose = () => {
    throw Error("dialog failed");
  };
  await assert.rejects(showOpportunityPrompt(f.payload), /dialog failed/);
  f.calls.choose = () => "pass";
  await showOpportunityPrompt(f.payload);
  assert.equal(f.calls.wait.length, 3);
});

test("ordinary available enemies still produce the movement confirmation, which remains cancellable", async () => {
  const f = fixture();
  assert.equal(provokers(f.mover, f.path).length, 1);
  const moved = await confirmProvoking(f.mover, {
    id: "ordinaryMove",
    origin: f.path[0],
    passed: { waypoints: [f.path[1]] },
    pending: { waypoints: [] }
  });
  assert.equal(moved, false);
  assert.equal(f.calls.confirm.length, 1);
  assert.equal(f.a.system.reactions.value, 1);
});

test("the final attack handler rejects changed ranged/Bulwark weapons before rolls or resource writes", async () => {
  const f = fixture();
  f.sword.system.ranged = true;
  await assert.rejects(rollAttack(f.a, f.sword, { opportunity: "leave", spendReaction: true, mode: "melee" }, null), /no longer make/);
  f.sword.system.ranged = false;
  await assert.rejects(rollAttack(f.a, f.sword, { opportunity: "enter", spendReaction: true, mode: "melee" }, null), /no longer make/);
  f.sword.system.signature.bulwark = true;
  await assert.rejects(rollAttack(f.a, f.sword, { opportunity: "enter", spendReaction: true, mode: "ranged" }, null), /no longer make/);
  assert.equal(f.a.system.reactions.value, 1);
  assert.equal(f.a.system.ap.value, 30);
});
