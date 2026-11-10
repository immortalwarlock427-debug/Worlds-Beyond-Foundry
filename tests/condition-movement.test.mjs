import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionMovement, grappleEscapeDc } from "../module/condition-movement-core.mjs";
import {
  actorConditionMovement,
  conditionMovementBlock,
  standUp,
  escapeGrapple,
  resolveGrappleEscape
} from "../module/condition-movement.mjs";
import { movementQuote } from "../module/movement.mjs";
import { useWonder } from "../module/roll-actions.mjs";
import { effectContext } from "../module/effects-core.mjs";

test("Prone doubles costs, immobilization is independent, and the provisional exhaustion combination is configurable", () => {
  assert.equal(conditionMovement(["prone"]).multiplier, 2);
  assert.equal(conditionMovement(["unconscious"]).multiplier, 2);
  assert.equal(conditionMovement(["prone"], { exhaustionMultiplier: 2 }).multiplier, 2);
  assert.equal(conditionMovement(["prone"], { exhaustionMultiplier: 2, stackProne: true }).multiplier, 4);
  assert.deepEqual(conditionMovement(["grappled", "restrain"]).blocked, ["Grappled", "Restrained"]);
  assert.deepEqual(conditionMovement(["stun", "blind", "poison"]).blocked, [], "other conditions keep their separate action rules");
  assert.equal(grappleEscapeDc(-1.2), 10);
  for (const value of ["", " ", null, undefined, "bad", Infinity]) assert.throws(() => grappleEscapeDc(value), /grappler's Strength/);
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
      stats: { str: { mod: 2 }, dex: { mod: 4 }, agl: { milestones: 0 }, fth: { value: faith } },
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

test("Grappled/Restrained block actual translations regardless of combat, but allow rotation, teleport and correction paths", () => {
  const f = fixture({ combat: false });
  f.add("grappled");
  const move = { origin: { x: 0, y: 0, elevation: 0 }, passed: { waypoints: [{ x: 100, y: 0 }] }, pending: { waypoints: [] } };
  assert.match(conditionMovementBlock(f.token, move), /Grappled/);
  for (const operation of [{ isUndo: true }, { isPaste: true }, { worldsBeyondFormLoadout: true }])
    assert.equal(conditionMovementBlock(f.token, move, operation), null);
  for (const action of ["displace", "teleport"]) {
    move.passed.waypoints[0].action = action;
    assert.equal(conditionMovementBlock(f.token, move), null);
  }
  move.passed.waypoints = [
    { x: 100, y: 0 },
    { x: 200, y: 0, action: "teleport" }
  ];
  assert.match(conditionMovementBlock(f.token, move), /Grappled/, "a later teleport does not excuse an ordinary segment");
  move.passed.waypoints = [{ x: 0, y: 0, rotation: 90 }];
  assert.equal(conditionMovementBlock(f.token, move), null);
  f.settings.set("automateConditionMovement", false);
  move.passed.waypoints = [{ x: 100, y: 0 }];
  assert.equal(conditionMovementBlock(f.token, move), null);
});

test("movement quotes combine Prone with exhaustion, preserve opt-outs and deny even banked movement while immobilized", () => {
  const f = fixture();
  f.add("prone");
  assert.equal(movementQuote(f.token, 10).ap, 2);
  f.actor.system.exhaustion = 4;
  assert.equal(movementQuote(f.token, 10).ap, 2);
  f.settings.set("proneStacksWithExhaustion", true);
  assert.equal(movementQuote(f.token, 10).ap, 4);
  f.settings.set("automateConditionMovement", false);
  assert.equal(movementQuote(f.token, 10).ap, 2);
  f.settings.set("automateConditionMovement", true);
  f.add("restrain");
  f.actor.getFlag = () => ({ key: "combat:1:0", receipts: [{ credit: 100, feet: 0 }] });
  assert.equal(movementQuote(f.token, 5).affordable, false);
  assert.equal(actorConditionMovement(f.actor).multiplier, 4);
});

test("Stand up spends five AP using Command first, preserves unrelated conditions and refunds on failed posting", async () => {
  const f = fixture();
  f.add("prone");
  f.add("poison");
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(standUp(f.actor), /not posted/);
  assert.equal(f.actor.statuses.has("prone"), true);
  assert.equal(f.actor.system.ap.value, 20);
  assert.equal(f.actor.system.command.value, 2);
  f.ChatMessage.create = async data => data;
  await standUp(f.actor);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.actor.system.command.value, 0);
  assert.equal(f.actor.statuses.has("prone"), false);
  assert.equal(f.actor.statuses.has("poison"), true);
  await assert.rejects(standUp(f.actor), /no longer Prone/);
});

test("composite effects keep other statuses and a partial delete failure restores condition snapshots and AP", async () => {
  const f = fixture();
  f.add("both", ["prone", "poison"]);
  f.add("p1", ["prone"]);
  f.add("p2", ["prone"]);
  f.actor.deleteEmbeddedDocuments = async (type, ids) => {
    f.effects.delete(ids[0]);
    throw new Error("partial deletion");
  };
  await assert.rejects(standUp(f.actor), /partial deletion/);
  assert.deepEqual([...f.effects.get("both").statuses], ["prone", "poison"]);
  assert.equal(f.effects.has("p1"), true);
  assert.equal(f.effects.has("p2"), true);
  assert.equal(f.actor.system.ap.value, 20);
  assert.equal(f.actor.system.command.value, 2);
});

test("exhaustion nine requires assistance; incapacitation and insufficient AP reject standing before status deletion", async () => {
  const f = fixture();
  f.add("prone");
  f.actor.system.exhaustion = 9;
  await assert.rejects(standUp(f.actor), /requires assistance/);
  await standUp(f.actor, { assisted: true });
  assert.equal(f.actor.statuses.has("prone"), false);
  f.add("prone");
  f.add("unconscious");
  await assert.rejects(standUp(f.actor, { assisted: true }), /Unconscious/);
  f.effects.delete("unconscious");
  f.actor.system.exhaustion = 0;
  f.actor.system.ap.value = 1;
  f.actor.system.command.value = 0;
  await assert.rejects(standUp(f.actor), /Not enough AP/);
  assert.equal(f.actor.statuses.has("prone"), true);
});

test("Escape validates the unknown modifier, pays on failures, and succeeds on a tie using selected STR/DEX and status dice", async () => {
  const f = fixture();
  f.add("grappled");
  f.add("poison");
  await assert.rejects(escapeGrapple(f.actor, { grapplerStr: "" }), /grappler's Strength/);
  assert.equal(f.calls.rolls.length, 0);
  f.totals.push(13);
  const failed = await escapeGrapple(f.actor, { grapplerStr: 2, stat: "dex" });
  assert.equal(f.actor.statuses.has("grappled"), true);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.calls.rolls[0].formula, "2d20kl1 + @mod");
  assert.equal(f.calls.rolls[0].data.mod, 4);
  assert.equal(failed.getFlag("worlds-beyond", "check").escapeGrapple.dc, 14);
  f.totals.push(14);
  await escapeGrapple(f.actor, { grapplerStr: 2, stat: "str", mode: "normal" });
  assert.equal(f.actor.statuses.has("grappled"), false);
  assert.equal(f.actor.statuses.has("poison"), true);
  assert.equal(f.actor.system.ap.value, 12);
});

test("failed Escape posting refunds AP and restores a successfully removed grapple; outside combat attempts cost no AP", async () => {
  const f = fixture();
  f.add("grappled");
  f.totals.push(20);
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(escapeGrapple(f.actor, { grapplerStr: 0 }), /not posted/);
  assert.equal(f.actor.statuses.has("grappled"), true);
  assert.equal(f.actor.system.ap.value, 20);
  assert.equal(f.actor.system.command.value, 2);
  const g = fixture({ combat: false });
  g.add("grappled");
  g.totals.push(20);
  await escapeGrapple(g.actor, { grapplerStr: 0 });
  assert.equal(g.actor.system.ap.value, 20);
  assert.equal(g.actor.statuses.has("grappled"), false);
});

test("Wonder rerolls an Escape with no additional AP and cannot clear a different newly applied grapple", async () => {
  const f = fixture();
  f.add("grappled");
  f.totals.push(5, 20);
  const failed = await escapeGrapple(f.actor, { grapplerStr: 2 });
  const reroll = await useWonder(failed);
  assert.equal(f.actor.statuses.has("grappled"), false);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.actor.system.wonder.value, 1);
  f.add("new-grapple", ["grappled"]);
  assert.equal(await resolveGrappleEscape(f.actor, reroll.getFlag("worlds-beyond", "check"), { total: 20 }), 0);
  assert.equal(f.actor.statuses.has("grappled"), true);
});

test("Defy Fate succeeds at Escape without a new roll; failed Wonder posting leaves Grappled and refunds Wonder", async () => {
  const f = fixture({ faith: 21 });
  f.add("grappled");
  f.totals.push(1);
  const failed = await escapeGrapple(f.actor, { grapplerStr: 10 });
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(useWonder(failed), /not posted/);
  assert.equal(f.actor.system.wonder.value, 2);
  assert.equal(f.actor.statuses.has("grappled"), true);
  f.ChatMessage.create = async data => data;
  await useWonder(failed);
  assert.equal(f.calls.rolls.length, 1);
  assert.equal(f.actor.statuses.has("grappled"), false);
  assert.equal(f.actor.system.ap.value, 17);
});

test("Status presents Stand up and Escape actions while retaining End as a manual correction", () => {
  const f = fixture();
  f.add("prone");
  f.add("grappled");
  f.add("restrain");
  const rows = effectContext(f.actor).statuses;
  assert.equal(rows.find(r => r.condition === "prone").endAction.label, "Stand up");
  assert.equal(rows.find(r => r.condition === "grappled").endAction.label, "Escape");
  assert.equal(rows.find(r => r.condition === "restrain").endAction, null);
  assert.equal(
    rows.every(r => r.canEnd),
    true
  );
});

test("multiple grapples require a chosen effect; success leaves other grapples and composite statuses active", async () => {
  const f = fixture();
  f.add("first", ["grappled", "poison"]);
  f.add("second", ["grappled"]);
  await assert.rejects(escapeGrapple(f.actor, { grapplerStr: 0 }), /Several grapples/);
  assert.equal(f.calls.rolls.length, 0);
  f.totals.push(20);
  await escapeGrapple(f.actor, { grapplerStr: 0, effectId: "first" });
  assert.deepEqual([...f.effects.get("first").statuses], ["poison"]);
  assert.equal(f.effects.get("second").statuses.has("grappled"), true);
  assert.equal(f.actor.statuses.has("grappled"), true);
});
