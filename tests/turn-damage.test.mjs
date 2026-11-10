import { test } from "node:test";
import assert from "node:assert/strict";
import { tick } from "../module/conditions.mjs";
import { bleedOut } from "../module/death.mjs";
import { mercyDamage } from "../module/death-core.mjs";
import { undoTurnDamage } from "../module/turn-damage.mjs";
import { queuedAction } from "../module/action-support.mjs";

function fixture({ damage = 101, mercy = true, threshold = 26 } = {}) {
  const calls = { updates: [], posts: [] };
  let cancel = false;
  const actor = {
    uuid: "Actor.turnDamage",
    name: "Turn damage",
    type: "character",
    effects: [],
    statuses: new Set(["bleeding", "burning"]),
    system: {
      level: 5,
      stats: { vit: { value: threshold - 5 } },
      dying: { stabilized: false, trauma: 0 },
      resistances: [],
      immunities: [],
      health: { max: 100, damage, value: 100 - damage }
    },
    async update(changes, options = {}) {
      calls.updates.push({ changes, options });
      await new Promise(resolve => setImmediate(resolve));
      if (cancel) return undefined;
      let next = changes["system.health.damage"];
      if (mercy && options.worldsBeyondDamage)
        next = mercyDamage({ max: 100, previousDamage: actor.system.health.damage, nextDamage: next, threshold }).damage;
      if (next !== undefined) {
        actor.system.health.damage = next;
        actor.system.health.value = 100 - next;
      }
      return actor;
    }
  };
  globalThis.game = { user: { id: "gm", isGM: true }, settings: { get: () => true } };
  globalThis.foundry = {
    utils: { fromUuid: async uuid => (uuid === actor.uuid ? actor : null) },
    dice: {
      Roll: class {
        async evaluate() {
          this.total = 9;
          return this;
        }
        async render() {
          return "<div>9</div>";
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({ actor: "turnDamage" }),
          async create(data) {
            const message = {
              ...data,
              id: `message${calls.posts.length}`,
              getFlag: (scope, key) => message.flags?.[scope]?.[key],
              async setFlag(scope, key, value) {
                message.flags[scope][key] = value;
                return message;
              }
            };
            calls.posts.push(message);
            return message;
          }
        }
      }
    }
  };
  return {
    actor,
    calls,
    cancel: value => {
      cancel = value;
    }
  };
}

test("concurrent status damage and Bleeding Out retain both Health losses", async () => {
  const f = fixture();
  await Promise.all([tick(f.actor, "bleeding", { id: "combat" }), bleedOut(f.actor)]);
  assert.equal(f.actor.system.health.damage, 114);
  assert.equal(f.calls.posts.length, 2);
});

test("Death's Mercy receipts record actual Health loss rather than rolled damage", async () => {
  const f = fixture({ damage: 100, threshold: 10 });
  const message = await tick(f.actor, "bleeding", { id: "combat" });
  assert.equal(f.actor.system.health.damage, 105);
  assert.equal(message.getFlag("worlds-beyond", "conditionTick").amount, 5);
  assert.match(message.content, /takes 5 damage/);
  assert.match(message.content, /adjusted from 9 to 5/);
  assert.equal(message.getFlag("worlds-beyond", "conditionTick").rolled, 9);
  assert.equal(message.getFlag("worlds-beyond", "conditionTick").requested, 9);
  await undoTurnDamage(message, "conditionTick", { floor: 0 });
  assert.equal(f.actor.system.health.damage, 100, "Undo reverses five, not the nine rolled");
});

test("Bleeding, Burning and Bleeding Out each contribute once without overwriting Health", async () => {
  const f = fixture();
  await Promise.all([tick(f.actor, "bleeding", { id: "combat" }), tick(f.actor, "burning", { id: "combat" }), bleedOut(f.actor)]);
  assert.equal(f.actor.system.health.damage, 123);
  assert.equal(f.calls.posts.length, 3);
  const amounts = f.calls.posts.map(m => (m.getFlag("worlds-beyond", "conditionTick") ?? m.getFlag("worlds-beyond", "bleedOut")).amount);
  assert.deepEqual(amounts, [9, 9, 4]);
});

test("different actors do not block one another's turn damage", async () => {
  const f = fixture();
  let release;
  const barrier = new Promise(resolve => {
    release = resolve;
  });
  const update = f.actor.update;
  f.actor.update = async (...args) => {
    await barrier;
    return update(...args);
  };
  let firstDone = false;
  const first = tick(f.actor, "bleeding", { id: "a" }).then(() => {
    firstDone = true;
  });
  await new Promise(resolve => setImmediate(resolve));
  const g = fixture();
  g.actor.uuid = "Actor.other";
  try {
    await tick(g.actor, "burning", { id: "b" });
    assert.equal(g.actor.system.health.damage, 110);
    assert.equal(firstDone, false);
  } finally {
    release();
    await first;
  }
});

