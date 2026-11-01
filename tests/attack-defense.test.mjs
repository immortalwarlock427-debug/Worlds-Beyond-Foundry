import { test } from "node:test";
import assert from "node:assert/strict";
import { incomingWeaponAttack } from "../module/defenses.mjs";
import { linkedDefense, defenseActors, promptAttackDefense, decorateAttackDefenses } from "../module/attack-defense.mjs";
import { promptBlock, promptDodge, promptParry, rollBlock, rollDodge, rollParry } from "../module/reaction-actions.mjs";
import { rollAttack } from "../module/attack-actions.mjs";
import { useWonder } from "../module/roll-actions.mjs";

const S = "worlds-beyond";
function fixture({ blind = false, whisper = [], natural = 16 } = {}) {
  const calls = { posts: [], updates: [], dialogs: [], templates: [], evaluations: [] };
  const actor = { uuid: "Scene.scene.Token.hero.Actor.hero", name: "Hero", isToken: true, type: "character", isOwner: true,
    flags: { defenseUses: {}, parryUses: {}, wonderUsed: {} },
    getFlag(scope, key) { return this.flags[key]; },
    system: { level: 5, stats: Object.fromEntries(["str", "dex", "agl", "vit", "int", "wis", "cha", "fth"].map(key => [key, { value: 21, effective: 21, mod: 4 }])),
      equipment: {}, reactions: { value: 6 }, ap: { value: 17 }, health: { damage: 8 }, wonder: { value: 2 } },
    async update(data) {
      calls.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split("."); let object = this;
        for (const key of parts.slice(0, -1)) object = object[key] ??= {};
        const key = parts.at(-1); if (key.startsWith("-=")) delete object[key.slice(2)]; else object[key] = value;
      }
      return this;
    }
  };
  actor.flags = { [S]: actor.flags }; actor.getFlag = (scope, key) => actor.flags[scope]?.[key];
  const weapon = { id: "dagger", name: "Dagger", type: "weapon", system: { family: "balanced", equipped: true, loading: 0, properties: { light: true }, signature: {} } };
  actor.items = new Map([[weapon.id, weapon]]);
  const attack = { actorUuid: "Actor.enemy", attackerName: "Enemy", overwhelmingForce: true,
    target: { actorUuid: actor.uuid, name: "Hero token", evasion: 12, armor: 4 },
    hands: [{ name: "Sword", hand: "main", hit: true, total: 20, natural }, { name: "Dagger", hand: "off", hit: true, total: 10, natural: 6 }] };
  const source = { messageId: "incoming", handIndex: 0 };
  const message = { id: "incoming", isContentVisible: true, whisper, blind, getFlag: () => attack };
  const messages = new Map([[message.id, message]]); Object.defineProperty(messages, "contents", { get: () => [...messages.values()] });
  let nextDie = 10;
  class Roll {
    static validate() { return true; }
    constructor(formula, data = {}) { this.formula = formula; this.data = data; }
    async evaluate(options) { calls.evaluations.push(options); this.total = nextDie + (this.data.mod ?? 0); this.dice = [{ faces: 20, total: nextDie, results: [{ result: nextDie, active: true }] }]; return this; }
    clone() { return new Roll(this.formula, this.data); }
    async render() { return "<div class='dice-roll'>roll</div>"; }
  }
  const ChatMessage = { getSpeaker: () => ({ scene: "scene", token: "hero" }), getSpeakerActor: () => actor,
    async create(data, options) {
      calls.posts.push({ data, options });
      const result = { id: `result${calls.posts.length}`, isContentVisible: true, whisper: [], blind: false, ...data,
        getFlag: (scope, key) => data.flags?.[scope]?.[key] };
      messages.set(result.id, result); return result;
    }
  };
  const DialogV2 = { async input(options) { calls.dialogs.push(options); return null; } };
  const handlebars = { async renderTemplate(path, data) { calls.templates.push({ path, data }); return "template"; } };
  globalThis.foundry = { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } },
    applications: { api: { DialogV2 }, handlebars }, utils: { fromUuidSync: uuid => uuid === actor.uuid ? actor : null } };
  const combat = { id: "combat", round: 1, started: true, combatants: [{ actor }] };
  globalThis.game = { user: { id: "player", character: actor, targets: [] }, actors: { contents: [actor] }, messages,
    settings: { get: () => "public" }, combat, combats: [combat] };
  globalThis.canvas = { tokens: { controlled: [{ actor }] } };
  return { actor, weapon, attack, message, source, calls, Roll, ChatMessage, DialogV2, handlebars, setDie: die => { nextDie = die; } };
}

