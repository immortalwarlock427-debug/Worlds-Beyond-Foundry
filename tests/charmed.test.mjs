import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLinkedCharmer,
  interactionActor,
  charmBlocksTarget,
  requireCharmedTargets,
  charmInteractionAdvantage,
  interactionChoices,
  registerCharmed
} from "../module/charmed.mjs";
import { defaultCheckMode, actorConditionRoll, bindConditionCheck } from "../module/condition-rolls.mjs";
import { rollAttack, promptAttack } from "../module/attack-actions.mjs";
import { rollAbilityStrike } from "../module/ability-strikes.mjs";
import { confirmAreaTargets } from "../module/area-targeting.mjs";
import { rollStatCheck, useWonder } from "../module/roll-actions.mjs";

function fixture() {
  const calls = { posts: [], updates: [], rolls: [], dialogs: [], renders: [] },
    settings = {},
    docs = new Map();
  const actor = id => ({
    documentName: "Actor",
    uuid: `Actor.${id}`,
    id,
    name: id,
    type: "character",
    isOwner: true,
    statuses: new Set(),
    effects: [],
    items: new Map(),
    flags: {},
    testUserPermission: () => true,
    system: {
      level: 5,
      exhaustion: 0,
      equipment: {},
      ap: { value: 30 },
      command: { value: 3 },
      reactions: { value: 1 },
      wonder: { value: 2 },
      stats: Object.fromEntries(
        ["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { mod: 0, value: 12, effective: 12 }])
      )
    },
    getFlag(s, k) {
      return this.flags[s]?.[k];
    },
    async update(data) {
      calls.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split("."),
          last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), this)[last] = value;
      }
      return this;
    }
  });
  const hero = actor("hero"),
    charmer = actor("charmer"),
    other = actor("other");
  for (const a of [hero, charmer, other]) docs.set(a.uuid, a);
  const token = (id, a) => {
    const doc = {
      documentName: "Token",
      id,
      uuid: `Scene.map.Token.${id}`,
      actor: a,
      name: a.name,
      parent: { id: "map", grid: { isHexagonal: false, size: 100, distance: 5 } },
      hidden: false,
      object: { visible: true }
    };
    docs.set(doc.uuid, doc);
    return doc;
  };
  const source = token("source", charmer),
    victim = token("victim", hero);
  const charm = (a, uuid) => {
    a.statuses.add("charmed");
    const e = {
      statuses: new Set(["charmed"]),
      flags: { "worlds-beyond": { conditionSources: { charmed: { uuid, name: "Saved label" } } } }
    };
    a.effects.push(e);
    return e;
  };
  const effect = charm(hero, source.uuid);
  const target = { name: charmer.name, actorUuid: charmer.uuid, tokenUuid: source.uuid, evasion: 12 };
  const weapon = {
    id: "gun",
    name: "Gun",
    type: "weapon",
    system: {
      equipped: true,
      family: "none",
      ranged: true,
      loading: 6,
      shots: 3,
      damage: "1d6",
      damageType: "Piercing",
      properties: {},
      signature: {}
    },
    async update(data) {
      calls.updates.push(data);
      for (const [key, value] of Object.entries(data)) this.system[key.slice(7)] = value;
      return this;
    }
  };
  hero.items.set(weapon.id, weapon);
  const ability = (mode = "attack") => ({
    id: "ability",
    type: "ability",
    name: "Ability",
    system: { kind: "active", apDiscountStat: "int", targeting: { mode, stat: "int", damage: "1d6", area: {}, visual: {} } }
  });
  const messages = new Map();
  Object.defineProperty(messages, "contents", { get: () => [...messages.values()] });
  const post = async data => {
    const m = {
      id: `card${calls.posts.length}`,
      isContentVisible: true,
      whisper: [],
      blind: false,
      ...data,
      getFlag: (s, k) => data.flags?.[s]?.[k]
    };
    calls.posts.push(m);
    messages.set(m.id, m);
    return m;
  };
  globalThis.game = {
    user: { id: "owner", isGM: true, targets: new Set() },
    actors: [hero, charmer, other],
    combats: [],
    messages,
    settings: {
      get: (_s, k) => (k === "messageMode" ? "public" : settings[k]),
      register: (_s, k, d) => {
        calls.setting = { key: k, ...d };
      }
    },
    socket: { emit() {} },
    users: { activeGM: { id: "gm" } }
  };
  globalThis.canvas = { scene: { id: "map", tokens: [source, victim] } };
  globalThis.foundry = {
    utils: { fromUuidSync: uuid => docs.get(uuid) },
    dice: {
      Roll: class {
        static validate() {
          return true;
        }
        constructor(formula, data = {}) {
          this.formula = formula;
          this.data = data;
          this.dice = [{ faces: 20, total: 10, results: [{ result: 10, active: true }] }];
        }
        clone() {
          return new this.constructor(this.formula, this.data);
        }
        async evaluate() {
          calls.rolls.push(this.formula);
          this.total = 10;
          return this;
        }
        async render() {
          return "dice";
        }
        async toMessage(data) {
          return post({ ...data, rolls: [this] });
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: ({ actor }) => ({ actor: actor.id }),
          getSpeakerActor: speaker => docs.get(`Actor.${speaker.actor}`),
          create: post
        }
      }
    },
    applications: {
      handlebars: {
        renderTemplate: async (path, data) => {
          calls.renders.push({ path, data });
          return "card";
        }
      },
      api: {
        DialogV2: {
          input: async data => {
            calls.dialogs.push(data);
            return calls.form ?? null;
          }
        }
      }
    }
  };
  globalThis.ui = { notifications: { warn() {} } };
  return { hero, charmer, other, source, victim, target, effect, weapon, ability, charm, token, docs, calls, settings };
}

