import { test } from "node:test";
import assert from "node:assert/strict";

// A small Foundry stand-in: one GM client, one player who owns the defender.
function world({ autoApply = true, defenderStats = {}, attacker = {}, combat = true } = {}) {
  const calls = { emits: [], posts: [], updates: [], dialogs: [] };
  let damageResults = [];
  class Roll {
    constructor(formula) {
      this.formula = formula;
    }
    static validate() {
      return true;
    }
    static fromData(data) {
      const roll = new Roll(data.formula);
      roll.total = data.total;
      return roll;
    }
    async evaluate() {
      this.total = damageResults.length ? damageResults.shift() : 0;
      return this;
    }
    toJSON() {
      return { formula: this.formula, total: this.total };
    }
    async render() {
      return "<div class='dice'></div>";
    }
  }
  const messages = new Map();
  const makeMessage = (id, data) => {
    const message = {
      id,
      uuid: `ChatMessage.${id}`,
      whisper: [],
      blind: false,
      speaker: { alias: "Orc" },
      flags: { "worlds-beyond": structuredClone(data.flags?.["worlds-beyond"] ?? {}) },
      rolls: data.rolls ?? [],
      content: data.content,
      author: data.author ?? gm,
      getFlag(scope, key) {
        return this.flags[scope]?.[key];
      },
      async setFlag(scope, key, value) {
        this.flags[scope][key] = structuredClone(value);
        return this;
      }
    };
    messages.set(id, message);
    return message;
  };
  const gm = { id: "gm", name: "GM", isGM: true, active: true };
  const player = { id: "p1", name: "Player", isGM: false, active: true, character: null };
  const stats = Object.fromEntries(
    ["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 12, effective: 12, mod: 0, ...defenderStats[key] }])
  );
  const defender = {
    id: "def",
    uuid: "Actor.def",
    name: "Bram",
    type: "character",
    isOwner: true,
    items: [{ type: "weapon", system: { equipped: true } }],
    flags: {},
    system: {
      health: { damage: 0 },
      reactions: { value: 2 },
      resistances: [],
      core: { armorRating: 6 },
      stats,
      block: { formula: "1d4" }
    },
    testUserPermission(user) {
      return user.isGM || user.id === "p1";
    },
    getFlag(scope, key) {
      return this.flags[key];
    },
    async update(data) {
      calls.updates.push(data);
      if ("system.health.damage" in data) this.system.health.damage = data["system.health.damage"];
      return this;
    }
  };
  player.character = { id: "def" };
  const weapon = {
    id: "axe",
    name: "Greataxe",
    type: "weapon",
    system: { damage: "1d12", damageType: "Slashing", family: "heavy", properties: { twoHanded: true }, signature: {} }
  };
  const attackerActor = {
    uuid: "Actor.orc",
    name: "Orc",
    system: { level: 1, stats: { str: { value: 12, effective: 12, mod: 0 } } },
    items: new Map([[weapon.id, weapon]]),
    ...attacker
  };
  const actors = { "Actor.def": defender, "Actor.orc": attackerActor };
  const settings = { autoResolveAttacks: true, autoApplyDamage: autoApply };
  globalThis.game = {
    user: gm,
    users: Object.assign([gm, player], { activeGM: gm, get: id => [gm, player].find(user => user.id === id) }),
    messages: { get: id => messages.get(id) },
    settings: { get: (scope, key) => settings[key] },
    socket: { emit: (channel, payload) => calls.emits.push(payload), on() {} },
    combats: combat ? [{ id: "c1", started: true, round: 1, combatants: [{ actor: defender }] }] : []
  };
  gm.isActiveGM = true;
  let counter = 0;
  globalThis.foundry = {
    utils: {
      fromUuidSync: uuid => actors[uuid] ?? null,
      fromUuid: async uuid => actors[uuid] ?? null,
      randomID: () => `token${++counter}`,
      deepClone: value => structuredClone(value)
    },
    dice: { Roll },
    documents: {
      ChatMessage: {
        implementation: {
          async create(data) {
            calls.posts.push(data);
            return makeMessage(`result${calls.posts.length}`, data);
          }
        }
      }
    },
    applications: { api: { DialogV2: { wait: async options => (calls.dialogs.push(options), null) } } }
  };
  globalThis.Hooks = { on() {}, once() {} };
  globalThis.ui = { notifications: { error() {}, warn() {}, info() {} } };
  const attack = (hands, extra = {}) =>
    makeMessage("attack", {
      flags: {
        "worlds-beyond": {
          attack: {
            actorUuid: "Actor.orc",
            attackerName: "Orc",
            automated: true,
            overwhelmingForce: false,
            target: { name: "Bram", actorUuid: "Actor.def", evasion: 14, armor: 6 },
            hands,
            ...extra
          }
        }
      }
    });
  const defenseRoll = (id, total, flags, author = player) =>
    makeMessage(id, { author, rolls: [{ total }], flags: { "worlds-beyond": flags } });
  return {
    calls,
    defender,
    attackerActor,
    attack,
    defenseRoll,
    settings,
    setDamage: values => (damageResults = [...values]),
    gm,
    player
  };
}

const { beginStrike, handleStrikeResult, changeResultHealth, answeringUser } = await import("../module/strike.mjs");
const hand = (extra = {}) => ({
  hand: "main",
  itemId: "axe",
  name: "Greataxe",
  mod: 0,
  total: 18,
  natural: 15,
  hit: true,
  critical: false,
  ...extra
});
const state = message => message.getFlag("worlds-beyond", "strike");
const prompt = message => state(message).exchanges[0].prompt;
const dodge = { check: { defense: { type: "dodge" }, actorUuid: "Actor.def" } };
const parry = { check: { defense: { type: "parry" }, actorUuid: "Actor.def" } };
const block = { reaction: { kind: "block", actorUuid: "Actor.def" } };
const save = { check: { kind: "save", actorUuid: "Actor.def" } };

test("the target's player is asked; a miss needs no answer", async () => {
  const w = world();
  assert.equal(answeringUser(w.defender).id, "p1");
  const message = w.attack([hand(), hand({ hand: "off", hit: false })]);
  await beginStrike(message);
  assert.equal(state(message).exchanges[1].outcome, "miss");
  assert.equal(prompt(message).userId, "p1");
  const emitted = w.calls.emits.at(-1);
  assert.deepEqual([emitted.type, emitted.userId, emitted.messageId, emitted.index], ["strikePrompt", "p1", "attack", 0]);
  // The popup gets its own copy, so a GM-only attack card isn't needed on the player's client.
  assert.equal(emitted.snapshot.data.target.actorUuid, "Actor.def");
  assert.equal(emitted.snapshot.exchange.prompt.token, prompt(message).token);
});

test("a successful Dodge ends the attack with no damage", async () => {
  const w = world();
  const message = w.attack([hand()]);
  await beginStrike(message);
  w.defenseRoll("d1", 19, dodge);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "dodge", rollMessageId: "d1" }, "p1");
  assert.equal(state(message).exchanges[0].outcome, "dodged");
  assert.equal(w.defender.system.health.damage, 0);
  assert.match(w.calls.posts.at(-1).content, /Bram dodges Greataxe/);
});

