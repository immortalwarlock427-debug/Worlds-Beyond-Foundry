import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { abstract: { TypeDataModel: class {} }, applications: { api: { DocumentSheetV2: class {}, HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } } };
const { rollAttack, reloadWeapon, rollDamage, decorateAttackMessage } = await import("../module/attack-actions.mjs");
const { useConsumable, applyConsumableHealing, decorateConsumableMessage } = await import("../module/equipment.mjs");
const { useAbility } = await import("../module/abilities.mjs");
const { effectContext } = await import("../module/effects-core.mjs");
const { returnToBase } = await import("../module/forms.mjs");

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
    async create(data, options) {
      calls.posts.push({ data, options });
      return { id: "posted", isContentVisible: true, ...data, getFlag: (scope, key) => data.flags?.[scope]?.[key],
        async setFlag(scope, key, value) { data.flags[scope][key] = structuredClone(value); return this; } };
    }
  };
  Object.assign(foundry, { dice: { Roll }, documents: { ChatMessage: { implementation: ChatMessage } }, utils: { fromUuid: async () => actor, fromUuidSync: () => actor } });
  globalThis.game = { settings: { get: () => mode }, user: { targets: [] }, combats: [{ started: true, combatants: [{ actor }] }] };
  calls.info = []; globalThis.ui = { notifications: { error() {}, warn() {}, info(message) { calls.info.push(message); } } };
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

test("ordinary attacks still spend AP without spending reactions", async () => {
  const f = fixture(); f.actor.system.reactions = { value: 2 };
  await rollAttack(f.actor, f.weapon, { spendAp: true, mode: "ranged", stat: "dex" }, { name: "Swift", evasion: 0 });
  assert.equal(f.actor.system.ap.value, 5); assert.equal(f.actor.system.reactions.value, 2);
  assert.equal(f.calls.posts[0].data.flags["worlds-beyond"].attack.hands[0].hit, true);
  assert.doesNotMatch(f.calls.posts[0].data.content, /Opportunity|reaction spent/);
});

test("potions use bounded DEX-adjusted AP, spend eligible Command first, and refund both AP and quantity on failure", async () => {
  const f = fixture(); f.potion.system.kind = "potion"; f.actor.system.stats.dex.mod = 99;
  f.actor.system.ap.value = 0; f.actor.system.command = { value: 3 }; game.combats[0].combatant = { actor: f.actor };
  f.ChatMessage.create = async () => { throw new Error("offline"); };
  await assert.rejects(useConsumable(f.actor, f.potion.id), /offline/);
  assert.equal(f.actor.system.command.value, 3); assert.equal(f.actor.system.ap.value, 0); assert.equal(f.potion.system.quantity, 2);
  f.ChatMessage.create = async (data, options) => { f.calls.posts.push({ data, options }); return data; };
  await useConsumable(f.actor, f.potion.id);
  assert.equal(f.actor.system.command.value, 0); assert.equal(f.potion.system.quantity, 1); assert.match(f.calls.posts[0].data.content, /3 AP spent/);
  await assert.rejects(useConsumable(f.actor, f.potion.id), /Not enough AP/); assert.equal(f.potion.system.quantity, 1);
  game.combats = []; await useConsumable(f.actor, f.potion.id); assert.equal(f.potion.system.quantity, 0);
});

test("full health prevents healing consumables before dice, item or AP spending, including manual overheal", async () => {
  const f = fixture(); f.potion.system.kind = "potion";
  for (const damage of [0, -3]) {
    f.actor.system.health.damage = damage; await useConsumable(f.actor, f.potion.id);
    assert.equal(f.potion.system.quantity, 2); assert.equal(f.actor.system.ap.value, 15); assert.equal(f.actor.system.health.damage, damage);
  }
  assert.equal(f.calls.posts.length, 0); assert.equal(f.calls.evaluations.length, 0);
  assert.ok(f.calls.info.every(message => /You are at full health/.test(message)));
});

test("reaching full health before Apply refunds the original item and both AP portions once", async () => {
  const f = fixture(); f.potion.system.kind = "potion"; f.actor.system.ap.value = 2; f.actor.system.command = { value: 3 };
  game.combats[0].combatant = { actor: f.actor };
  const message = await useConsumable(f.actor, f.potion.id);
  assert.equal(f.actor.system.ap.value, 0); assert.equal(f.actor.system.command.value, 0); assert.equal(f.potion.system.quantity, 1);
  f.actor.system.health.damage = 0;
  await Promise.all([applyConsumableHealing(message), applyConsumableHealing(message)]);
  assert.equal(f.actor.system.ap.value, 2); assert.equal(f.actor.system.command.value, 3); assert.equal(f.potion.system.quantity, 2);
  assert.equal(message.getFlag("worlds-beyond", "consumable").refunded, true);
  assert.match(f.calls.info[0], /full health.*refunded/);
});