test("Charmed targets the resolved charmer identity, not a saved name or every creature", () => {
  const f = fixture();
  assert.equal(isLinkedCharmer(f.hero, f.charmer), true);
  assert.equal(charmBlocksTarget(f.hero, f.target), true);
  f.effect.flags["worlds-beyond"].conditionSources.charmed.name = "other";
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: f.other.uuid }), false);
  f.effect.flags["worlds-beyond"].conditionSources.charmed.uuid = f.charmer.uuid;
  assert.equal(charmBlocksTarget(f.hero, f.target), true);
  assert.equal(charmBlocksTarget(f.charmer, { actorUuid: f.hero.uuid }), false, "the charmer can still attack the charmed creature");
});

test("exact synthetic actors are independent; linked copies share a creature", () => {
  const f = fixture(),
    synthetic = { ...f.charmer, uuid: "Scene.map.Token.copy.Actor.charmer" };
  const copy = f.token("copy", synthetic);
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: synthetic.uuid, tokenUuid: copy.uuid }), false);
  f.effect.flags["worlds-beyond"].conditionSources.charmed.uuid = copy.uuid;
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: synthetic.uuid, tokenUuid: copy.uuid }), true);
  assert.equal(charmBlocksTarget(f.hero, f.target), false);
  copy.actor = f.charmer;
  assert.equal(charmBlocksTarget(f.hero, f.target), true);
});

test("deleted/unassigned links and deleted exact targets remain manual without world-actor fallback", () => {
  const f = fixture();
  f.docs.delete(f.source.uuid);
  assert.equal(charmBlocksTarget(f.hero, f.target), false);
  assert.equal(interactionActor(f.target), null);
  f.effect.flags["worlds-beyond"].conditionSources.charmed.uuid = f.charmer.uuid;
  assert.equal(charmBlocksTarget(f.hero, f.target), false);
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: f.charmer.uuid }), true);
  f.effect.flags = {};
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: f.charmer.uuid }), false);
});

test("disabled, suppressed and expired sources do not block; multiple live sources remain independent", () => {
  const f = fixture();
  for (const key of ["disabled", "isSuppressed"]) {
    f.effect[key] = true;
    assert.equal(charmBlocksTarget(f.hero, f.target), false);
    f.effect[key] = false;
  }
  f.effect.duration = { expired: true };
  assert.equal(charmBlocksTarget(f.hero, f.target), false);
  f.charm(f.hero, f.other.uuid);
  assert.equal(charmBlocksTarget(f.hero, { actorUuid: f.other.uuid }), true);
  f.effect.duration = {};
  assert.equal(charmBlocksTarget(f.hero, f.target), true);
});

test("healing and per-action/world rulings bypass the harmful restriction without changing source flags", () => {
  const f = fixture(),
    flags = structuredClone(f.effect.flags);
  for (const options of [{ harmful: false }, { ignoreCharm: true }]) assert.equal(charmBlocksTarget(f.hero, f.target, options), false);
  f.settings.automateCharmed = false;
  assert.equal(charmBlocksTarget(f.hero, f.target), false);
  assert.deepEqual(f.effect.flags, flags);
  registerCharmed();
  assert.equal(f.calls.setting.default, true);
  assert.equal(f.calls.setting.key, "automateCharmed");
});