test("a failed Dodge rolls damage, offers Block after Armor Rating, then applies the rest", async () => {
  const w = world();
  const message = w.attack([hand()]);
  await beginStrike(message);
  w.defenseRoll("d1", 18, dodge);
  w.setDamage([16]);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "dodge", rollMessageId: "d1" }, "p1");
  const ex = state(message).exchanges[0];
  // Two-handed: half of AR 6 counts (3), so 13 gets through to the Block step.
  assert.equal(ex.step, "block");
  assert.equal(ex.afterArmor, 13);
  assert.equal(prompt(message).step, "block");
  w.defenseRoll("b1", 10, block);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "block", rollMessageId: "b1" }, "p1");
  assert.equal(state(message).exchanges[0].total, 3);
  assert.equal(w.defender.system.health.damage, 3);
  const result = w.calls.posts.at(-1);
  assert.match(result.content, /Bram takes 3 Slashing damage/);
  assert.equal(result.flags["worlds-beyond"].strikeResult.applied, true);
});

test("Let it hit with no reactions left skips straight to damage", async () => {
  const w = world();
  w.defender.system.reactions.value = 0;
  w.setDamage([9]);
  const message = w.attack([hand()]);
  await beginStrike(message);
  // No defense is possible, so nobody is asked.
  assert.equal(w.calls.emits.length, 0);
  assert.equal(state(message).exchanges[0].total, 6);
  assert.equal(w.defender.system.health.damage, 6);
});

test("stale answers, other users' rolls and mismatched rolls change nothing", async () => {
  const w = world();
  const message = w.attack([hand()]);
  await beginStrike(message);
  await handleStrikeResult({ messageId: "attack", index: 0, token: "old", choice: "take" }, "p1");
  assert.equal(state(message).exchanges[0].status, "waiting");
  w.defenseRoll("gmroll", 30, dodge, w.gm);
  await assert.rejects(
    handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "dodge", rollMessageId: "gmroll" }, "p1"),
    /doesn't match/
  );
  w.defenseRoll("wrongkind", 30, block);
  await assert.rejects(
    handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "dodge", rollMessageId: "wrongkind" }, "p1"),
    /doesn't match/
  );
  assert.equal(state(message).exchanges[0].status, "waiting");
});

