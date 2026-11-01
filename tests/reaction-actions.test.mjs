import { test } from "node:test";
import assert from "node:assert/strict";
import { promptBlock, rollBlock, decorateReactionMessage } from "../module/reaction-actions.mjs";

function fixture(mode = "public") {
  const calls = { evaluations: [], posts: [], updates: [], templates: [], dialogs: [] };
  const actor = {
    uuid: "Actor.blocker", type: "character", isOwner: true,
    items: [{ type: "shield", system: { equipped: true, blockDie: "1d8" } }],
    system: { level: 5, stats: { str: { mod: 4 } }, reactions: { value: 2 }, ap: { value: 17 }, health: { damage: 8 }, wonder: { value: 1 } },
    async update(data) {
      calls.updates.push(data);
      for (const [key, value] of Object.entries(data)) {
        const [, pool, field] = key.split("."); this.system[pool][field] = value;
      }
      return this;
    }
  };
  class Roll {
    static validate(formula) { return formula !== "invalid"; }
    constructor(formula, data) { this.formula = formula; this.data = data; }
    async evaluate(options) { calls.evaluations.push({ formula: this.formula, data: this.data, options }); this.total = 12; return this; }
    async render() { return '<div class="dice-roll">8 + 4 = 12</div>'; }
  }
  const ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.uuid }),
    async create(data, options) { calls.posts.push({ data, options }); return { id: "result", ...data }; }
  };
  const DialogV2 = { async input(options) { calls.dialogs.push(options); return null; } };
  const handlebars = { async renderTemplate(path, data) { calls.templates.push({ path, data }); return "rendered"; } };
  globalThis.foundry = { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } }, applications: { api: { DialogV2 }, handlebars } };
  globalThis.game = { settings: { get: () => mode }, combats: [{ started: true, combatants: [{ actor }] }] };
  return { actor, calls, Roll, ChatMessage, DialogV2, handlebars };
}

test("Block dialog defaults to spending only in a started combat containing this actor; cancel does nothing", async () => {
  const f = fixture();
  await promptBlock(f.actor);
  assert.deepEqual(f.calls.templates[0].data, { formula: "2d8 + @mod", modifier: 4, reactions: 2, spendReaction: true });
  assert.equal(f.calls.dialogs[0].rejectClose, false);
  game.combats[0].started = false;
  await promptBlock(f.actor);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  game.combats[0].started = true;
  game.combats[0].combatants = [{ actor: { uuid: "Actor.other" } }];
  await promptBlock(f.actor);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  assert.equal(f.calls.evaluations.length, 0);
  assert.equal(f.calls.posts.length, 0);
  assert.equal(f.calls.updates.length, 0);
});

test("Block uses level/shield dice and effective STR, spends one reaction and leaves other pools unchanged", async () => {
  const f = fixture();
  await rollBlock(f.actor, { spendReaction: true });
  assert.deepEqual(f.calls.evaluations[0], { formula: "2d8 + @mod", data: { mod: 4 }, options: { allowInteractive: true } });
  assert.deepEqual(f.calls.updates, [{ "system.reactions.value": 1 }]);
  assert.equal(f.actor.system.ap.value, 17);
  assert.equal(f.actor.system.health.damage, 8);
  assert.equal(f.actor.system.wonder.value, 1);
  assert.equal(f.calls.templates[0].data.rollHTML, '<div class="dice-roll">8 + 4 = 12</div>');
  assert.deepEqual(f.calls.posts[0].data.flags["worlds-beyond"].reaction, { kind: "block", actorUuid: f.actor.uuid, spent: true });
});

test("Block passes all four chat visibility modes; blind rolls disable interactive dice", async () => {
  for (const mode of ["public", "gm", "blind", "self"]) {
    const f = fixture(mode);
    await rollBlock(f.actor);
    assert.deepEqual(f.calls.posts[0].options, { messageMode: mode });
    assert.equal(f.calls.evaluations[0].options.allowInteractive, mode !== "blind");
  }
});