test("resistance and immunity still apply before native Health adjustments", async () => {
  const f = fixture({ damage: 100, threshold: 4 });
  f.actor.statuses.add("petrified");
  const halved = await tick(f.actor, "burning", { id: "combat" });
  const data = halved.getFlag("worlds-beyond", "conditionTick");
  assert.equal(data.rolled, 9);
  assert.equal(data.requested, 4);
  assert.equal(data.amount, 2);
  f.actor.system.immunities = ["Fire"];
  const updates = f.calls.updates.length;
  const immune = await tick(f.actor, "burning", { id: "combat" });
  assert.equal(immune.getFlag("worlds-beyond", "conditionTick").amount, 0);
  assert.equal(immune.getFlag("worlds-beyond", "conditionTick").applied, false);
  assert.equal(f.calls.updates.length, updates);
});

test("cancelled native Health writes do not claim damage or post a receipt", async () => {
  const f = fixture();
  f.cancel(true);
  await assert.rejects(tick(f.actor, "bleeding", { id: "combat" }), /Health update was cancelled/);
  await assert.rejects(bleedOut(f.actor), /Health update was cancelled/);
  assert.equal(f.actor.system.health.damage, 101);
  assert.equal(f.calls.posts.length, 0);
  f.cancel(false);
  await bleedOut(f.actor);
  assert.equal(f.actor.system.health.damage, 105, "a rejected update must release the actor queue");
});

test("queued Bleeding Out rechecks stabilization, positive Health and death before taking Health", async () => {
  for (const correction of [
    a => {
      a.system.dying.stabilized = true;
    },
    a => {
      a.system.health.value = 1;
    },
    a => {
      a.statuses.add("dead");
    }
  ]) {
    const f = fixture();
    const recovery = queuedAction(f.actor.uuid, async () => {
      correction(f.actor);
    });
    const loss = bleedOut(f.actor);
    await recovery;
    assert.equal(await loss, null);
    assert.equal(f.calls.updates.length, 0);
    assert.equal(f.calls.posts.length, 0);
  }
});

test("concurrent Undos on different cards restore both losses and repeated clicks cannot heal twice", async () => {
  const f = fixture();
  const [status, dying] = await Promise.all([tick(f.actor, "bleeding", { id: "combat" }), bleedOut(f.actor)]);
  await Promise.all([
    undoTurnDamage(status, "conditionTick", { floor: 0 }),
    undoTurnDamage(dying, "bleedOut"),
    undoTurnDamage(status, "conditionTick", { floor: 0 })
  ]);
  assert.equal(f.actor.system.health.damage, 101);
  assert.equal(status.getFlag("worlds-beyond", "conditionTick").undone, true);
  assert.equal(dying.getFlag("worlds-beyond", "bleedOut").undone, true);
});

test("an Undo and a new tick share the actor queue, preserving the later loss", async () => {
  const f = fixture();
  const first = await tick(f.actor, "bleeding", { id: "combat" });
  await Promise.all([undoTurnDamage(first, "conditionTick", { floor: 0 }), tick(f.actor, "burning", { id: "combat" })]);
  assert.equal(f.actor.system.health.damage, 110);
});

test("failed receipt saves restore Health so retrying Undo remains safe", async () => {
  const f = fixture();
  const message = await tick(f.actor, "bleeding", { id: "combat" });
  const save = message.setFlag;
  message.setFlag = async () => undefined;
  await assert.rejects(undoTurnDamage(message, "conditionTick", { floor: 0 }), /receipt was not saved/);
  assert.equal(f.actor.system.health.damage, 110);
  assert.equal(message.getFlag("worlds-beyond", "conditionTick").undone, false);
  message.setFlag = save;
  await undoTurnDamage(message, "conditionTick", { floor: 0 });
  assert.equal(f.actor.system.health.damage, 101);
  assert.equal(f.calls.updates.at(-1).options.worldsBeyondCorrection, true);
});

test("non-GMs, cancelled Undo writes and missing actors cannot mark damage as undone", async () => {
  const f = fixture();
  const message = await bleedOut(f.actor);
  game.user.isGM = false;
  await undoTurnDamage(message, "bleedOut");
  assert.equal(f.actor.system.health.damage, 105);
  game.user.isGM = true;
  f.cancel(true);
  await assert.rejects(undoTurnDamage(message, "bleedOut"), /update was cancelled/);
  assert.equal(message.getFlag("worlds-beyond", "bleedOut").undone, false);
  foundry.utils.fromUuid = async () => null;
  await assert.rejects(undoTurnDamage(message, "bleedOut"), /no longer exists/);
  assert.equal(message.getFlag("worlds-beyond", "bleedOut").undone, false);
});
