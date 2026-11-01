import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { abstract: { TypeDataModel: class {} }, applications: { api: { HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } } };
const { rollAttack, reloadWeapon, rollDamage, decorateAttackMessage } = await import("../module/attack-actions.mjs");
const { useConsumable, applyConsumableHealing, decorateConsumableMessage } = await import("../module/equipment.mjs");

function fixture(mode = "public") {
  const calls = { evaluations: [], posts: [], flags: [], updates: [] };
  const item = (id, type, system) => ({ id, name: id, type, system, async update(data) {
    for (const [key, value] of Object.entries(data)) this.system[key.slice(7)] = value;
    return this;
  } });
  const weapon = item("gun", "weapon", { equipped: true, loading: 6, shots: 2, family: "none", ranged: true, damage: "1d6", damageType: "Piercing", properties: {}, signature: {} });
  const potion = item("potion", "consumable", { quantity: 2, healingDice: "1d6", description: "" });
  const actor = { uuid: "Actor.hero", isOwner: true, items: new Map([[weapon.id, weapon], [potion.id, potion]]), system: {
    level: 1, ap: { value: 15 }, health: { damage: 10 }, equipment: {}, stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { value: 12, effective: 12, mod: 0 }]))
  }, async update(data) {
    calls.updates.push(data);
    for (const [key, value] of Object.entries(data)) { const [, pool, field] = key.split("."); this.system[pool][field] = value; }
    return this;
  } };
  class Roll {
    static validate() { return true; }
    constructor(formula, data = {}) { this.formula = formula; this.data = data; }
    async evaluate(options) {
      calls.evaluations.push(options); this.total = 10;
      this.dice = [{ faces: this.formula.includes("d20") ? 20 : 6, total: 10, results: [{ result: 10, active: true }] }]; return this;
    }
    async render() { return "<div class='dice-roll'>10</div>"; }
  }
  const ChatMessage = {
    getSpeaker: () => ({ actor: "hero" }),
    async create(data, options) { calls.posts.push({ data, options }); return { id: "posted", ...data }; }
  };
  Object.assign(foundry, { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } }, utils: { fromUuid: async () => actor, fromUuidSync: () => actor } });
  globalThis.game = { settings: { get: () => mode }, user: { targets: [] }, combats: [{ started: true, combatants: [{ actor }] }] };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  const flags = {
    attack: { actorUuid: actor.uuid, hands: [{ hand: "main", itemId: weapon.id, mod: 0, stat: "dex", hit: true, critical: false, damageRolled: false }] },
    consumable: { actorUuid: actor.uuid, amount: 6, applied: false }
  };
  const message = {
    id: "source", uuid: "ChatMessage.source", isContentVisible: true, speaker: { actor: "hero" }, whisper: ["gm"], blind: true,
    getFlag: (scope, key) => flags[key],
    async setFlag(scope, key, data) { calls.flags.push(structuredClone(data)); Object.assign(flags[key], structuredClone(data)); return this; }
  };
  return { actor, weapon, potion, calls, message, flags, Roll, ChatMessage };
}

test("attack/reload/consumable cards pass all four v14 visibility modes; blind dice disable interaction", async () => {
  for (const mode of ["public", "gm", "blind", "self"]) {
    const f = fixture(mode);
    await rollAttack(f.actor, f.weapon, { mode: "ranged", stat: "dex", spendAp: true });
    await reloadWeapon(f.actor, f.weapon.id);
    await useConsumable(f.actor, f.potion.id);
    assert.deepEqual(f.calls.posts.map(post => post.options), Array(3).fill({ messageMode: mode }));
    assert.ok(f.calls.evaluations.every(options => options.allowInteractive === (mode !== "blind")));
  }
});

test("failed attack posting restores AP and loaded shots; cancelled spending posts nothing", async () => {
  const f = fixture();
  f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(rollAttack(f.actor, f.weapon, { spendAp: true }), /offline/);
  assert.equal(f.actor.system.ap.value, 15);
  assert.equal(f.weapon.system.shots, 2);
  f.actor.update = async () => undefined;
  await assert.rejects(rollAttack(f.actor, f.weapon, { spendAp: true }), /cancelled/);
  assert.equal(f.weapon.system.shots, 2);
});

