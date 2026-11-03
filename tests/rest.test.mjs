import { test } from "node:test";
import assert from "node:assert/strict";
import { hitDicePool, restDiceCount, shortRestHealing } from "../module/rest-core.mjs";
import { promptShortRest, shortRest } from "../module/rest-actions.mjs";

test("hit-die uses equal level, track spent uses across level changes and support compound hit dice", () => {
  const system = { level: 5, hitDice: { spent: 3 }, health: { damage: 30 } };
  assert.deepEqual(hitDicePool(system), { max: 5, spent: 3, remaining: 2 });
  system.level = 2;
  assert.deepEqual(hitDicePool(system), { max: 2, spent: 3, remaining: 0 });
  system.level = 6;
  assert.equal(hitDicePool(system).remaining, 3);
  assert.equal(restDiceCount(system, "2.9"), 2);
  for (const count of [0, -1, "", "bad", Infinity, 4]) assert.throws(() => restDiceCount(system, count));
  assert.deepEqual(hitDicePool({ level: 5 }), { max: 5, spent: 0, remaining: 5 });
});

test("short-rest healing floors each roll at zero, caps healing and preserves fractional damage", () => {
  const system = { level: 5, hitDice: { spent: 1 }, health: { damage: 10.75 } };
  assert.equal(shortRestHealing(system, [-2, 4]).damage, 6.75);
  const plan = shortRestHealing(system, [8, 7]);
  assert.equal(plan.spent, 3);
  assert.equal(plan.remaining, 2);
  assert.equal(plan.healed, 10.75);
  assert.equal(plan.damage, 0);
  assert.equal(system.hitDice.spent, 1);
  assert.equal(system.health.damage, 10.75);
  system.health.damage = -4;
  assert.equal(shortRestHealing(system, [8]).damage, -4);
  assert.throws(() => shortRestHealing(system, [NaN]), /valid total/);
});

function fixture(totals = [7]) {
  const calls = { rolls: [], renders: [], updates: [], messages: [], infos: [] },
    fail = {};
  const actor = {
    uuid: "Actor.rest",
    type: "character",
    isOwner: true,
    system: {
      level: 5,
      hitDice: { spent: 2 },
      core: { hitDie: "1d10" },
      stats: { vit: { mod: 3 } },
      health: { damage: 40, max: 100, value: 60 }
    },
    async update(data) {
      calls.updates.push(structuredClone(data));
      if (fail.update || (calls.updates.length > 1 && fail.refund)) return null;
      for (const [path, value] of Object.entries(data)) {
        const [, pool, key] = path.split(".");
        this.system[pool][key] = value;
      }
      this.system.health.value = this.system.health.max - this.system.health.damage;
      return this;
    }
  };
  globalThis.game = { settings: { get: () => "blind" } };
  globalThis.ui = { notifications: { info: text => calls.infos.push(text) } };
  globalThis.foundry = {
    dice: {
      Roll: class {
        constructor(formula, data) {
          this.formula = formula;
          this.data = data;
          calls.rolls.push(this);
        }
        async evaluate(options) {
          this.options = options;
          if (fail.roll) throw new Error("roll failed");
          this.total = totals.shift();
          fail.afterRoll?.();
        }
        async render() {
          if (fail.diceRender) throw new Error("dice render failed");
          return "<div class=dice-roll>dice</div>";
        }
      }
    },
    applications: {
      api: {
        DialogV2: {
          input: async config => {
            calls.dialog = config;
            return fail.choice ?? { count: 1 };
          }
        }
      },
      handlebars: {
        renderTemplate: async (path, context) => {
          if (fail.render) throw new Error("template failed");
          calls.renders.push({ path, context });
          fail.afterRender?.();
          return "<div class=wb-roll-card>rest</div>";
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({ actor: "rest" }),
          create: async (data, options) => {
            calls.messages.push({ data, options });
            fail.beforeMessage?.();
            if (fail.chat) throw new Error("chat failed");
            if (fail.noMessage) return null;
            return { id: "rest-result" };
          }
        }
      }
    }
  };
  return { actor, calls, fail };
}