test("a parried Overwhelming Force hit still deals half the rolled damage", async () => {
  const w = world({ defenderStats: { dex: { value: 21, effective: 21, mod: 4 } } });
  const message = w.attack([hand()], { overwhelmingForce: true });
  await beginStrike(message);
  w.defenseRoll("p", 20, parry);
  w.setDamage([15]);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "parry", rollMessageId: "p" }, "p1");
  assert.equal(state(message).exchanges[0].total, 7);
  assert.equal(w.defender.system.health.damage, 7);
});

test("a save ability: success avoids it, a half-damage save halves it", async () => {
  const ability = onSave => ({ name: "Frost Ray", check: "save", dc: 15, saveStat: "vit", onSave, damage: "3d6", damageType: "Ice" });
  const w = world();
  const message = w.attack([{ hand: "main", abilityId: "ray", name: "Frost Ray", mod: 3, hit: true }], { ability: ability("none") });
  await beginStrike(message);
  w.defenseRoll("s", 15, save);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "save", rollMessageId: "s" }, "p1");
  assert.equal(state(message).exchanges[0].outcome, "resisted");

  const v = world();
  v.defender.system.reactions.value = 0;
  const half = v.attack([{ hand: "main", abilityId: "ray", name: "Frost Ray", mod: 3, hit: true }], { ability: ability("half") });
  await beginStrike(half);
  v.defenseRoll("s", 16, save);
  v.setDamage([17]);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(half).token, choice: "save", rollMessageId: "s" }, "p1");
  // 17 halved to 8, minus Armor Rating 6.
  assert.equal(state(half).exchanges[0].total, 2);
  assert.match(v.calls.posts.at(-1).content, /Bram takes 2 Ice damage/);
});

test("with automatic damage off, the GM applies or undoes it from the result card", async () => {
  const w = world({ autoApply: false });
  w.defender.system.reactions.value = 0;
  w.setDamage([10]);
  const message = w.attack([hand({ total: 30 })]);
  await beginStrike(message);
  assert.equal(w.defender.system.health.damage, 0);
  const posted = w.calls.posts.at(-1);
  assert.equal(posted.flags["worlds-beyond"].strikeResult.applied, false);
  const card = {
    flags: structuredClone(posted.flags),
    getFlag(scope, key) {
      return this.flags[scope][key];
    },
    async setFlag(scope, key, value) {
      this.flags[scope][key] = value;
      return this;
    },
    id: "card"
  };
  await changeResultHealth(card, "apply");
  assert.equal(w.defender.system.health.damage, 7);
  await changeResultHealth(card, "apply");
  assert.equal(w.defender.system.health.damage, 7);
  await changeResultHealth(card, "undo");
  assert.equal(w.defender.system.health.damage, 0);
});

test("outside combat reactions aren't spent, so Block is still offered", async () => {
  const w = world({ combat: false });
  w.defender.system.reactions.value = 0;
  const message = w.attack([hand()]);
  await beginStrike(message);
  w.setDamage([12]);
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(message).token, choice: "take" }, "p1");
  assert.equal(state(message).exchanges[0].step, "block");
});

test("a Wonder reroll and a Defy Fate result count as the defense", async () => {
  const w = world();
  const message = w.attack([hand()]);
  await beginStrike(message);
  w.defenseRoll("rerolled", 20, { check: { defense: { type: "dodge" }, actorUuid: "Actor.def", previousMessageId: "d0" } });
  await handleStrikeResult(
    { messageId: "attack", index: 0, token: prompt(message).token, choice: "dodge", rollMessageId: "rerolled" },
    "p1"
  );
  assert.equal(state(message).exchanges[0].outcome, "dodged");
  assert.match(w.calls.posts.at(-1).content, /Dodge 20 after Wonder: success/);

  const v = world();
  const save = v.attack([{ hand: "main", abilityId: "ray", name: "Frost Ray", mod: 3, hit: true }], {
    ability: { name: "Frost Ray", check: "save", dc: 15, saveStat: "vit", onSave: "none", damage: "3d6", damageType: "Ice" }
  });
  await beginStrike(save);
  v.defenseRoll("fate", 4, { check: { kind: "save", actorUuid: "Actor.def", previousMessageId: "s0", success: true } });
  await handleStrikeResult({ messageId: "attack", index: 0, token: prompt(save).token, choice: "save", rollMessageId: "fate" }, "p1");
  assert.equal(state(save).exchanges[0].outcome, "resisted");
  assert.match(v.calls.posts.at(-1).content, /Save: success with Defy Fate/);
});
