import { test } from "node:test";
import assert from "node:assert/strict";
import { promptParry, rollParry, resetParryUse, parryState, rollBlock } from "../module/reaction-actions.mjs";
import { useWonder } from "../module/roll-actions.mjs";

function fixture({ mode = "public", faith = 18 } = {}) {
  const calls = { evaluations: [], posts: [], updates: [], templates: [], dialogs: [] };
  const actor = {
    uuid: "Scene.test.Token.hero.Actor.hero", type: "character", isOwner: true,
    items: [{ type: "weapon", system: { equipped: true } }], flags: { wonderUsed: {}, parryUses: {} },
    getFlag(scope, key) { return this.flags[key]; },
    system: { level: 1, stats: { dex: { value: 21, effective: 21, mod: 4 }, str: { mod: 2 }, fth: { value: faith } }, reactions: { value: 2 }, ap: { value: 17 }, health: { damage: 8 }, wonder: { value: 2 } },
    async update(data) {
      calls.updates.push(data);
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("system.")) { const [, pool, field] = key.split("."); this.system[pool][field] = value; }
        else {
          const [, , flag, id] = key.split(".");
          this.flags[flag] ??= {};
          if (id.startsWith("-=")) delete this.flags[flag][id.slice(2)];
          else this.flags[flag][id] = value;
        }
      }
      return this;
    }
  };
  let nextDie = 10;
  class Roll {
    static validate() { return true; }
    constructor(formula, data) { this.formula = formula; this.data = { ...data }; }
    async evaluate(options) {
      calls.evaluations.push({ formula: this.formula, data: this.data, options });
      this.total = nextDie + this.data.mod;
      this.dice = [{ faces: 20, results: [{ result: nextDie, active: true }] }]; return this;
    }
    clone() { return new Roll(this.formula, this.data); }
    async render() { return '<div class="dice-roll">roll markup</div>'; }
  }
  const messages = new Map(); Object.defineProperty(messages, "contents", { get: () => [...messages.values()] });
  const ChatMessage = {
    getSpeaker: () => ({ scene: "test", token: "hero" }), getSpeakerActor: () => actor,
    async create(data, options) {
      calls.posts.push({ data, options });
      const message = { id: `post${calls.posts.length}`, isContentVisible: true, whisper: [], blind: false, ...data,
        getFlag: (scope, key) => data.flags?.[scope]?.[key] };
      messages.set(message.id, message); return message;
    }
  };
  const DialogV2 = { async input(options) { calls.dialogs.push(options); return null; } };
  const handlebars = { async renderTemplate(path, data) { calls.templates.push({ path, data }); return "rendered"; } };
  globalThis.foundry = { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } }, applications: { api: { DialogV2 }, handlebars } };
  const combat = { id: "encounter", started: true, round: 1, turn: 0, combatants: [{ actor }] };
  globalThis.game = { user: { id: "player" }, settings: { get: () => mode }, messages, combat, combats: new Map([[combat.id, combat]]) };
  return { actor, combat, calls, Roll, ChatMessage, DialogV2, handlebars, setDie: value => { nextDie = value; } };
}

test("Parry dialog uses prepared DEX/equipment and combat defaults; cancel and out-of-combat practice spend nothing", async () => {
  const f = fixture();
  await promptParry(f.actor);
  assert.equal(f.calls.templates[0].data.modifier, 4);
  assert.equal(f.calls.templates[0].data.spendReaction, true);
  assert.equal(f.calls.templates[0].data.unlocked, true); assert.equal(f.calls.templates[0].data.armed, true);
  f.actor.system.stats.dex.effective = 20; f.actor.items = [];
  await promptParry(f.actor);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  assert.equal(f.calls.templates.at(-1).data.unlocked, false); assert.equal(f.calls.templates.at(-1).data.armed, false);
  f.combat.started = false;
  await promptParry(f.actor);
  assert.equal(f.calls.templates.at(-1).data.combatId, null);
  assert.equal(f.calls.posts.length, 0); assert.equal(f.calls.updates.length, 0);
  await rollParry(f.actor); await rollParry(f.actor);
  assert.equal(f.calls.updates.length, 0); assert.equal(f.calls.posts.length, 2);
});

