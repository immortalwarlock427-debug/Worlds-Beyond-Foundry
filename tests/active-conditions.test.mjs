import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionEffects, sourceOf, removeCondition, resolveBleedingCheck } from "../module/conditions.mjs";
import { resolveGrappleEscape } from "../module/condition-movement.mjs";

function fixture() {
  class Effects extends Map {
    *[Symbol.iterator]() {
      yield* this.values();
    }
  }
  const effects = new Effects(),
    calls = { deleted: [], changed: [], restored: [] };
  const actor = {
    uuid: "Actor.activeConditions",
    system: { level: 5 },
    effects,
    async deleteEmbeddedDocuments(type, ids) {
      calls.deleted.push(...ids);
      for (const id of ids) effects.delete(id);
      return ids;
    },
    async createEmbeddedDocuments(type, rows) {
      calls.restored.push(...rows);
      return rows.map(row => add(row._id, row.statuses));
    }
  };
  function add(id, statuses = ["bleeding"], state = {}) {
    const effect = {
      id,
      parent: actor,
      uuid: `${actor.uuid}.ActiveEffect.${id}`,
      statuses: new Set(statuses),
      disabled: false,
      flags: { "worlds-beyond": { condition: { sourceLevel: 1, sourceName: id } } },
      ...state,
      toObject: () => ({ _id: id, statuses: [...effect.statuses] }),
      async update(changes) {
        calls.changed.push(id);
        if (changes.statuses) effect.statuses = new Set(changes.statuses);
        return effect;
      }
    };
    effects.set(id, effect);
    return effect;
  }
  return { actor, effects, calls, add };
}

const inactiveStates = [{ disabled: true }, { isSuppressed: true }, { duration: { expired: true } }, { active: false }];

test("condition lookup excludes disabled, suppressed, expired and explicitly inactive sources", () => {
  const f = fixture();
  for (let i = 0; i < inactiveStates.length; i++) f.add(`inactive${i}`, ["bleeding"], inactiveStates[i]);
  f.add("active", ["bleeding"], { active: true });
  f.add("legacy");
  f.add("other", ["poison"]);
  assert.deepEqual(
    conditionEffects(f.actor, "bleeding").map(e => e.id),
    ["active", "legacy"]
  );
});

test("an inactive earlier source cannot supply a damaging condition's source level", () => {
  for (const state of inactiveStates) {
    const f = fixture();
    f.add("old", ["burning"], { ...state, flags: { "worlds-beyond": { condition: { sourceLevel: 20, sourceName: "Expired caster" } } } });
    f.add("current", ["burning"]);
    assert.deepEqual(sourceOf(f.actor, "burning"), { level: 1, name: "current", known: true });
    f.effects.delete("current");
    assert.deepEqual(sourceOf(f.actor, "burning"), { level: 5, name: "", known: false });
  }
});

test("ending an active condition leaves inactive history and unrelated composite statuses intact", async () => {
  const f = fixture();
  inactiveStates.forEach((state, i) => f.add(`old${i}`, ["prone", "poison"], state));
  f.add("live", ["prone"]);
  f.add("both", ["prone", "poison"]);
  await removeCondition(f.actor, "prone");
  assert.deepEqual(f.calls.deleted, ["live"]);
  assert.deepEqual(f.calls.changed, ["both"]);
  for (let i = 0; i < inactiveStates.length; i++) assert.deepEqual([...f.effects.get(`old${i}`).statuses], ["prone", "poison"]);
  assert.deepEqual([...f.effects.get("both").statuses], ["poison"]);
});

test("a saved effect ID does not make an expired condition eligible for removal", async () => {
  const f = fixture();
  f.add("old", ["bleeding"], { duration: { expired: true } });
  f.add("new");
  await removeCondition(f.actor, "bleeding", { effectIds: ["old"] });
  assert.equal(f.effects.has("old"), true);
  assert.equal(f.effects.has("new"), true);
  assert.deepEqual(f.calls.deleted, []);
});

test("an old recovery check or Wonder result cannot delete a now-inactive Bleeding record", async () => {
  for (const state of inactiveStates) {
    const f = fixture();
    f.add("old", ["bleeding"], state);
    f.add("new");
    const context = { actorUuid: f.actor.uuid, endBleeding: { effectIds: ["old"] } };
    assert.equal(await resolveBleedingCheck(f.actor, context, { total: 20 }), 0);
    assert.equal(f.effects.has("old"), true);
    assert.equal(f.effects.has("new"), true);
  }
});

test("an old Escape or Wonder result ignores a suppressed grapple while another grapple remains active", async () => {
  const f = fixture();
  f.add("old", ["grappled", "poison"], { isSuppressed: true });
  f.add("new", ["grappled"]);
  const context = { actorUuid: f.actor.uuid, escapeGrapple: { effectIds: ["old"], dc: 12, sources: { old: "" } } };
  assert.equal(await resolveGrappleEscape(f.actor, context, { total: 20 }), 0);
  assert.deepEqual([...f.effects.get("old").statuses], ["grappled", "poison"]);
  assert.equal(f.effects.has("new"), true);
});
