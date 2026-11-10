import { test } from "node:test";
import assert from "node:assert/strict";
import { endConditionAction, promptEndConditionAction, resolveBleedingCheck } from "../module/conditions.mjs";
import { useWonder, rollCard } from "../module/roll-actions.mjs";
import { shakeItOffSuccess } from "../module/conditions-core.mjs";

test("Shake It Off succeeds on DC 12 or Defy Fate; invalid totals fail", () => {
  assert.equal(shakeItOffSuccess(12), true);
  assert.equal(shakeItOffSuccess(11), false);
  for (const total of [undefined, null, NaN, Infinity, "20"]) assert.equal(shakeItOffSuccess(total), false);
  assert.equal(shakeItOffSuccess(1, true), true);
});

function fixture({ combat = true, faith = 12 } = {}) {
  const calls = { rolls: [], posts: [], updates: [], deletes: [] },
    totals = [],
    settings = new Map();
  class Effects extends Map {
    *[Symbol.iterator]() {
      yield* this.values();
    }
  }
  const effects = new Effects();
  const actor = {
    uuid: "Actor.hero",
    name: "Hero",
    type: "character",
    isOwner: true,
    effects,
    items: [],
    flags: {},
    get statuses() {
      return new Set([...effects.values()].filter(e => !e.disabled).flatMap(e => [...e.statuses]));
    },
    system: {
      exhaustion: 0,
      ap: { value: 20 },
      command: { value: 2 },
      core: { movement: 10 },
      stats: { vit: { mod: 2 }, str: { mod: 2 }, dex: { mod: 4 }, agl: { milestones: 0 }, fth: { value: faith } },
      wonder: { value: 2 }
    },
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    async update(data) {
      calls.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split("."),
          key = parts.pop(),
          parent = parts.reduce((o, p) => (o[p] ??= {}), actor);
        if (key.startsWith("-=")) delete parent[key.slice(2)];
        else parent[key] = value;
      }
      return actor;
    },
    async deleteEmbeddedDocuments(type, ids) {
      calls.deletes.push(ids);
      const deleted = ids.map(id => effects.get(id)).filter(Boolean);
      for (const id of ids) effects.delete(id);
      return deleted;
    },
    async createEmbeddedDocuments(type, data) {
      return data.map(d => add(d._id, d.statuses));
    }
  };
  function add(id, statuses = [id]) {
    const effect = {
      id,
      uuid: `${actor.uuid}.ActiveEffect.${id}`,
      name: id,
      parent: actor,
      statuses: new Set(statuses),
      disabled: false,
      flags: {},
      system: { changes: [] },
      toObject: () => ({ _id: id, name: id, statuses: [...effect.statuses] }),
      async update(data) {
        if (data.statuses) effect.statuses = new Set(data.statuses);
        return effect;
      }
    };
    effects.set(id, effect);
    return effect;
  }
  class Roll {
    constructor(formula, data = {}) {
      this.formula = formula;
      this.data = data;
      this.dice = [{ faces: 20, total: 1, results: [{ result: 1, active: true }] }];
    }
    async evaluate(options) {
      this.total = totals.shift() ?? 10;
      calls.rolls.push({ formula: this.formula, data: this.data, options });
      return this;
    }
    clone() {
      return new Roll(this.formula, this.data);
    }
    async render() {
      return "<div class='dice-roll'>Roll</div>";
    }
  }
  const messages = new Map();
  Object.defineProperty(messages, "contents", { get: () => [...messages.values()] });
  const ChatMessage = {
    getSpeaker: () => ({ actor: "hero" }),
    getSpeakerActor: () => actor,
    async create(data, options) {
      const message = {
        ...data,
        id: `message${messages.size}`,
        isContentVisible: true,
        whisper: data.whisper ?? [],
        blind: data.blind ?? false,
        getFlag: (scope, key) => data.flags?.[scope]?.[key]
      };
      messages.set(message.id, message);
      calls.posts.push({ message, options });
      return message;
    }
  };
  const encounter = {
    id: "combat",
    started: true,
    round: 1,
    turn: 0,
    combatant: { actor, tokenId: "token", sceneId: "scene" },
    combatants: [{ actor }]
  };
  globalThis.game = {
    user: { id: "owner" },
    combats: combat ? [encounter] : [],
    messages,
    settings: { get: (scope, key) => (key === "messageMode" ? "public" : settings.get(key)) }
  };
  globalThis.CONFIG = { Token: { movement: { actions: { teleport: { teleport: true } } } } };
  globalThis.foundry = {
    dice: { Roll },
    documents: { ChatMessage: { implementation: ChatMessage } },
    applications: { handlebars: { renderTemplate: async () => "<article>Result</article>" } },
    utils: { fromUuidSync: () => actor }
  };
  globalThis.ui = {
    notifications: {
      warn: message => {
        calls.warning = message;
      }
    }
  };
  return {
    actor,
    effects,
    add,
    calls,
    settings,
    totals,
    ChatMessage,
    encounter,
    token: { id: "token", actor, parent: { id: "scene" }, x: 0, y: 0, elevation: 0 }
  };
}

