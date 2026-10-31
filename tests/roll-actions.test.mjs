import { test } from "node:test";
import assert from "node:assert/strict";
import { promptStatCheck, rollStatCheck, useWonder, restoreWonder, decorateRollMessage, refreshWonderControls } from "../module/roll-actions.mjs";

function fixture({ faith = 18, value = 2, kind = "check", mode = "normal", blind = false, whisper = [] } = {}) {
  const calls = { rolls: [], messages: [], updates: [], cards: [], warnings: [], initiative: [] };
  const actor = {
    uuid: "Actor.hero", type: "character", isOwner: true,
    flags: { wonderUsed: {} },
    getFlag(scope, key) { return this.flags[key]; },
    system: { stats: { str: { mod: 3 }, fth: { value: faith } }, wonder: { value, max: 2 } },
    async update(data) {
      calls.updates.push(data);
      this.system.wonder.value = data["system.wonder.value"] ?? this.system.wonder.max;
      for (const [key, value] of Object.entries(data)) {
        const prefix = "flags.worlds-beyond.wonderUsed.";
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (id.startsWith("-=")) delete this.flags.wonderUsed[id.slice(2)];
        else this.flags.wonderUsed[id] = value;
      }
      return this;
    }
  };
  class Roll {
    constructor(formula, data = {}) { this.formula = formula; this.data = { ...data }; this.dice = [{ faces: 20, results: [{ result: 4, active: true }] }]; this.options = {}; }
    async evaluate(options) { calls.rolls.push({ formula: this.formula, data: this.data, options }); this.dice[0].results = [{ result: 10, active: true }]; this.total = 10 + (this.data.mod ?? 0); return this; }
    clone() { return new Roll(this.formula, this.data); }
    async render() { return `<div class="dice-roll">${this.total}</div>`; }
    async toMessage(data, options) { calls.messages.push({ ...data, options, rolls: [this] }); return data; }
  }
  const formula = mode === "advantage" ? "2d20kh1 + @mod" : mode === "disadvantage" ? "2d20kl1 + @mod" : "1d20 + @mod";
  const original = new Roll(formula, { mod: 3 });
  original.total = 7;
  const context = { kind, mode, actorUuid: actor.uuid, label: "Strength check" };
  const message = {
    id: "original", speaker: { actor: "hero" }, rolls: [original], whisper, blind, isContentVisible: true,
    getFlag: () => context
  };
  const messages = new Map([[message.id, message]]);
  Object.defineProperty(messages, "contents", { get: () => [...messages.values()] });
  globalThis.game = { user: { id: "player" }, settings: { get: () => "public" }, combats: new Map(), messages };
  globalThis.ui = { notifications: { warn: text => calls.warnings.push(text) } };
  globalThis.foundry = {
    dice: { Roll },
    applications: {
      handlebars: { async renderTemplate(path, data) { calls.cards.push({ path, data }); return `<article>${data.label}</article>`; } },
      api: { DialogV2: { async input() { return null; } } }
    },
    documents: { ChatMessage: { implementation: {
      getSpeaker: () => message.speaker,
      getSpeakerActor: () => actor,
      async create(data) {
        calls.messages.push(data);
        const created = { id: `new${calls.messages.length}`, isContentVisible: true, ...data, getFlag: (scope, key) => data.flags?.[scope]?.[key] };
        messages.set(created.id, created);
        return created;
      }
    } } }
  };
  return { actor, message, context, original, calls, Roll };
}

test("cancelling a check dialog rolls nothing and changes no resources", async () => {
  const f = fixture();
  await promptStatCheck(f.actor, "str");
  assert.equal(f.calls.rolls.length, 0);
  assert.equal(f.calls.messages.length, 0);
  assert.equal(f.calls.updates.length, 0);
});

test("checks and saves use selected dice and Foundry v14's messageMode", async () => {
  const f = fixture();
  game.settings.get = () => "blind";
  await rollStatCheck(f.actor, "str", { kind: "save", mode: "disadvantage" });
  assert.deepEqual(f.calls.rolls[0], { formula: "2d20kl1 + @mod", data: { mod: 3 }, options: { allowInteractive: false } });
  assert.deepEqual(f.calls.messages[0].options, { messageMode: "blind" });
  assert.equal(f.calls.messages[0].flags["worlds-beyond"].check.kind, "save");
  assert.equal(f.calls.updates.length, 0);
});

test("Wonder keeps original advantage/modifier and the original private audience", async () => {
  const f = fixture({ mode: "advantage", whisper: ["gm"], blind: true });
  f.actor.system.stats.str.mod = 9;
  await useWonder(f.message);
  assert.equal(f.calls.rolls[0].formula, "2d20kh1 + @mod");
  assert.equal(f.calls.rolls[0].data.mod, 3);
  assert.equal(f.calls.rolls[0].options.allowInteractive, false);
  assert.equal(f.actor.system.wonder.value, 1);
  assert.deepEqual(f.calls.messages[0].whisper, ["gm"]);
  assert.equal(f.calls.messages[0].blind, true);
  assert.equal(f.original.total, 7);
  assert.match(f.calls.cards[0].data.note, /previous total 7/);
});