test("Parry spends one reaction and marks one use per round, not per turn; other pools remain unchanged", async () => {
  const f = fixture();
  const message = await rollParry(f.actor, { target: 14, ally: true, spendReaction: true });
  assert.equal(message.getFlag("worlds-beyond", "check").label, "Parry for an ally");
  assert.equal(f.calls.templates[0].data.defense.success, false);
  assert.equal(f.actor.system.reactions.value, 1); assert.equal(f.actor.flags.parryUses.encounter, 1);
  assert.equal(f.actor.system.ap.value, 17); assert.equal(f.actor.system.health.damage, 8); assert.equal(f.actor.system.wonder.value, 2);
  f.combat.turn++;
  await assert.rejects(rollParry(f.actor, { spendReaction: true }), /already used this round/);
  f.combat.round++;
  assert.equal(parryState(f.actor).used, false);
  await rollParry(f.actor, { spendReaction: true });
  assert.equal(f.actor.flags.parryUses.encounter, 2); assert.equal(f.actor.system.reactions.value, 0);
});

test("viewed combat takes priority and Parry flags remain separate; reset clears only its use without refunding", async () => {
  const f = fixture();
  const second = { ...f.combat, id: "second", round: 5 };
  game.combats.set(second.id, second); game.combat = second;
  f.actor.flags.parryUses.encounter = 1;
  await rollParry(f.actor, { spendReaction: true });
  assert.deepEqual(f.actor.flags.parryUses, { encounter: 1, second: 5 });
  await promptParry(f.actor);
  assert.equal(f.calls.templates.at(-1).data.used, true);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  assert.equal(f.calls.dialogs.at(-1).buttons[0].label, "Reset Parry use");
  assert.equal(await f.calls.dialogs.at(-1).buttons[0].callback(), null);
  assert.deepEqual(f.actor.flags.parryUses, { encounter: 1 });
  assert.equal(f.actor.system.reactions.value, 1);
  const count = f.calls.updates.length;
  await resetParryUse(f.actor);
  assert.equal(f.calls.updates.length, count);
});

test("Parry supports all dice/chat modes and allows natural-20 attacks; Overwhelming Force keeps the floor", async () => {
  for (const messageMode of ["public", "gm", "blind", "self"]) {
    for (const mode of ["normal", "advantage", "disadvantage"]) {
      const f = fixture({ mode: messageMode }); f.setDie(19);
      await rollParry(f.actor, { target: 20, mode, overwhelmingForce: true });
      assert.equal(f.calls.evaluations[0].data.mod, 4);
      assert.equal(f.calls.evaluations[0].formula, mode === "normal" ? "1d20 + @mod" : mode === "advantage" ? "2d20kh1 + @mod" : "2d20kl1 + @mod");
      assert.equal(f.calls.evaluations[0].options.allowInteractive, messageMode !== "blind");
      assert.deepEqual(f.calls.posts[0].options, { messageMode });
      assert.equal(f.calls.templates[0].data.defense.damageMultiplier, 0.5);
    }
  }
});

test("invalid input and empty reactions spend nothing; practice preserves existing round use", async () => {
  const f = fixture();
  for (const options of [{ target: "invalid" }, { mode: "invalid" }]) await assert.rejects(rollParry(f.actor, { ...options, spendReaction: true }));
  f.actor.system.reactions.value = 0;
  await assert.rejects(rollParry(f.actor, { spendReaction: true }), /No reactions left/);
  assert.equal(f.calls.evaluations.length, 0); assert.equal(f.calls.updates.length, 0);
  f.actor.flags.parryUses.encounter = 1;
  await rollParry(f.actor, { target: "" });
  assert.equal(f.calls.templates[0].data.defense.resolved, false);
  assert.equal(f.actor.flags.parryUses.encounter, 1); assert.equal(f.actor.system.reactions.value, 0);
});