test("reload and consumable posting failures restore their resources", async () => {
  const f = fixture();
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(reloadWeapon(f.actor, f.weapon.id), /not posted/);
  assert.equal(f.actor.system.ap.value, 15);
  assert.equal(f.weapon.system.shots, 2);
  await assert.rejects(useConsumable(f.actor, f.potion.id), /not posted/);
  assert.equal(f.potion.system.quantity, 2);
});

test("damage evaluation/render/post failures allow retry; success keeps source audience even if mode changed", async () => {
  const f = fixture("public");
  const evaluate = f.Roll.prototype.evaluate;
  f.Roll.prototype.evaluate = async () => { throw new Error("dice failed"); };
  await assert.rejects(rollDamage(f.message, 0, false), /dice failed/);
  assert.equal(f.flags.attack.hands[0].damageRolled, false);
  f.Roll.prototype.evaluate = evaluate;
  const render = f.Roll.prototype.render;
  f.Roll.prototype.render = async () => { throw new Error("render failed"); };
  await assert.rejects(rollDamage(f.message, 0, false), /render failed/);
  assert.equal(f.flags.attack.hands[0].damageRolled, false);
  f.Roll.prototype.render = render;
  const create = f.ChatMessage.create;
  f.ChatMessage.create = async () => { throw new Error("post failed"); };
  await assert.rejects(rollDamage(f.message, 0, false), /post failed/);
  assert.equal(f.flags.attack.hands[0].damageRolled, false);
  f.ChatMessage.create = create;
  await rollDamage(f.message, 0, false);
  assert.equal(f.flags.attack.hands[0].damageRolled, true);
  assert.deepEqual(f.calls.posts[0].data.whisper, ["gm"]);
  assert.equal(f.calls.posts[0].data.blind, true);
  assert.equal(f.calls.posts[0].options, undefined);
  assert.equal(f.calls.evaluations.at(-1).allowInteractive, false);
});

test("rapid damage clicks post once and two attacks cannot both spend the final AP", async () => {
  let f = fixture();
  await Promise.all([rollDamage(f.message, 0, false), rollDamage(f.message, 0, false)]);
  assert.equal(f.calls.posts.length, 1);
  f = fixture(); f.actor.system.ap.value = 10;
  const result = await Promise.allSettled([rollAttack(f.actor, f.weapon, { spendAp: true }), rollAttack(f.actor, f.weapon, { spendAp: true })]);
  assert.equal(result[0].status, "fulfilled"); assert.equal(result[1].status, "rejected");
  assert.equal(f.calls.posts.length, 1);
  assert.equal(f.actor.system.ap.value, 0);
});

test("failed healing updates clear the applied flag and can be retried once", async () => {
  const f = fixture(); const update = f.actor.update;
  f.actor.update = async () => { throw new Error("update failed"); };
  await assert.rejects(applyConsumableHealing(f.message), /update failed/);
  assert.equal(f.flags.consumable.applied, false);
  f.actor.update = update;
  await Promise.all([applyConsumableHealing(f.message), applyConsumableHealing(f.message)]);
  assert.equal(f.actor.system.health.damage, 4);
  assert.equal(f.flags.consumable.applied, true);
});

test("hidden results expose no actions and cannot roll damage or apply healing", async () => {
  const f = fixture(); f.message.isContentVisible = false;
  const html = { querySelector() { throw new Error("Hidden markup was inspected"); } };
  decorateAttackMessage(f.message, html); decorateConsumableMessage(f.message, html);
  await rollDamage(f.message, 0, false); await applyConsumableHealing(f.message);
  assert.equal(f.calls.flags.length, 0); assert.equal(f.calls.posts.length, 0);
});

test("failed recovery reports the manual correction instead of claiming resources were restored", async () => {
  const f = fixture(); const update = f.actor.update; let spent = false;
  f.actor.update = async data => { if (spent) throw new Error("refund failed"); spent = true; return update.call(f.actor, data); };
  f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(rollAttack(f.actor, f.weapon, { spendAp: true }), /Recovery also failed; check AP/);
});