test("Defy Fate posts declared success, spends one use and does not reroll the dice", async () => {
  const f = fixture({ faith: 21, kind: "save" });
  await useWonder(f.message);
  assert.equal(f.calls.rolls.length, 0);
  assert.equal(f.actor.system.wonder.value, 1);
  assert.equal(f.calls.messages[0].flags["worlds-beyond"].check.success, true);
  assert.equal(f.calls.messages[0].rolls[0], f.original);
});

test("initiative Wonder rerolls at FTH 28 and updates the original combatant", async () => {
  const f = fixture({ faith: 28, kind: "initiative" });
  Object.assign(f.context, { combatId: "combat", combatantId: "hero-turn" });
  game.combats.set("combat", {
    combatants: new Map([["hero-turn", { id: "hero-turn", actor: f.actor }]]),
    async setInitiative(id, total) { f.calls.initiative.push({ id, total }); }
  });
  await useWonder(f.message);
  assert.equal(f.calls.rolls.length, 1);
  assert.deepEqual(f.calls.initiative, [{ id: "hero-turn", total: 13 }]);
});

test("unavailable combat updates keep the successful reroll and report manual correction", async () => {
  const f = fixture({ kind: "initiative" });
  await useWonder(f.message);
  assert.equal(f.calls.messages.length, 1);
  assert.equal(f.actor.system.wonder.value, 1);
  assert.match(f.calls.warnings[0], /original combatant no longer exists/);
});

test("attacks, hidden results, non-owned actors and resolved success cards do not spend Wonder", async () => {
  for (const change of [f => f.context.kind = "attack", f => f.message.isContentVisible = false,
    f => f.actor.isOwner = false, f => f.context.success = true, f => f.context.actorUuid = "Actor.other"]) {
    const f = fixture();
    change(f);
    await useWonder(f.message);
    assert.equal(f.calls.updates.length, 0);
    assert.equal(f.calls.messages.length, 0);
  }
});

test("render failure spends nothing and chat creation failure refunds the use", async () => {
  let f = fixture();
  foundry.applications.handlebars.renderTemplate = async () => { throw new Error("template failed"); };
  await assert.rejects(useWonder(f.message), /template failed/);
  assert.equal(f.calls.updates.length, 0);
  f = fixture();
  foundry.documents.ChatMessage.implementation.create = async () => { throw new Error("chat failed"); };
  await assert.rejects(useWonder(f.message), /chat failed/);
  assert.equal(f.actor.system.wonder.value, 2);
  assert.deepEqual(f.calls.updates.map(update => update["system.wonder.value"]), [1, 2]);
});

test("cancelled actor update posts no result", async () => {
  const f = fixture();
  f.actor.update = async () => undefined;
  await assert.rejects(useWonder(f.message), /not spent/);
  assert.equal(f.calls.messages.length, 0);
});

test("failed refund tells the player exactly how to correct the Wonder pool", async () => {
  for (const throws of [false, true]) {
    const f = fixture();
    const update = f.actor.update.bind(f.actor);
    f.actor.update = async data => {
      if (f.calls.updates.length) {
        if (throws) throw new Error("offline");
        return undefined;
      }
      return update(data);
    };
    foundry.documents.ChatMessage.implementation.create = async () => { throw new Error("chat failed"); };
    await assert.rejects(useWonder(f.message), /Restore 1 Wonder use/);
    assert.equal(f.actor.system.wonder.value, 1);
  }
});

test("rapid repeated clicks spend once and refill does not unlock the used result", async () => {
  const f = fixture({ value: 1 });
  const results = await Promise.allSettled([useWonder(f.message), useWonder(f.message)]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /already used/);
  assert.equal(f.actor.system.wonder.value, 0);
  assert.equal(f.calls.messages.length, 1);
  await restoreWonder(f.actor);
  assert.deepEqual(f.calls.updates.at(-1), { "system.wonder.value": null });
  assert.equal(f.actor.system.wonder.value, 2);
  await assert.rejects(useWonder(f.message), /already used/);
});

test("Wonder follows the new result, stops at zero and keeps used history after reload or child deletion", async () => {
  const f = fixture();
  const first = await useWonder(f.message);
  const second = await useWonder(first);
  assert.equal(f.actor.system.wonder.value, 0);
  await assert.rejects(useWonder(second), /No Wonder uses/);
  assert.equal(f.calls.rolls.length, 2);
  assert.equal(f.calls.messages.length, 2);
  f.actor.flags = JSON.parse(JSON.stringify(f.actor.flags));
  game.messages.delete(first.id);
  await restoreWonder(f.actor);
  await assert.rejects(useWonder(f.message), /already used/);
  await assert.rejects(useWonder(first), /already used/);
  await useWonder(second);
  assert.equal(f.actor.system.wonder.value, 1);
});