test("Parry failures do not spend or mark; posting failure restores the previous round flag as well as the reaction", async () => {
  for (const failure of ["evaluate", "render", "template", "post", "cancelledPost", "cancelledUpdate"]) {
    const f = fixture(); f.combat.round = 2; f.actor.flags.parryUses.encounter = 1;
    if (["evaluate", "render"].includes(failure)) f.Roll.prototype[failure] = async () => { throw new Error(failure); };
    if (failure === "template") f.handlebars.renderTemplate = async () => { throw new Error(failure); };
    if (failure === "post") f.ChatMessage.create = async () => { throw new Error(failure); };
    if (failure === "cancelledPost") f.ChatMessage.create = async () => undefined;
    if (failure === "cancelledUpdate") f.actor.update = async () => undefined;
    await assert.rejects(rollParry(f.actor, { spendReaction: true }));
    assert.equal(f.actor.system.reactions.value, 2); assert.equal(f.actor.flags.parryUses.encounter, 1);
    assert.equal(f.calls.posts.length, 0);
  }
  const f = fixture(); f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(rollParry(f.actor, { spendReaction: true }), /offline/);
  assert.equal(f.actor.flags.parryUses.encounter, undefined);
  const update = f.actor.update; let spent = false;
  f.actor.update = async data => { if (spent) throw new Error("refund failed"); spent = true; return update.call(f.actor, data); };
  await assert.rejects(rollParry(f.actor, { spendReaction: true }), /Recovery also failed;.*Parry use/);
});

test("rapid Parry/Block spending shares the final reaction; duplicate Parry attempts do not mark a second use", async () => {
  const f = fixture(); f.actor.system.reactions.value = 1;
  const result = await Promise.allSettled([rollParry(f.actor, { spendReaction: true }), rollBlock(f.actor, { spendReaction: true }), rollParry(f.actor, { spendReaction: true })]);
  assert.equal(result[0].status, "fulfilled"); assert.equal(result[1].status, "rejected"); assert.equal(result[2].status, "rejected");
  assert.equal(f.actor.system.reactions.value, 0); assert.equal(f.calls.posts.length, 1);
});

test("Wonder preserves Parry target, ally, modifier, mode, audience and original round without another Parry spend", async () => {
  const f = fixture();
  const original = await rollParry(f.actor, { target: 18, ally: true, mode: "advantage", spendReaction: true });
  original.whisper = ["gm"]; original.blind = true;
  f.actor.system.stats.dex.mod = 9; f.setDie(18); f.combat.round = 2;
  const reroll = await useWonder(original);
  const latest = f.calls.templates.at(-1).data.defense;
  assert.equal(latest.success, true); assert.equal(latest.target, 18); assert.equal(latest.ally, true); assert.equal(latest.round, 1);
  assert.equal(f.calls.evaluations.at(-1).data.mod, 4); assert.equal(f.calls.evaluations.at(-1).formula, "2d20kh1 + @mod");
  assert.equal(f.calls.evaluations.at(-1).options.allowInteractive, false);
  assert.deepEqual(reroll.whisper, ["gm"]); assert.equal(reroll.blind, true);
  assert.equal(f.actor.system.reactions.value, 1); assert.equal(f.actor.system.wonder.value, 1); assert.equal(f.actor.flags.parryUses.encounter, 1);
  assert.equal(parryState(f.actor).used, false);
  await assert.rejects(useWonder(original), /already used/);
});

test("Defy Fate can succeed at Parry but cannot bypass Overwhelming Force; non-owners cannot roll or reset", async () => {
  const f = fixture({ faith: 21 });
  const original = await rollParry(f.actor, { target: 30, overwhelmingForce: true, spendReaction: true });
  await useWonder(original);
  assert.equal(f.calls.templates.at(-1).data.defense.success, true);
  assert.equal(f.calls.templates.at(-1).data.defense.damageMultiplier, 0.5);
  assert.equal(f.calls.evaluations.length, 1); assert.equal(f.actor.system.reactions.value, 1); assert.equal(f.actor.flags.parryUses.encounter, 1);
  for (const fields of [{ isOwner: false }, { type: "npc" }]) {
    const guarded = fixture(); Object.assign(guarded.actor, fields);
    await promptParry(guarded.actor); await rollParry(guarded.actor); await resetParryUse(guarded.actor);
    assert.equal(guarded.calls.templates.length, 0); assert.equal(guarded.calls.posts.length, 0); assert.equal(guarded.calls.updates.length, 0);
  }
});
