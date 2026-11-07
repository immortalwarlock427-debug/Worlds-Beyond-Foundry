import { test } from "node:test";
import assert from "node:assert/strict";

function setup() {
  const posts = [];
  let next = 11;
  globalThis.game = {
    settings: { get: (scope, key) => (key === "messageMode" ? "public" : true) },
    users: { activeGM: { id: "gm" } },
    socket: { emit() {} }
  };
  globalThis.canvas = undefined;
  globalThis.foundry = {
    dice: {
      Roll: class {
        constructor(formula, data) {
          this.formula = formula;
          this.data = data;
        }
        async evaluate() {
          this.total = next + (this.data?.mod ?? 0);
          this.dice = [{ total: next }];
          return this;
        }
        async render() {
          return "";
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({ alias: "Mage" }),
          async create(data) {
            posts.push(data);
            return { id: "card", ...data };
          }
        }
      }
    }
  };
  const actor = {
    uuid: "Actor.mage",
    name: "Mage",
    system: {
      stats: Object.fromEntries(["str", "dex", "vit", "agl", "int", "wis", "cha", "fth"].map(key => [key, { mod: key === "int" ? 3 : 0 }]))
    }
  };
  const ability = targeting => ({
    id: "spell",
    name: "Spell",
    type: "ability",
    system: {
      apDiscountStat: "int",
      targeting: {
        mode: "save",
        stat: "",
        saveStat: "",
        dc: null,
        onSave: "none",
        damage: "6d6 + int",
        damageType: "Fire",
        area: {},
        visual: {},
        ...targeting
      }
    }
  });
  const target = (name, evasion = 13) => ({ name, actorUuid: `Actor.${name}`, tokenUuid: `Token.${name}`, evasion, armor: 0 });
  return { posts, actor, ability, target, setNatural: value => (next = value) };
}

const { rollAbilityStrike } = await import("../module/ability-strikes.mjs");
const use = async () => ({ id: "used" });
const flag = post => post.flags["worlds-beyond"].attack;

test("an area save gives every target its own hand and the shared DC", async () => {
  const s = setup();
  await rollAbilityStrike(s.actor, s.ability({ area: { shape: "circle", size: 20 } }), [s.target("Orc"), s.target("Goblin")], {
    area: "circle",
    use
  });
  const data = flag(s.posts[0]);
  assert.equal(data.target, null);
  assert.equal(data.automated, true);
  assert.deepEqual(
    data.hands.map(hand => hand.target.name),
    ["Orc", "Goblin"]
  );
  assert.equal(data.ability.area, "circle");
  assert.equal(data.ability.dc, 15);
  assert.equal(data.ability.damage, "6d6 + 3");
  assert.match(s.posts[0].content, /20 ft radius circle/);
});

test("an area attack has no attack roll and tells targets to Dodge for half", async () => {
  const s = setup();
  await rollAbilityStrike(s.actor, s.ability({ mode: "attack", area: { shape: "cone" } }), [s.target("Orc")], { area: "cone", use });
  const data = flag(s.posts[0]);
  assert.equal(s.posts[0].rolls.length, 0);
  assert.equal(data.ability.check, "attack");
  assert.equal(data.ability.dc, 15);
  assert.match(s.posts[0].content, /Dodge against DC 15 for half damage/);
});

test("a single-target attack rolls against that target's Natural Evasion", async () => {
  const s = setup();
  s.setNatural(10);
  await rollAbilityStrike(s.actor, s.ability({ mode: "attack" }), s.target("Orc", 13), { use });
  const data = flag(s.posts[0]);
  assert.equal(data.target.name, "Orc");
  assert.equal(data.hands[0].total, 13);
  assert.equal(data.hands[0].hit, true);
  assert.equal(data.ability.area, null);
  assert.equal(data.ability.dc, null);
});

test("a refused Use posts nothing", async () => {
  const s = setup();
  await rollAbilityStrike(s.actor, s.ability({}), [s.target("Orc")], { use: async () => undefined });
  assert.equal(s.posts.length, 0);
});