test("incoming hand snapshots distinguish natural 20 from expanded crits, zero totals, misses and legacy cards", () => {
  const f = fixture({ natural: 18 });
  assert.equal(incomingWeaponAttack(f.attack, [], 0).natural20, false);
  f.attack.hands[0].natural = 20; assert.equal(incomingWeaponAttack(f.attack, [], 0).natural20, true);
  assert.equal(incomingWeaponAttack(f.attack, [], 1).total, 10);
  f.attack.hands[0].hit = false; assert.equal(incomingWeaponAttack(f.attack, [], 0), null);
  for (const index of [-1, 0.5, 9]) assert.equal(incomingWeaponAttack(f.attack, [], index), null);
  const legacy = incomingWeaponAttack({ hit: null }, [{ total: 0, dice: [{ faces: 20, total: 1 }] }]);
  assert.equal(legacy.total, 0); assert.equal(legacy.natural20, false);
  assert.equal(incomingWeaponAttack({ hit: true }, []), null);
});

test("new attacks retain target identity and original totals, naturals and STR milestone", async () => {
  const f = fixture(); f.actor.system.stats.str.effective = 28;
  game.user.targets = [{ name: "Token name", actor: f.actor, document: { uuid: "Scene.scene.Token.hero" } }];
  await rollAttack(f.actor, f.weapon, { stat: "dex" });
  const data = f.calls.posts[0].data.flags[S].attack;
  assert.equal(data.target.actorUuid, f.actor.uuid); assert.equal(data.target.tokenUuid, "Scene.scene.Token.hero");
  assert.equal(data.overwhelmingForce, true); assert.equal(data.hands[0].total, 14); assert.equal(data.hands[0].natural, 10);
});

test("defender candidates prefer the exact synthetic target, deduplicate and exclude unowned actors", () => {
  const f = fixture(); const world = { ...f.actor, uuid: "Actor.hero", isToken: false };
  game.actors.contents.push(world, { ...world, uuid: "Actor.no", isOwner: false });
  assert.deepEqual(defenseActors(f.attack.target).map(a => a.uuid), [f.actor.uuid, world.uuid]);
  assert.equal(defenseActors({ targetActorUuid: f.actor.uuid })[0], f.actor);
});

test("linked dialogs prefill incoming totals/ally/force and cancel without rolling or spending", async () => {
  const f = fixture();
  for (const prompt of [promptBlock, promptDodge, promptParry]) await prompt(f.actor, f.source);
  assert.equal(f.calls.templates[1].data.incoming.total, 20);
  assert.equal(f.calls.templates[2].data.incoming.overwhelmingForce, true);
  assert.equal(f.calls.templates[2].data.ally, false);
  f.attack.target.actorUuid = "Actor.ally"; await promptParry(f.actor, f.source);
  assert.equal(f.calls.templates.at(-1).data.ally, true);
  assert.equal(f.calls.updates.length, 0); assert.equal(f.calls.evaluations.length, 0);
});

test("attack entry point uses the defender, supports selection cancellation and rejects ally Dodge", async () => {
  const f = fixture(); await promptAttackDefense(f.message, 0, "parry");
  assert.equal(f.calls.templates[0].data.modifier, 4);
  game.actors.contents.push({ ...f.actor, uuid: "Actor.other", name: "Other" });
  await promptAttackDefense(f.message, 0, "block");
  assert.match(f.calls.templates.at(-1).path, /defender-dialog/);
  assert.equal(f.calls.posts.length, 0);
  f.DialogV2.input = async () => ({ actorUuid: "Actor.other" });
  await assert.rejects(promptAttackDefense(f.message, 0, "dodge"), /Dodge protects only/);
});

test("each spent defense is consumed once per defender and per hand; different defenses and practice remain available", async () => {
  const f = fixture();
  await rollDodge(f.actor, { source: f.source, target: 20, spendReaction: true });
  await assert.rejects(rollDodge(f.actor, { source: f.source, spendReaction: true }), /already used/);
  await rollBlock(f.actor, { source: f.source, spendReaction: true });
  await rollDodge(f.actor, { source: { ...f.source, handIndex: 1 }, spendReaction: true });
  await rollDodge(f.actor, { source: f.source });
  assert.equal(f.actor.system.reactions.value, 3);
  assert.deepEqual(f.actor.getFlag(S, "defenseUses"), { incoming_0: { dodge: true, block: true }, incoming_1: { dodge: true } });
  assert.equal(f.actor.system.ap.value, 17); assert.equal(f.actor.system.health.damage, 8); assert.equal(f.actor.system.wonder.value, 2);
});