test("each selected use rolls the complete current hit die plus VIT and commits healing/spending once", async () => {
  const f = fixture([10, 12]);
  f.actor.system.core.hitDie = "1d12 + 1d4";
  f.actor.system.stats.vit.mod = 6;
  await shortRest(f.actor, 2);
  assert.equal(f.calls.rolls.length, 2);
  for (const roll of f.calls.rolls) {
    assert.equal(roll.formula, "(1d12 + 1d4) + @mod");
    assert.deepEqual(roll.data, { mod: 6 });
    assert.equal(roll.options.allowInteractive, false);
  }
  assert.deepEqual(f.calls.updates, [{ "system.hitDice.spent": 4, "system.health.damage": 18 }]);
  assert.equal(f.calls.messages.length, 1);
  assert.equal(f.calls.messages[0].options.messageMode, "blind");
  assert.equal(f.calls.messages[0].data.rolls.length, 2);
  assert.equal(f.calls.renders[0].context.remaining, 1);
});

test("short rest uses the maximum, heals below-zero characters and leaves full/overflow Health unchanged", async () => {
  const f = fixture([100]);
  f.actor.system.health.damage = 110;
  f.actor.system.health.value = -10;
  await shortRest(f.actor);
  assert.equal(f.actor.system.health.value, 90);
  for (const damage of [0, -5]) {
    const f = fixture();
    f.actor.system.health.damage = damage;
    await shortRest(f.actor);
    assert.equal(f.calls.rolls.length, 0);
    assert.equal(f.calls.updates.length, 0);
    assert.match(f.calls.infos[0], /full Health/);
  }
});

test("exhausted, unowned and cancelled rests spend nothing", async () => {
  const f = fixture();
  f.actor.system.hitDice.spent = 5;
  await assert.rejects(shortRest(f.actor), /Not enough/);
  assert.equal(f.calls.rolls.length, 0);
  f.actor.isOwner = false;
  await shortRest(f.actor);
  assert.equal(f.calls.updates.length, 0);
  const g = fixture();
  g.fail.choice = false;
  await promptShortRest(g.actor);
  assert.equal(g.calls.updates.length, 0);
  assert.match(g.calls.renders[0].path, /short-rest-dialog/);
  assert.equal(g.calls.dialog.position.width, 360);
});

test("failed rolls/rendering and cancelled actor updates cannot spend hit dice or post a result", async () => {
  for (const failure of ["roll", "render", "diceRender", "update"]) {
    const f = fixture();
    f.fail[failure] = true;
    await assert.rejects(shortRest(f.actor));
    assert.equal(f.actor.system.hitDice.spent, 2);
    assert.equal(f.actor.system.health.damage, 40);
    assert.equal(f.calls.messages.length, 0);
  }
});

test("failed or cancelled chat posting refunds uses and healing while preserving later corrections", async () => {
  for (const failure of ["chat", "noMessage"]) {
    const f = fixture();
    f.fail[failure] = true;
    f.fail.beforeMessage = () => {
      f.actor.system.health.damage += 4;
      f.actor.system.hitDice.spent += 1;
    };
    await assert.rejects(shortRest(f.actor));
    assert.equal(f.actor.system.hitDice.spent, 3);
    assert.equal(f.actor.system.health.damage, 44);
  }
  const f = fixture();
  f.fail.chat = true;
  f.fail.refund = true;
  await assert.rejects(shortRest(f.actor), /Correct Health and Hit dice spent/);
});

test("rechecks prevent stale spending and serialize repeated clicks", async () => {
  const f = fixture([7, 8]);
  f.actor.system.hitDice.spent = 4;
  const result = await Promise.allSettled([shortRest(f.actor), shortRest(f.actor)]);
  assert.deepEqual(
    result.map(entry => entry.status),
    ["fulfilled", "rejected"]
  );
  assert.equal(f.actor.system.hitDice.spent, 5);
  const g = fixture();
  g.fail.afterRoll = () => {
    g.actor.system.health.damage = 0;
    g.actor.system.health.value = 100;
  };
  await shortRest(g.actor);
  assert.equal(g.calls.updates.length, 0);
  const h = fixture();
  h.fail.afterRender = () => {
    h.actor.system.hitDice.spent = 5;
  };
  await assert.rejects(shortRest(h.actor), /pool changed/);
  assert.equal(h.calls.updates.length, 0);
});