test("empty reactions require a correction or explicit unspent roll; custom formulas remain editable", async () => {
  const f = fixture(); f.actor.system.reactions.value = 0;
  await assert.rejects(rollBlock(f.actor, { spendReaction: true }), /No reactions left/);
  assert.equal(f.calls.evaluations.length, 0);
  await rollBlock(f.actor, { spendReaction: false, formula: " (2d8 * 2) + @mod " });
  assert.equal(f.calls.evaluations[0].formula, "(2d8 * 2) + @mod");
  assert.equal(f.calls.updates.length, 0);
  assert.equal(f.calls.posts[0].data.flags["worlds-beyond"].reaction.spent, false);
});

test("invalid formula, dice and rendering failures spend nothing and post nothing", async () => {
  for (const failure of ["empty", "invalid", "evaluate", "render", "template"]) {
    const f = fixture();
    if (["evaluate", "render"].includes(failure)) f.Roll.prototype[failure] = async () => { throw new Error(failure); };
    if (failure === "template") f.handlebars.renderTemplate = async () => { throw new Error(failure); };
    await assert.rejects(rollBlock(f.actor, { spendReaction: true, formula: failure === "empty" ? " " : failure === "invalid" ? "invalid" : undefined }));
    assert.equal(f.calls.updates.length, 0);
    assert.equal(f.calls.posts.length, 0);
    assert.equal(f.actor.system.reactions.value, 2);
  }
});

test("failed or cancelled chat posting restores reactions; cancelled spending posts nothing", async () => {
  for (const cancelled of [false, true]) {
    const f = fixture();
    f.ChatMessage.create = async () => { if (!cancelled) throw new Error("offline"); };
    await assert.rejects(rollBlock(f.actor, { spendReaction: true }), cancelled ? /not posted/ : /offline/);
    assert.equal(f.actor.system.reactions.value, 2);
    assert.deepEqual(f.calls.updates, [{ "system.reactions.value": 1 }, { "system.reactions.value": 2 }]);
  }
  const f = fixture(); f.actor.update = async () => undefined;
  await assert.rejects(rollBlock(f.actor, { spendReaction: true }), /cancelled/);
  assert.equal(f.calls.posts.length, 0);
});

test("two rapid Blocks cannot both spend the final reaction; practice rolls remain repeatable", async () => {
  const f = fixture(); f.actor.system.reactions.value = 1;
  const result = await Promise.allSettled([rollBlock(f.actor, { spendReaction: true }), rollBlock(f.actor, { spendReaction: true })]);
  assert.equal(result[0].status, "fulfilled");
  assert.equal(result[1].status, "rejected");
  assert.equal(f.actor.system.reactions.value, 0);
  assert.equal(f.calls.posts.length, 1);
  await rollBlock(f.actor); await rollBlock(f.actor);
  assert.equal(f.calls.posts.length, 3);
});

test("failed reaction recovery reports manual correction, and actors without edit permission cannot roll", async () => {
  const f = fixture(); const update = f.actor.update; let spent = false;
  f.actor.update = async data => { if (spent) throw new Error("refund failed"); spent = true; return update.call(f.actor, data); };
  f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(rollBlock(f.actor, { spendReaction: true }), /Recovery also failed; check AP, reactions/);
  for (const values of [{ isOwner: false }, { type: "npc" }]) {
    const guarded = fixture(); Object.assign(guarded.actor, values);
    await promptBlock(guarded.actor); await rollBlock(guarded.actor);
    assert.equal(guarded.calls.templates.length, 0);
    assert.equal(guarded.calls.updates.length, 0);
    assert.equal(guarded.calls.posts.length, 0);
  }
});

test("only visible Block messages receive the system's chat theme", () => {
  const classes = [];
  const html = { classList: { add: (...values) => classes.push(...values) } };
  decorateReactionMessage({ isContentVisible: false, getFlag() { throw new Error("Hidden message inspected"); } }, html);
  decorateReactionMessage({ isContentVisible: true, getFlag: () => undefined }, html);
  assert.deepEqual(classes, []);
  decorateReactionMessage({ isContentVisible: true, getFlag: () => ({ kind: "block" }) }, html);
  assert.deepEqual(classes, ["worlds-beyond", "wb-chat-message"]);
});