test("Shake It Off uses VIT, condition/exhaustion defaults and Command first; failure still pays", async () => {
  const f = fixture();
  f.add("bleeding");
  f.add("poison");
  f.totals.push(11, 12);
  const failed = await endConditionAction(f.actor, "bleeding");
  assert.equal(f.calls.rolls[0].formula, "2d20kl1 + @mod");
  assert.equal(f.calls.rolls[0].data.mod, 2);
  assert.equal(f.actor.system.ap.value, 19);
  assert.equal(f.actor.system.command.value, 0);
  assert.equal(f.actor.statuses.has("bleeding"), true);
  assert.equal(failed.getFlag("worlds-beyond", "check").endBleeding.ap, 3);
  assert.match(failed.getFlag("worlds-beyond", "check").conditionText, /Poisoned/);
  await endConditionAction(f.actor, "bleeding", { mode: "normal" });
  assert.equal(f.calls.rolls[1].formula, "1d20 + @mod");
  assert.equal(f.actor.statuses.has("bleeding"), false);
  assert.equal(f.actor.statuses.has("poison"), true);

  f.add("bleeding");
  f.effects.delete("poison");
  f.actor.system.exhaustion = 3;
  await endConditionAction(f.actor, "bleeding");
  assert.equal(f.calls.rolls[2].formula, "2d20kl1 + @mod");
});

test("status opt-out and fear override preserve explicit dice and blind-roll privacy", async () => {
  const f = fixture();
  f.add("bleeding");
  f.add("poison");
  f.settings.set("automateConditionRolls", false);
  await endConditionAction(f.actor, "bleeding");
  assert.equal(f.calls.rolls[0].formula, "1d20 + @mod");
  f.effects.delete("poison");
  f.add("fear");
  f.settings.set("automateConditionRolls", true);
  await endConditionAction(f.actor, "bleeding", { fearInSight: false });
  assert.equal(f.calls.rolls[1].formula, "1d20 + @mod");
  game.settings.get = (scope, key) => (key === "messageMode" ? "blind" : f.settings.get(key));
  await endConditionAction(f.actor, "bleeding", { mode: "advantage" });
  assert.equal(f.calls.rolls[2].formula, "2d20kh1 + @mod");
  assert.equal(f.calls.rolls[2].options.allowInteractive, false);
  assert.equal(f.calls.posts[2].options.messageMode, "blind");
});

test("Wonder keeps the original dice, costs no more AP, consumes each result once and ends only the original Bleeding", async () => {
  const f = fixture();
  f.add("bleeding");
  f.add("poison");
  f.totals.push(5, 11, 12);
  const original = await endConditionAction(f.actor, "bleeding");
  f.effects.delete("poison");
  f.actor.system.stats.vit.mod = 8;
  const retry = await useWonder(original);
  assert.equal(f.actor.statuses.has("bleeding"), true);
  assert.equal(f.calls.rolls[1].formula, "2d20kl1 + @mod");
  assert.equal(f.calls.rolls[1].data.mod, 2);
  await assert.rejects(useWonder(original), /already used/);
  const success = await useWonder(retry);
  assert.equal(f.actor.statuses.has("bleeding"), false);
  assert.equal(f.actor.system.ap.value, 19);
  assert.equal(f.actor.system.wonder.value, 0);
  f.add("new", ["bleeding"]);
  assert.equal(await resolveBleedingCheck(f.actor, success.getFlag("worlds-beyond", "check"), { total: 20 }), 0);
  assert.equal(f.actor.statuses.has("bleeding"), true);
});

test("Defy Fate ends Bleeding without rolling again and a failed Wonder post refunds only Wonder", async () => {
  const f = fixture({ faith: 21 });
  f.add("bleeding");
  f.totals.push(1);
  const failed = await endConditionAction(f.actor, "bleeding");
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(useWonder(failed), /not posted/);
  assert.equal(f.actor.system.wonder.value, 2);
  assert.equal(f.actor.statuses.has("bleeding"), true);
  f.ChatMessage.create = async data => data;
  await useWonder(failed);
  assert.equal(f.calls.rolls.length, 1);
  assert.equal(f.actor.statuses.has("bleeding"), false);
  assert.equal(f.actor.system.ap.value, 19);
});