test("zero, negative and fractional uses cannot pay for Wonder", async () => {
  for (const value of [0, -2, 0.5]) {
    const f = fixture({ value });
    await assert.rejects(useWonder(f.message), /No Wonder uses/);
    assert.equal(f.calls.rolls.length, 0);
    assert.equal(f.calls.updates.length, 0);
    assert.equal(f.calls.messages.length, 0);
    assert.equal(f.actor.system.wonder.value, value);
  }
});

test("a legacy reroll marks its original result used without modifying that chat message", async () => {
  const f = fixture();
  game.messages.set("old-reroll", { getFlag: () => ({ ...f.context, previousMessageId: "original" }) });
  await assert.rejects(useWonder(f.message), /already used/);
  assert.equal(f.calls.updates.length, 0);
});

test("two different results competing locally for one use cannot spend below zero", async () => {
  const f = fixture({ value: 1 });
  const second = { ...f.message, id: "other" };
  const results = await Promise.allSettled([useWonder(f.message), useWonder(second)]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(f.actor.system.wonder.value, 0);
  assert.equal(f.calls.messages.length, 1);
});

test("failed chat posting restores the original result's eligibility as well as its use", async () => {
  const f = fixture();
  const create = foundry.documents.ChatMessage.implementation.create;
  foundry.documents.ChatMessage.implementation.create = async () => { throw new Error("offline"); };
  await assert.rejects(useWonder(f.message), /offline/);
  assert.equal(f.actor.flags.wonderUsed.original, undefined);
  foundry.documents.ChatMessage.implementation.create = create;
  await useWonder(f.message);
  assert.equal(f.actor.system.wonder.value, 1);
});

test("hidden chat content is not decorated or given a Wonder control", () => {
  const f = fixture();
  f.message.isContentVisible = false;
  decorateRollMessage(f.message, { classList: { add() { throw new Error("Hidden content was decorated"); } } });
});

test("chat presents readable dice and keeps mounted Wonder controls current after spending/refill", async () => {
  const f = fixture({ value: 1, mode: "advantage" });
  f.original.total = 13;
  f.original.dice[0].results = [{ result: 3, active: false }, { result: 9, active: true }];
  const mounted = [];
  const elements = [];
  globalThis.document = {
    createElement() { return { dataset: {}, addEventListener() {} }; },
    querySelectorAll() { return mounted; }
  };
  const formula = { textContent: "2d20kh1 + 4", after: node => elements.push(node) };
  const tooltip = { textContent: "2d20kh1" };
  const content = {
    querySelector: () => mounted[0],
    append: node => mounted.push(node)
  };
  const html = {
    classList: { add() {} },
    querySelector: selector => ({ ".dice-formula": formula, ".message-content": content, ".wb-dice-results": elements[0] })[selector],
    querySelectorAll: () => [tooltip]
  };
  decorateRollMessage(f.message, html);
  assert.equal(formula.textContent, "9 + 4 bonus = 13");
  assert.equal(elements[0].textContent, "Rolled 3 and 9 · kept 9 (higher)");
  assert.equal(tooltip.textContent, "2d20 · keep highest");
  assert.equal(mounted[0].disabled, false);
  const child = await useWonder(f.message);
  const childButton = { dataset: { messageId: child.id } };
  mounted.push(childButton);
  refreshWonderControls();
  assert.equal(mounted[0].textContent, "Wonder used");
  assert.equal(mounted[0].disabled, true);
  assert.equal(childButton.textContent, "No Wonder uses left");
  assert.equal(childButton.disabled, true);
  await restoreWonder(f.actor);
  refreshWonderControls();
  assert.equal(mounted[0].disabled, true);
  assert.equal(childButton.textContent, "Use Wonder");
  assert.equal(childButton.disabled, false);
  decorateRollMessage(f.message, html);
  assert.equal(elements.length, 1);
  assert.equal(mounted.length, 2);
});

test("combat initiative retains Foundry's roll and records exact combatant context", async () => {
  const f = fixture();
  foundry.documents.Combatant = class { getInitiativeRoll(formula) { return new f.Roll(formula, { mod: 2 }); } };
  const { CharacterCombatant } = await import("../module/character-combatant.mjs");
  const combatant = new CharacterCombatant();
  Object.assign(combatant, { actor: f.actor, parent: { id: "combat" }, id: "hero-turn" });
  const roll = combatant.getInitiativeRoll("1d20 + @mod");
  assert.equal(roll.data.mod, 2);
  assert.deepEqual(roll.options["worlds-beyond"], {
    kind: "initiative", label: "Initiative", actorUuid: "Actor.hero", combatId: "combat", combatantId: "hero-turn"
  });
});