test("weapon/opportunity rejection precedes all rolls, AP, reactions and ammunition changes", async () => {
  const f = fixture();
  game.combats = [{ started: true, combatants: [{ actor: f.hero }] }];
  for (const options of [{ spendAp: true }, { opportunity: "leave", spendReaction: true }])
    await assert.rejects(rollAttack(f.hero, f.weapon, { mode: "ranged", stat: "dex", ...options }, f.target), /Charmed/);
  assert.equal(f.calls.updates.length, 0);
  assert.equal(f.calls.posts.length, 0);
  assert.equal(f.calls.rolls.length, 0);
  assert.equal(f.weapon.system.shots, 3);
  assert.equal(f.hero.system.command.value, 3);
  await rollAttack(f.hero, f.weapon, { mode: "ranged", stat: "dex", ignoreCharm: true }, f.target);
  assert.equal(f.calls.posts.length, 1);
  assert.equal(f.weapon.system.shots, 2);
});

test("queued attacks recheck a newly linked charm before paying", async () => {
  const f = fixture();
  f.effect.flags = {};
  const { queuedAction } = await import("../module/action-support.mjs");
  const waiting = queuedAction(f.hero.uuid, async () => {
    f.effect.flags = { "worlds-beyond": { conditionSources: { charmed: { uuid: f.charmer.uuid } } } };
  });
  const attack = rollAttack(f.hero, f.weapon, { mode: "ranged", stat: "dex", spendAp: true }, f.target);
  await waiting;
  await assert.rejects(attack, /Charmed/);
  assert.equal(f.calls.updates.length, 0);
});

test("single attack, save and area abilities reject every harmful charmer target before Use", async () => {
  const f = fixture();
  let paid = 0;
  const use = async () => {
    paid++;
    return { id: "used" };
  };
  for (const mode of ["attack", "save"])
    for (const area of [null, "cone"])
      await assert.rejects(
        rollAbilityStrike(f.hero, f.ability(mode), [{ actorUuid: f.other.uuid, name: "Other" }, f.target], { area, use }),
        /Charmed/
      );
  assert.equal(paid, 0);
  assert.equal(f.calls.posts.length, 0);
  assert.equal(f.calls.rolls.length, 0);
  await rollAbilityStrike(f.hero, f.ability("save"), [f.target], { use, ignoreCharm: true });
  assert.equal(paid, 1);
  await rollAbilityStrike(f.hero, f.ability("heal"), [f.target], { area: "cone", use });
  assert.equal(paid, 2);
  assert.ok(f.calls.posts.at(-1).flags["worlds-beyond"].heal);
});

test("harmful target batches reject the whole action; missing targets never invent a charmer", () => {
  const f = fixture();
  assert.throws(() => requireCharmedTargets(f.hero, [{ actorUuid: f.other.uuid }, f.target]), /Charmed/);
  assert.doesNotThrow(() => requireCharmedTargets(f.hero, [null, { actorUuid: "Actor.deleted" }]));
});

test("interaction advantage requires explicit intent and the reverse linked relationship, not a stat guess", async () => {
  const f = fixture(),
    options = { interaction: true, interactionTarget: f.victim.uuid };
  assert.equal(charmInteractionAdvantage(f.charmer, options), true);
  assert.equal(defaultCheckMode(f.charmer, "check", options), "advantage");
  assert.equal(defaultCheckMode(f.charmer, "check", { interactionTarget: f.victim.uuid }), "normal");
  assert.equal(defaultCheckMode(f.other, "check", options), "normal");
  assert.equal(defaultCheckMode(f.hero, "check", { interaction: true, interactionTarget: f.source.uuid }), "normal");
  for (const kind of ["save", "attack", "dodge", "initiative"])
    assert.equal(actorConditionRoll(f.charmer, kind, options).advantages.length, 0);
  await rollStatCheck(f.charmer, "str", options);
  assert.equal(f.calls.rolls.at(-1), "2d20kh1 + @mod", "any stat can be an interaction check");
  const context = f.calls.posts.at(-1).flags["worlds-beyond"].check;
  assert.equal(context.interactionTarget, f.victim.uuid);
  assert.match(context.conditionText, /Interaction with hero/);
  await rollStatCheck(f.charmer, "cha", { ...options, mode: "normal" });
  assert.equal(f.calls.rolls.at(-1), "1d20 + @mod");
});

test("interaction defaults combine with existing disadvantages and both automation settings", () => {
  const f = fixture(),
    options = { interaction: true, interactionTarget: f.victim.uuid };
  f.charmer.statuses.add("poison");
  assert.equal(defaultCheckMode(f.charmer, "check", options), "normal");
  f.charmer.statuses.clear();
  f.settings.automateCharmed = false;
  assert.equal(defaultCheckMode(f.charmer, "check", options), "normal");
  f.settings.automateCharmed = true;
  f.settings.automateConditionRolls = false;
  assert.equal(defaultCheckMode(f.charmer, "check", options), "normal");
  assert.equal(charmBlocksTarget(f.hero, f.target), true, "roll automation opt-out does not disable targeting");
});

