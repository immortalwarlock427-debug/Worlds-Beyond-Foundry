import { test } from "node:test";
import assert from "node:assert/strict";
import { treat } from "../module/death.mjs";
import { queuedAction } from "../module/action-support.mjs";

function fixture() {
  const calls = { updates: [], posts: [] },
    faults = {};
  const actor = {
    uuid: "Actor.patient",
    type: "character",
    name: "Patient <One>",
    isOwner: true,
    system: {
      level: 5,
      stats: { vit: { value: 12 } },
      health: { max: 100, damage: 104, value: -4 },
      dying: { stabilized: true, trauma: 0 },
      ap: { value: 17 },
      command: { value: 2 }
    },
    async update(data) {
      calls.updates.push(data);
      await Promise.resolve();
      if (faults.cancel) return undefined;
      if (faults.throwUpdate) throw Error("native Health write failed");
      if (!faults.ignore) {
        actor.system.health.damage = faults.damage ?? data["system.health.damage"];
        actor.system.health.value = actor.system.health.max - actor.system.health.damage;
      }
      return actor;
    }
  };
  globalThis.game = { combats: [] };
  globalThis.foundry = {
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: ({ actor: a }) => ({ actor: a.uuid }),
          create: async data => {
            if (faults.post) return undefined;
            if (faults.throwPost) throw Error("native chat write failed");
            calls.posts.push(data);
            return data;
          }
        }
      }
    }
  };
  const combat = () => {
    game.combats = [{ started: true, combatants: [{ actor }] }];
  };
  return { actor, calls, faults, combat };
}

test("cancelled native treatment cannot announce recovery", async () => {
  const { actor, calls, faults } = fixture();
  faults.cancel = true;
  await assert.rejects(treat(actor), /cancelled|not retained|not restore/i);
  assert.equal(actor.system.health.value, -4);
  assert.equal(calls.posts.length, 0);
});

test("an ignored native treatment write cannot announce recovery", async () => {
  const { actor, calls, faults } = fixture();
  faults.ignore = true;
  await assert.rejects(treat(actor), /not retained|not restore/i);
  assert.equal(actor.system.health.value, -4);
  assert.equal(calls.posts.length, 0);
});

test("a native Health adjustment cannot post a false one-Health claim", async () => {
  const { actor, calls, faults } = fixture();
  faults.damage = 98;
  await assert.rejects(treat(actor), /not retained|not restore/i);
  assert.equal(actor.system.health.value, 2);
  assert.equal(calls.posts.length, 0);
});

test("successful treatment retains one Health, readable identity and existing free cost", async () => {
  const { actor, calls } = fixture();
  const message = await treat(actor);
  assert.equal(actor.system.health.value, 1);
  assert.equal(actor.system.ap.value, 17);
  assert.equal(actor.system.command.value, 2);
  assert.match(message.content, /Patient &lt;One&gt; is back to 1 Health/);
  assert.equal(message.flags["worlds-beyond"].sheetActivity.actorUuid, actor.uuid);
  assert.deepEqual(calls.updates, [{ "system.health.damage": 99 }]);
});

test("duplicate local treatment clicks heal and post only once", async () => {
  const { actor, calls } = fixture();
  const result = await Promise.allSettled([treat(actor), treat(actor)]);
  assert.deepEqual(
    result.map(r => r.status),
    ["fulfilled", "rejected"]
  );
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.posts.length, 1);
});

test("treatment rechecks recovery, stabilization and combat after earlier actor actions", async () => {
  for (const change of ["recovered", "unstabilized", "combat", "ownership"]) {
    const f = fixture();
    const prior = queuedAction(f.actor.uuid, async () => {
      if (change === "recovered") f.actor.system.health.value = 5;
      if (change === "unstabilized") f.actor.system.dying.stabilized = false;
      if (change === "combat") f.combat();
      if (change === "ownership") f.actor.isOwner = false;
    });
    await Promise.allSettled([prior, treat(f.actor)]);
    assert.equal(f.calls.updates.length, 0, change);
    assert.equal(f.calls.posts.length, 0, change);
  }
});

test("existing eligibility rules and non-owner guards prevent writes", async () => {
  for (const change of ["recovered", "unstabilized", "combat", "ownership", "type"]) {
    const f = fixture();
    if (change === "recovered") f.actor.system.health.value = 5;
    if (change === "unstabilized") f.actor.system.dying.stabilized = false;
    if (change === "combat") f.combat();
    if (change === "ownership") f.actor.isOwner = false;
    if (change === "type") f.actor.type = "other";
    await Promise.allSettled([treat(f.actor)]);
    assert.equal(f.calls.updates.length, 0, change);
    assert.equal(f.calls.posts.length, 0, change);
  }
});

test("a failed Health write leaves no card and does not block a later retry", async () => {
  const { actor, calls, faults } = fixture();
  faults.throwUpdate = true;
  await assert.rejects(treat(actor), /native Health write failed/);
  assert.equal(calls.posts.length, 0);
  assert.equal(actor.system.health.value, -4);
  faults.throwUpdate = false;
  await treat(actor);
  assert.equal(calls.posts.length, 1);
});

test("failed card posting preserves real recovery and explains manual verification", async () => {
  for (const fault of ["post", "throwPost"]) {
    const { actor, calls, faults } = fixture();
    faults[fault] = true;
    await assert.rejects(treat(actor), /Health.*restored.*card|restored.*Health.*card/i);
    assert.equal(actor.system.health.value, 1);
    assert.equal(calls.updates.length, 1, "do not undo native Trauma/waking consequences through a raw Health rollback");
    await assert.rejects(treat(actor), /0 Health/);
    assert.equal(calls.updates.length, 1);
  }
});

test("separate actors keep separate treatment queues", async () => {
  const f = fixture(),
    other = { ...f.actor, uuid: "Actor.other", system: structuredClone(f.actor.system) };
  other.update = async data => {
    other.system.health.damage = data["system.health.damage"];
    other.system.health.value = other.system.health.max - other.system.health.damage;
    return other;
  };
  const results = await Promise.all([treat(f.actor), treat(other)]);
  assert.equal(results.length, 2);
  assert.equal(f.calls.posts.length, 2);
  assert.equal(other.system.health.value, 1);
});