test("old Wonder cards do not end a newly applied Bleeding and actor UUIDs must match", async () => {
  const f = fixture();
  f.add("old", ["bleeding"]);
  f.totals.push(1, 20);
  const failed = await endConditionAction(f.actor, "bleeding");
  f.effects.delete("old");
  f.add("new", ["bleeding"]);
  await useWonder(failed);
  assert.equal(f.actor.statuses.has("bleeding"), true);
  assert.equal(await resolveBleedingCheck(f.actor, { ...failed.flags["worlds-beyond"].check, actorUuid: "Actor.other" }, { total: 20 }), 0);
});

test("incapacitation blocks recovery even outside combat; insufficient AP and stale condition cost nothing", async () => {
  const f = fixture({ combat: false });
  f.add("bleeding");
  f.add("stun");
  await assert.rejects(endConditionAction(f.actor, "bleeding"), /Stunned/);
  assert.equal(f.calls.rolls.length, 0);
  f.settings.set("automateIncapacitation", false);
  await endConditionAction(f.actor, "bleeding");
  assert.equal(f.actor.system.ap.value, 20);
  const g = fixture();
  g.add("bleeding");
  g.actor.system.ap.value = 0;
  g.actor.system.command.value = 0;
  await assert.rejects(endConditionAction(g.actor, "bleeding"), /Not enough AP/);
  assert.equal(g.calls.rolls.length, 0);
  g.actor.system.ap.value = 20;
  foundry.applications.handlebars.renderTemplate = async () => {
    g.effects.delete("bleeding");
    return "card";
  };
  await assert.rejects(endConditionAction(g.actor, "bleeding"), /condition changed/);
  assert.equal(g.actor.system.ap.value, 20);
});

test("a successful recovery preserves composite statuses and rolls back AP and removal if chat fails", async () => {
  for (const id of ["bleeding", "burning"]) {
    const f = fixture();
    f.add("both", [id, "poison"]);
    f.add("single", [id]);
    f.totals.push(20);
    f.ChatMessage.create = async () => undefined;
    await assert.rejects(endConditionAction(f.actor, id), /not posted/);
    assert.deepEqual([...f.effects.get("both").statuses], [id, "poison"]);
    assert.equal(f.effects.has("single"), true);
    assert.equal(f.actor.system.ap.value, 20);
    assert.equal(f.actor.system.command.value, 2);
  }
});

test("partial deletion restores every original effect and refunds the recovery cost", async () => {
  const f = fixture();
  f.add("a", ["bleeding"]);
  f.add("b", ["bleeding"]);
  f.totals.push(20);
  f.actor.deleteEmbeddedDocuments = async (type, ids) => {
    f.effects.delete(ids[0]);
    throw new Error("partial deletion");
  };
  await assert.rejects(endConditionAction(f.actor, "bleeding"), /partial deletion/);
  assert.equal(f.effects.has("a"), true);
  assert.equal(f.effects.has("b"), true);
  assert.equal(f.actor.system.ap.value, 20);
  assert.equal(f.actor.system.command.value, 2);
});

test("a cancelled recovery prompt is free and Put out keeps its fixed cost without a check", async () => {
  const f = fixture();
  f.add("bleeding");
  f.add("poison");
  let input;
  foundry.applications.api = {
    DialogV2: {
      input: async options => {
        input = options;
        return null;
      }
    }
  };
  await promptEndConditionAction(f.actor, "bleeding");
  assert.equal(input.window.title, "Shake It Off");
  assert.equal(f.calls.rolls.length, 0);
  assert.equal(f.actor.system.ap.value, 20);
  foundry.applications.api.DialogV2.input = async () => ({ mode: "advantage" });
  await promptEndConditionAction(f.actor, "bleeding");
  assert.equal(f.calls.rolls[0].formula, "2d20kh1 + @mod");
  f.add("burning");
  await promptEndConditionAction(f.actor, "burning");
  assert.equal(f.calls.rolls.length, 1);
  assert.equal(f.actor.system.ap.value, 14);
  assert.equal(f.actor.statuses.has("burning"), false);
});

test("recovery cards show DC, paid AP and Wonder outcome using the existing readable roll card", async () => {
  const f = fixture();
  let view;
  foundry.applications.handlebars.renderTemplate = async (path, data) => {
    view = { path, data };
    return "card";
  };
  await rollCard(
    { total: 1, render: async () => "dice" },
    {
      label: "Shake It Off",
      mode: "disadvantage",
      success: true,
      previousMessageId: "old",
      endBleeding: { dc: 12, ap: 3, effectIds: ["old-effect"] }
    }
  );
  assert.match(view.path, /roll-card.hbs$/);
  assert.deepEqual(view.data.endBleeding, { dc: 12, ap: 3, effectIds: ["old-effect"], success: true, reroll: true });
});