test("interaction picker uses accessible choices, current target and exact token identities", () => {
  const f = fixture();
  game.user.targets.add({ document: f.victim });
  let choices = interactionChoices();
  assert.equal(choices.find(c => c.uuid === f.victim.uuid).selected, true);
  f.other.testUserPermission = () => false;
  choices = interactionChoices();
  assert.equal(
    choices.some(c => c.uuid === f.other.uuid),
    false
  );
  f.settings.automateCharmed = false;
  assert.deepEqual(interactionChoices(), []);
});

test("changing interaction intent/target recomputes reasons and dice; saves hide controls", () => {
  const f = fixture(),
    handlers = {};
  const controls = { kind: { value: "check" }, interaction: { checked: false }, interactionTarget: { value: f.victim.uuid } };
  const radios = { normal: {}, advantage: {}, disadvantage: {} },
    text = {},
    details = {};
  for (const [key, control] of Object.entries(controls)) control.addEventListener = (_e, callback) => (handlers[key] = callback);
  const form = {
    querySelector(selector) {
      if (selector === "[data-wb-interaction]") return details;
      if (selector === ".wb-condition-reasons") return text;
      const name = selector.match(/name="([^"]+)"/)?.[1];
      if (name === "mode") return radios[selector.match(/value="([^"]+)"/)[1]];
      return controls[name] ?? null;
    }
  };
  bindConditionCheck({ element: form }, f.charmer, "cha");
  assert.equal(radios.normal.checked, true);
  controls.interaction.checked = true;
  handlers.interaction();
  assert.equal(radios.advantage.checked, true);
  assert.match(text.textContent, /Charmed/);
  controls.kind.value = "save";
  handlers.kind();
  assert.equal(details.hidden, true);
  assert.equal(text.textContent, "");
});

test("area confirmation excludes the charmer by default, carries explicit override and keeps healing selected", async () => {
  const f = fixture();
  const tokens = [
    { id: f.source.id, name: f.source.name, actor: f.charmer, document: f.source },
    { id: f.victim.id, name: "Other", actor: f.other, document: { uuid: f.other.uuid } }
  ];
  f.calls.form = { t_source: true, t_victim: true, ignoreCharm: true };
  const result = await confirmAreaTargets(f.hero, f.ability("save"), tokens, { shape: "circle", size: 10 });
  assert.equal(result.tokens.length, 2);
  assert.equal(result.ignoreCharm, true);
  assert.match(f.calls.dialogs.at(-1).content, /name="t_source"> charmer · Charmed: excluded/);
  assert.match(f.calls.dialogs.at(-1).content, /Ignore Charmed targeting/);
  await confirmAreaTargets(f.hero, f.ability("heal"), tokens, { shape: "circle", size: 10 });
  assert.match(f.calls.dialogs.at(-1).content, /name="t_source" checked/);
  assert.doesNotMatch(f.calls.dialogs.at(-1).content, /Ignore Charmed/);
  f.calls.form = null;
  assert.equal(await confirmAreaTargets(f.hero, f.ability("save"), tokens, { shape: "circle", size: 10 }), null);
});

test("cancelling a weapon dialog with the ruling control changes no resources", async () => {
  const f = fixture();
  await promptAttack(f.hero, f.weapon.id, f.target);
  assert.equal(f.calls.renders.at(-1).data.charmOverride, true);
  assert.equal(f.calls.updates.length, 0);
  assert.equal(f.calls.posts.length, 0);
});

test("Wonder retains the interaction target, chosen advantage and audience after charm ends", async () => {
  const f = fixture();
  const original = await rollStatCheck(f.charmer, "cha", { interaction: true, interactionTarget: f.victim.uuid });
  f.effect.disabled = true;
  original.whisper = ["gm"];
  original.blind = true;
  await useWonder(original);
  const next = f.calls.posts.at(-1);
  assert.equal(next.rolls[0].formula, "2d20kh1 + @mod");
  assert.equal(next.flags["worlds-beyond"].check.interactionTarget, f.victim.uuid);
  assert.match(next.flags["worlds-beyond"].check.conditionText, /Charmed/);
  assert.deepEqual(next.whisper, ["gm"]);
  assert.equal(next.blind, true);
  assert.equal(f.charmer.system.wonder.value, 1);
  await assert.rejects(useWonder(original), /already used/);
});