test("rapid linked clicks consume one use, and a final-reaction race cannot spend twice", async () => {
  const f = fixture();
  const results = await Promise.allSettled([1, 2].map(() => rollBlock(f.actor, { source: f.source, spendReaction: true })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(f.actor.system.reactions.value, 5);
  f.actor.system.reactions.value = 1;
  const race = await Promise.allSettled([rollDodge(f.actor, { source: f.source, spendReaction: true }), rollBlock(f.actor, { source: { ...f.source, handIndex: 1 }, spendReaction: true })]);
  assert.equal(race.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.actor.system.reactions.value, 0);
});

test("linked reset clears only that defense's mark without refunding or rolling", async () => {
  const f = fixture(); await rollDodge(f.actor, { source: f.source, spendReaction: true });
  await rollBlock(f.actor, { source: f.source, spendReaction: true });
  await promptDodge(f.actor, f.source);
  assert.equal(f.calls.templates.at(-1).data.spendReaction, false);
  await f.calls.dialogs.at(-1).buttons[0].callback();
  assert.deepEqual(f.actor.getFlag(S, "defenseUses").incoming_0, { block: true });
  assert.equal(f.actor.system.reactions.value, 4); assert.equal(f.calls.posts.length, 2);
});

test("linked Parry retains round use separately; both flags and reactions refund on post failure", async () => {
  const f = fixture(); f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(rollParry(f.actor, { source: f.source, target: 20, spendReaction: true }), /offline/);
  assert.equal(f.actor.system.reactions.value, 6); assert.equal(f.actor.getFlag(S, "parryUses").combat, undefined);
  assert.equal(f.actor.getFlag(S, "defenseUses").incoming_0?.parry, undefined);
});

test("failed linked-use update refunds reactions, and hidden/deleted sources cannot spend", async () => {
  const f = fixture(); const update = f.actor.update;
  f.actor.update = function(data) { if (Object.keys(data).some(key => key.includes("defenseUses"))) return null; return update.call(this, data); };
  await assert.rejects(rollBlock(f.actor, { source: f.source, spendReaction: true }), /cancelled/);
  assert.equal(f.actor.system.reactions.value, 6); assert.equal(f.calls.posts.length, 0);
  f.message.isContentVisible = false;
  await assert.rejects(rollDodge(f.actor, { source: f.source, spendReaction: true }), /no longer available/);
  game.messages.delete(f.message.id);
  await assert.rejects(rollBlock(f.actor, { source: f.source, spendReaction: true }), /no longer available/);
});

test("linked defenses retain exact source audience across public/GM/blind/self messages and changed mode", async () => {
  for (const audience of [{ whisper: [], blind: false }, { whisper: ["gm"], blind: false }, { whisper: ["gm"], blind: true }, { whisper: ["player"], blind: false }]) {
    for (const roll of [rollBlock, rollDodge, rollParry]) {
      const f = fixture(audience); await roll(f.actor, { source: f.source });
      assert.deepEqual(f.calls.posts[0].data.whisper, audience.whisper); assert.equal(f.calls.posts[0].data.blind, audience.blind);
      assert.equal(f.calls.posts[0].options, undefined); assert.equal(f.calls.evaluations[0].allowInteractive, !audience.blind);
    }
  }
});

test("a whispered attack's original author remains in non-blind reply audiences without revealing blind results", async () => {
  const f = fixture({ whisper: ["gm"] }); f.message.author = { id: "attacker" };
  await rollBlock(f.actor, { source: f.source });
  assert.deepEqual(f.calls.posts[0].data.whisper, ["gm", "attacker"]);
  assert.deepEqual(f.message.whisper, ["gm"]);
  f.message.blind = true; await rollBlock(f.actor, { source: f.source });
  assert.deepEqual(f.calls.posts[1].data.whisper, ["gm"]);
});

test("Wonder keeps incoming attack/hand and audience without a second reaction or linked use", async () => {
  const f = fixture({ whisper: ["gm"] }); f.actor.system.stats.fth.value = 18;
  const message = await rollDodge(f.actor, { source: f.source, target: 20, spendReaction: true });
  f.setDie(20); await useWonder(message);
  const reroll = f.calls.posts.at(-1).data;
  assert.deepEqual(reroll.flags[S].check.defense.incoming.source, f.source);
  assert.deepEqual(reroll.whisper, ["gm"]); assert.equal(f.actor.system.reactions.value, 5);
  assert.deepEqual(f.actor.getFlag(S, "defenseUses").incoming_0, { dodge: true }); assert.equal(f.actor.system.wonder.value, 1);
});

test("defender controls mount for non-attacker owners, stay separate per hand and never inspect hidden cards", () => {
  const f = fixture({ natural: 20 });
  class Element {
    constructor() { this.children = []; } setAttribute() {} addEventListener() {} append(child) { this.children.push(child); }
  }
  globalThis.document = { createElement: () => new Element() };
  const sections = [new Element(), new Element()];
  const card = { querySelector(selector) { if (selector === ".wb-defense-actions") return sections.some(s => s.children.length) ? {} : null; return sections[Number(/data-hand="(\d+)"/.exec(selector)?.[1])]; } };
  const html = { querySelector: () => card };
  decorateAttackDefenses(f.message, html); decorateAttackDefenses(f.message, html);
  assert.equal(sections[0].children.length, 1); assert.equal(sections[1].children.length, 1);
  assert.equal(sections[0].children[0].children[1].disabled, true); assert.equal(sections[1].children[0].children[1].disabled, false);
  decorateAttackDefenses({ isContentVisible: false }, { querySelector() { throw new Error("Hidden inspected"); } });
});
