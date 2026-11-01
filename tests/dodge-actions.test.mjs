import { test } from "node:test";
import assert from "node:assert/strict";
import { promptDodge, rollDodge, rollBlock } from "../module/reaction-actions.mjs";
import { useWonder, decorateRollMessage } from "../module/roll-actions.mjs";

function fixture({ mode = "public", faith = 18, heavyArmor = false } = {}) {
  const calls = { evaluations: [], posts: [], updates: [], templates: [], dialogs: [] };
  const actor = {
    uuid: "Scene.test.Token.hero.Actor.hero", type: "character", isOwner: true, items: [], flags: { wonderUsed: {} },
    getFlag(scope, key) { return this.flags[key]; },
    system: { level: 1, stats: { agl: { mod: -1 }, str: { mod: 2 }, fth: { value: faith } }, equipment: { heavyDisadvantage: heavyArmor }, reactions: { value: 2 }, ap: { value: 17 }, health: { damage: 8 }, wonder: { value: 2 } },
    async update(data) {
      calls.updates.push(data);
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("system.")) { const [, pool, field] = key.split("."); this.system[pool][field] = value; }
        else if (key.startsWith("flags.worlds-beyond.wonderUsed.")) {
          const id = key.slice("flags.worlds-beyond.wonderUsed.".length);
          if (id.startsWith("-=")) delete this.flags.wonderUsed[id.slice(2)];
          else this.flags.wonderUsed[id] = value;
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
      this.dice = [{ faces: 20, results: [{ result: nextDie, active: true }] }];
      return this;
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
      messages.set(message.id, message);
      return message;
    }
  };
  const DialogV2 = { async input(options) { calls.dialogs.push(options); return null; } };
  const handlebars = { async renderTemplate(path, data) { calls.templates.push({ path, data }); return "rendered"; } };
  globalThis.foundry = { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } }, applications: { api: { DialogV2 }, handlebars } };
  globalThis.game = { user: { id: "player" }, settings: { get: () => mode }, messages, combats: [{ started: true, combatants: [{ actor }] }] };
  return { actor, calls, Roll, ChatMessage, DialogV2, handlebars, setDie: value => { nextDie = value; } };
}

test("Dodge dialog uses prepared AGL, heavy armor and combat spending defaults; cancellation changes nothing", async () => {
  const f = fixture({ heavyArmor: true });
  await promptDodge(f.actor);
  assert.deepEqual(f.calls.templates[0].data, { modifier: -1, heavyArmor: true, reactions: 2, spendReaction: true });
  game.combats[0].started = false;
  await promptDodge(f.actor);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  assert.equal(f.calls.posts.length, 0); assert.equal(f.calls.updates.length, 0); assert.equal(f.calls.evaluations.length, 0);
});

test("Dodge posts an AGL check or area save with stored target, spends one reaction and leaves Health/AP/Wonder alone", async () => {
  for (const against of ["attack", "area"]) {
    const f = fixture();
    const message = await rollDodge(f.actor, { against, target: 9, spendReaction: true });
    assert.equal(f.calls.evaluations[0].data.mod, -1);
    assert.deepEqual(f.calls.updates, [{ "system.reactions.value": 1 }]);
    assert.equal(f.actor.system.health.damage, 8); assert.equal(f.actor.system.ap.value, 17); assert.equal(f.actor.system.wonder.value, 2);
    const context = message.getFlag("worlds-beyond", "check");
    assert.equal(context.kind, against === "area" ? "save" : "check");
    assert.equal(context.actorUuid, f.actor.uuid);
    assert.equal(context.defense.target, 9);
    assert.equal(f.calls.templates[0].data.defense.success, against === "area");
    assert.deepEqual(message.speaker, { scene: "test", token: "hero" });
  }
});

test("Dodge supports all dice and visibility modes; heavy disadvantage is selected by default and can be corrected", async () => {
  for (const messageMode of ["public", "gm", "blind", "self"]) {
    for (const mode of ["normal", "advantage", "disadvantage"]) {
      const f = fixture({ mode: messageMode, heavyArmor: true });
      await rollDodge(f.actor, { mode });
      assert.equal(f.calls.evaluations[0].formula, mode === "normal" ? "1d20 + @mod" : mode === "advantage" ? "2d20kh1 + @mod" : "2d20kl1 + @mod");
      assert.equal(f.calls.evaluations[0].options.allowInteractive, messageMode !== "blind");
      assert.deepEqual(f.calls.posts[0].options, { messageMode });
      assert.equal(f.calls.templates[0].data.defense.overriddenDisadvantage, mode !== "disadvantage");
    }
  }
  const f = fixture({ heavyArmor: true });
  await rollDodge(f.actor);
  assert.equal(f.calls.evaluations[0].formula, "2d20kl1 + @mod");
});