test("a cancelled full-health refund restores the receipt and item count so retry refunds only once", async () => {
  const f = fixture(); f.potion.system.kind = "potion";
  const message = await useConsumable(f.actor, f.potion.id); f.actor.system.health.damage = 0;
  const update = f.actor.update; f.actor.update = async () => undefined;
  await assert.rejects(applyConsumableHealing(message), /cancelled/);
  assert.equal(f.potion.system.quantity, 1); assert.equal(f.actor.system.ap.value, 10);
  assert.equal(message.getFlag("worlds-beyond", "consumable").refunded, false);
  f.actor.update = update; await applyConsumableHealing(message);
  assert.equal(f.potion.system.quantity, 2); assert.equal(f.actor.system.ap.value, 15);
});

test("partially needed healing applies only the deficit and keeps the paid cost instead of refunding after success", async () => {
  const f = fixture(); f.potion.system.kind = "potion"; f.actor.system.health.damage = 3;
  const message = await useConsumable(f.actor, f.potion.id);
  await applyConsumableHealing(message); await applyConsumableHealing(message);
  assert.equal(f.actor.system.health.damage, 0); assert.equal(f.potion.system.quantity, 1); assert.equal(f.actor.system.ap.value, 10);
  const data = message.getFlag("worlds-beyond", "consumable"); assert.equal(data.healed, 3); assert.equal(data.applied, true); assert.equal(data.refunded, false);
});

function bonusAbility(f) {
  const item = { id: "buff", name: "Dexterity buff", type: "ability", effects: new Map([["bonus", { id: "bonus", name: "DEX", system: { changes: [] } }]]),
    system: { kind: "active", effectsActive: false, apCost: 5, apDiscountStat: "", resourceId: "mana", resourceCost: 10, resourceUnit: "percent", uses: { max: 2, spent: 0 }, cooldown: { rounds: 2, remaining: 0 } },
    async update(data) { for (const [key, value] of Object.entries(data)) { const parts = key.split('.').slice(1); const last = parts.pop(); const parent = parts.reduce((object, field) => object[field], this.system); parent[last] = value; } return this; }
  };
  f.actor.items.set(item.id, item); f.actor.system.mana = { enabled: true, max: 125, value: 125, spent: 0, min: 0 };
  return item;
}
test("ability Use pays exact percent resources and one use, enables bonuses; rapid Use does not double-pay, End is free", async () => {
  const f = fixture(), item = bonusAbility(f);
  await Promise.all([useAbility(f.actor, item.id), useAbility(f.actor, item.id)]);
  assert.equal(f.actor.system.ap.value, 10); assert.equal(f.actor.system.mana.spent, 12.5);
  assert.equal(item.system.uses.spent, 1); assert.equal(item.system.cooldown.remaining, 2); assert.equal(item.system.effectsActive, true);
  assert.equal(f.calls.posts.length, 1);
  await useAbility(f.actor, item.id, { end: true }); assert.equal(item.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 10);
  await assert.rejects(useAbility(f.actor, item.id), /cooldown/);
});

test("ability Use pays AP without an encounter and insufficient AP leaves all costs and bonuses untouched", async () => {
  const f = fixture(), item = bonusAbility(f); game.combats = [];
  f.actor.system.ap.value = 4;
  await assert.rejects(useAbility(f.actor, item.id), /Not enough AP/);
  assert.equal(f.actor.system.ap.value, 4); assert.equal(f.actor.system.mana.spent, 0); assert.equal(item.system.uses.spent, 0); assert.equal(item.system.effectsActive, false);
  f.actor.system.ap.value = 5; await useAbility(f.actor, item.id);
  assert.equal(f.actor.system.ap.value, 0); assert.equal(f.actor.system.mana.spent, 12.5); assert.equal(item.system.effectsActive, true);
});