test("invalid input, incoming natural 20 and empty reaction pool spend nothing; explicit practice rolls still work", async () => {
  const f = fixture();
  for (const options of [{ natural20: true }, { target: "invalid" }, { mode: "invalid" }]) await assert.rejects(rollDodge(f.actor, { ...options, spendReaction: true }));
  f.actor.system.reactions.value = 0;
  await assert.rejects(rollDodge(f.actor, { spendReaction: true }), /No reactions left/);
  assert.equal(f.calls.evaluations.length, 0); assert.equal(f.calls.updates.length, 0);
  await rollDodge(f.actor, { against: "area", natural20: true, target: "" });
  assert.equal(f.calls.templates[0].data.defense.resolved, false);
  assert.equal(f.calls.updates.length, 0);
});

test("failed dice/render/template operations do not spend; failed posts refund; cancelled updates do not post", async () => {
  for (const failure of ["evaluate", "render", "template", "post", "cancelledPost", "cancelledUpdate"]) {
    const f = fixture();
    if (["evaluate", "render"].includes(failure)) f.Roll.prototype[failure] = async () => { throw new Error(failure); };
    if (failure === "template") f.handlebars.renderTemplate = async () => { throw new Error(failure); };
    if (failure === "post") f.ChatMessage.create = async () => { throw new Error(failure); };
    if (failure === "cancelledPost") f.ChatMessage.create = async () => undefined;
    if (failure === "cancelledUpdate") f.actor.update = async () => undefined;
    await assert.rejects(rollDodge(f.actor, { spendReaction: true }));
    assert.equal(f.actor.system.reactions.value, 2);
    assert.equal(f.calls.posts.length, 0);
  }
});

test("Dodge and Block share the final reaction queue, and non-owned actors cannot roll", async () => {
  const f = fixture(); f.actor.system.reactions.value = 1;
  const result = await Promise.allSettled([rollDodge(f.actor, { spendReaction: true }), rollBlock(f.actor, { spendReaction: true })]);
  assert.equal(result[0].status, "fulfilled"); assert.equal(result[1].status, "rejected");
  assert.equal(f.actor.system.reactions.value, 0); assert.equal(f.calls.posts.length, 1);
  for (const fields of [{ isOwner: false }, { type: "npc" }]) {
    const guarded = fixture(); Object.assign(guarded.actor, fields);
    await promptDodge(guarded.actor); await rollDodge(guarded.actor);
    assert.equal(guarded.calls.templates.length, 0); assert.equal(guarded.calls.posts.length, 0);
  }
});

test("Wonder keeps Dodge target, original modifier/dice and private audience, recomputes the outcome and spends no reaction", async () => {
  const f = fixture();
  const original = await rollDodge(f.actor, { target: 15, mode: "advantage", spendReaction: true });
  original.whisper = ["gm"]; original.blind = true;
  f.actor.system.stats.agl.mod = 9; f.setDie(18);
  const reroll = await useWonder(original);
  const latest = f.calls.templates.at(-1).data.defense;
  assert.equal(latest.success, true); assert.equal(latest.target, 15); assert.equal(latest.reroll, true);
  assert.equal(f.calls.evaluations.at(-1).data.mod, -1);
  assert.equal(f.calls.evaluations.at(-1).formula, "2d20kh1 + @mod");
  assert.equal(f.calls.evaluations.at(-1).options.allowInteractive, false);
  assert.deepEqual(reroll.whisper, ["gm"]); assert.equal(reroll.blind, true);
  assert.equal(f.actor.system.reactions.value, 1); assert.equal(f.actor.system.wonder.value, 1);
  await assert.rejects(useWonder(original), /already used/);
  await useWonder(reroll);
  assert.equal(f.actor.system.wonder.value, 0); assert.equal(f.actor.system.reactions.value, 1);
});

test("Defy Fate changes a failed direct or area Dodge into success without new dice or another reaction", async () => {
  for (const against of ["attack", "area"]) {
    const f = fixture({ faith: 21 });
    const original = await rollDodge(f.actor, { against, target: 30, spendReaction: true });
    await useWonder(original);
    const latest = f.calls.templates.at(-1).data;
    assert.equal(latest.success, true); assert.equal(latest.defense.success, true);
    assert.equal(latest.defense.damageMultiplier, against === "area" ? 0.5 : 0);
    assert.equal(f.calls.evaluations.length, 1); assert.equal(f.actor.system.reactions.value, 1); assert.equal(f.actor.system.wonder.value, 1);
  }
});

test("Dodge cards use readable d20 results and Wonder controls; hidden results expose neither", async () => {
  const f = fixture(); const message = await rollDodge(f.actor, { mode: "disadvantage" });
  const formula = {}; const details = {}; const buttons = [];
  globalThis.document = { createElement: () => ({ dataset: {}, addEventListener() {} }) };
  const html = {
    classList: { add() {} },
    querySelector: selector => ({ ".dice-formula": formula, ".wb-dice-results": details, ".message-content": { querySelector: () => undefined, append: button => buttons.push(button) } })[selector],
    querySelectorAll: () => []
  };
  decorateRollMessage(message, html);
  assert.equal(formula.textContent, "10 − 1 = 9"); assert.equal(buttons[0].textContent, "Use Wonder");
  message.isContentVisible = false;
  await useWonder(message);
  decorateRollMessage(message, { classList: { add() { throw new Error("Hidden content inspected"); } } });
  assert.equal(f.actor.system.wonder.value, 2);
});