test("ability payments spend Command first on the actor's turn and explain pending AP on other turns", async () => {
  const f = fixture(), item = bonusAbility(f); f.actor.system.ap.value = 1; f.actor.system.command = { value: 4 };
  await assert.rejects(useAbility(f.actor, item.id), /Command AP can only be spent on your turn/);
  assert.equal(f.actor.system.ap.value, 1); assert.equal(f.actor.system.command.value, 4); assert.equal(item.system.effectsActive, false);
  game.combats[0].combatant = { actor: f.actor }; await useAbility(f.actor, item.id);
  assert.equal(f.actor.system.ap.value, 0); assert.equal(f.actor.system.command.value, 0); assert.equal(item.system.effectsActive, true);
});
test("Status shows an ability once only while its bonuses are active, and keeps disabled bonus definitions hidden", async () => {
  const f = fixture(), item = bonusAbility(f); item.name = "Power"; item.documentName = "Item"; item.uuid = "Actor.hero.Item.buff";
  for (const id of ["str", "dex", "off"]) item.effects.set(id, { id, uuid: `${item.uuid}.ActiveEffect.${id}`, name: id, parent: item, disabled: id === "off",
    flags: { "worlds-beyond": { managed: true, itemBound: true } }, system: { changes: [{ key: `system.stats.${id}.value`, value: 2, type: "add", phase: "initial" }] } });
  item.effects.delete("bonus"); f.actor.allApplicableEffects = () => item.effects.values();
  assert.deepEqual(effectContext(f.actor).statuses, []);
  await useAbility(f.actor, item.id);
  const rows = effectContext(f.actor).statuses;
  assert.equal(rows.length, 1); assert.equal(rows[0].name, "Power"); assert.equal(rows[0].abilityId, item.id); assert.equal(rows[0].canEnd, true);
  assert.match(rows[0].summary, /Strength score \+2.*Dexterity score \+2/); assert.doesNotMatch(rows[0].summary, /off/);
  await useAbility(f.actor, item.id, { end: true }); assert.deepEqual(effectContext(f.actor).statuses, []);
  item.system.kind = "passive";
  assert.equal(effectContext(f.actor).statuses[0].canEnd, false);
  f.actor.allApplicableEffects = () => []; assert.deepEqual(effectContext(f.actor).statuses, []);
});

test("form abilities switch the previous item/saved form off, refund a failed switch, and return to Base freely", async () => {
  const f = fixture(), item = bonusAbility(f); item.system.kind = "form";
  const old = { id: "old", type: "ability", system: { kind: "form", effectsActive: true }, async update(data) { this.system.effectsActive = data["system.effectsActive"]; return this; } };
  const saved = { id: "saved", disabled: false, flags: { "worlds-beyond": { managed: true, kind: "form" } }, async update(data) { this.disabled = data.disabled; return this; } };
  f.actor.items.set(old.id, old); f.actor.effects = new Map([[saved.id, saved]]); f.actor.type = "character";
  const create = f.ChatMessage.create; f.ChatMessage.create = async () => undefined;
  await assert.rejects(useAbility(f.actor, item.id), /not posted/);
  assert.equal(old.system.effectsActive, true); assert.equal(saved.disabled, false); assert.equal(item.system.effectsActive, false);
  assert.equal(f.actor.system.ap.value, 15); assert.equal(f.actor.system.mana.spent, 0);
  f.ChatMessage.create = create; await useAbility(f.actor, item.id);
  assert.equal(old.system.effectsActive, false); assert.equal(saved.disabled, true); assert.equal(item.system.effectsActive, true);
  const ap = f.actor.system.ap.value; await returnToBase(f.actor);
  assert.equal(item.system.effectsActive, false); assert.equal(f.actor.system.ap.value, ap);
});
test("failed ability posting refunds AP/resource/uses/cooldown/activation; missing pools and empty uses spend nothing", async () => {
  const f = fixture(), item = bonusAbility(f); f.ChatMessage.create = async () => undefined;
  await assert.rejects(useAbility(f.actor, item.id), /not posted/);
  assert.equal(f.actor.system.ap.value, 15); assert.equal(f.actor.system.mana.spent, 0);
  assert.equal(item.system.uses.spent, 0); assert.equal(item.system.cooldown.remaining, 0); assert.equal(item.system.effectsActive, false);
  item.system.resourceId = "resource00000001";
  await assert.rejects(useAbility(f.actor, item.id), /no longer exists/); assert.equal(f.actor.system.ap.value, 15);
  item.system.uses.spent = 2;
  await assert.rejects(useAbility(f.actor, item.id), /No ability uses/); assert.equal(f.calls.posts.length, 0);
});

test("an ability without bonuses or trackers pays and posts without an empty native update", async () => {
  const f = fixture(), item = bonusAbility(f);
  item.effects.clear(); item.system.uses.max = null; item.system.cooldown.rounds = null;
  item.update = async () => { throw new Error("Unexpected empty update"); };
  await useAbility(f.actor, item.id);
  assert.equal(f.actor.system.ap.value, 10); assert.equal(f.actor.system.mana.spent, 12.5);
  assert.equal(f.calls.posts.length, 1); assert.equal(item.system.effectsActive, false);
});

test("reaction abilities spend a reaction in combat and restore it if posting fails", async () => {
  const f = fixture(), item = bonusAbility(f); item.system.kind = "reaction"; f.actor.system.reactions = { value: 1 };
  f.ChatMessage.create = async () => undefined;
  await assert.rejects(useAbility(f.actor, item.id), /not posted/); assert.equal(f.actor.system.reactions.value, 1);
  f.actor.system.reactions.value = 0;
  await assert.rejects(useAbility(f.actor, item.id), /No reactions/); assert.equal(f.actor.system.ap.value, 15);
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
