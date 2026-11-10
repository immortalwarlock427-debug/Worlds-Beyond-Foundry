import { test } from "node:test";
import assert from "node:assert/strict";
import { stabilize, applyStabilized } from "../module/death.mjs";

function fixture({ combat = true, owned = true, total = 20, stabilized = false } = {}) {
  const calls = { helper: [], target: [], posts: [] };
  const faults = { post: false, cancelTarget: false, ignoreTarget: false, receipt: false, afterRoll: null };
  const helper = {
    uuid: "Actor.helper",
    name: "Helper",
    type: "character",
    isOwner: true,
    statuses: new Set(),
    system: { ap: { value: 20 }, command: { value: 2 }, stats: { int: { mod: 3 } } },
    async update(data) {
      calls.helper.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split("."),
          key = parts.pop();
        parts.reduce((o, p) => o[p], helper)[key] = value;
      }
      return helper;
    }
  };
  const target = {
    uuid: "Actor.patient",
    name: "Patient",
    type: "character",
    isOwner: owned,
    system: { level: 5, stats: { vit: { value: 12 } }, health: { value: 0, damage: 100, max: 100 }, dying: { stabilized, trauma: 0 } },
    async update(data, options) {
      calls.target.push({ data, options });
      const next = data["system.dying.stabilized"];
      if (next === true && faults.cancelTarget) return undefined;
      if (!(next === true && faults.ignoreTarget)) target.system.dying.stabilized = next;
      return target;
    }
  };
  const encounter = { started: true, combatants: [{ actor: helper }], combatant: { actor: helper } };
  globalThis.game = { user: { id: "owner", isActiveGM: true }, combats: combat ? [encounter] : [], settings: { get: () => "public" } };
  globalThis.foundry = {
    utils: { fromUuid: async uuid => (uuid === target.uuid ? target : null) },
    dice: {
      Roll: class {
        async evaluate() {
          this.total = total;
          await faults.afterRoll?.();
          return this;
        }
        async render() {
          return "<div>dice</div>";
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({ actor: "helper" }),
          async create(data) {
            if (faults.post) return undefined;
            const m = {
              ...data,
              id: `stabilize${calls.posts.length}`,
              getFlag: (scope, key) => m.flags?.[scope]?.[key],
              async setFlag(scope, key, value) {
                if (faults.receipt) return undefined;
                m.flags[scope][key] = value;
                return m;
              }
            };
            calls.posts.push(m);
            return m;
          }
        }
      }
    }
  };
  return { helper, target, calls, faults };
}

test("failed result posting restores stabilization as well as own and Command AP", async () => {
  const f = fixture();
  f.faults.post = true;
  await assert.rejects(stabilize(f.target, f.helper), /not posted/);
  assert.equal(f.target.system.dying.stabilized, false);
  assert.equal(f.helper.system.ap.value, 20);
  assert.equal(f.helper.system.command.value, 2);
});

test("cancelled or unretained target updates cannot post applied success and refund AP", async () => {
  for (const fault of ["cancelTarget", "ignoreTarget"]) {
    const f = fixture();
    f.faults[fault] = true;
    await assert.rejects(stabilize(f.target, f.helper), /cancelled|not retained/);
    assert.equal(f.calls.posts.length, 0);
    assert.equal(f.target.system.dying.stabilized, false);
    assert.equal(f.helper.system.ap.value, 20);
    assert.equal(f.helper.system.command.value, 2);
  }
});

test("recovery during the check prevents stale stabilization without spending AP", async () => {
  const f = fixture();
  f.faults.afterRoll = () => {
    f.target.system.health.value = 1;
  };
  await assert.rejects(stabilize(f.target, f.helper), /recovered|0 Health/);
  assert.equal(f.target.system.dying.stabilized, false);
  assert.equal(f.calls.posts.length, 0);
  assert.equal(f.helper.system.ap.value, 20);
  assert.equal(f.helper.system.command.value, 2);
});

test("successful and failed checks keep the existing five-AP cost, with Command first", async () => {
  for (const [total, success] of [
    [12, true],
    [11, false]
  ]) {
    const f = fixture({ total });
    const message = await stabilize(f.target, f.helper);
    assert.equal(f.helper.system.ap.value, 17);
    assert.equal(f.helper.system.command.value, 0);
    assert.equal(f.target.system.dying.stabilized, success);
    assert.deepEqual(message.getFlag("worlds-beyond", "stabilize"), { targetUuid: f.target.uuid, success, applied: success });
    assert.equal(f.target.system.health.value, 0);
  }
});

test("posting failure preserves an already stabilized target and outside-combat actions remain free", async () => {
  const f = fixture({ combat: false, stabilized: true });
  f.faults.post = true;
  await assert.rejects(stabilize(f.target, f.helper), /not posted/);
  assert.equal(f.target.system.dying.stabilized, true);
  assert.equal(f.calls.target.length, 0);
  assert.equal(f.helper.system.ap.value, 20);
  assert.equal(f.helper.system.command.value, 2);
  f.faults.post = false;
  await stabilize(f.target, f.helper);
  assert.equal(f.helper.system.ap.value, 20);
});

test("unowned targets stay pending until the active GM retains their update and receipt", async () => {
  const f = fixture({ owned: false });
  const message = await stabilize(f.target, f.helper);
  assert.equal(f.target.system.dying.stabilized, false);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, false);
  assert.match(message.content, /GM applies stabilization/);
  assert.doesNotMatch(message.content, /stops bleeding out/);
  await applyStabilized(message);
  assert.equal(f.target.system.dying.stabilized, true);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, true);
  assert.equal(f.helper.system.ap.value, 17);
});

test("GM target cancellation does not acknowledge success and a retry does not pay AP again", async () => {
  const f = fixture({ owned: false });
  const message = await stabilize(f.target, f.helper);
  f.faults.cancelTarget = true;
  await assert.rejects(applyStabilized(message), /cancelled/);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, false);
  assert.equal(f.target.system.dying.stabilized, false);
  f.faults.cancelTarget = false;
  await applyStabilized(message);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, true);
  assert.equal(f.helper.system.ap.value, 17);
  assert.equal(f.helper.system.command.value, 0);
});

test("failed GM receipt saving restores the target, and duplicate retries apply only once", async () => {
  const f = fixture({ owned: false });
  const message = await stabilize(f.target, f.helper);
  f.faults.receipt = true;
  await assert.rejects(applyStabilized(message), /receipt was not retained/);
  assert.equal(f.target.system.dying.stabilized, false);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, false);
  assert.equal(f.calls.target.at(-1).options.worldsBeyondCorrection, true);
  f.faults.receipt = false;
  await Promise.all([applyStabilized(message), applyStabilized(message)]);
  assert.equal(f.target.system.dying.stabilized, true);
  assert.equal(f.calls.target.filter(call => call.data["system.dying.stabilized"] === true).length, 2);
});

test("pending results for missing or recovered targets are not falsely acknowledged", async () => {
  const f = fixture({ owned: false });
  const message = await stabilize(f.target, f.helper);
  foundry.utils.fromUuid = async () => null;
  await assert.rejects(applyStabilized(message), /no longer exists/);
  foundry.utils.fromUuid = async () => f.target;
  f.target.system.health.value = 1;
  await assert.rejects(applyStabilized(message), /0 Health/);
  assert.equal(message.getFlag("worlds-beyond", "stabilize").applied, false);
  assert.equal(f.target.system.dying.stabilized, false);
});

test("non-active GMs and unsuccessful/already-applied cards do not apply a result", async () => {
  const f = fixture({ owned: false });
  const message = await stabilize(f.target, f.helper);
  game.user.isActiveGM = false;
  await applyStabilized(message);
  assert.equal(f.calls.target.length, 0);
  game.user.isActiveGM = true;
  message.flags["worlds-beyond"].stabilize.success = false;
  await applyStabilized(message);
  assert.equal(f.calls.target.length, 0);
  message.flags["worlds-beyond"].stabilize.success = true;
  message.flags["worlds-beyond"].stabilize.applied = true;
  await applyStabilized(message);
  assert.equal(f.calls.target.length, 0);
});

test("insufficient AP refuses the check before target mutation or a posted card", async () => {
  const f = fixture();
  f.helper.system.ap.value = 0;
  f.helper.system.command.value = 0;
  await assert.rejects(stabilize(f.target, f.helper), /Not enough AP/);
  assert.equal(f.calls.target.length, 0);
  assert.equal(f.calls.posts.length, 0);
});

test("a failed restoration reports incomplete recovery instead of claiming full rollback", async () => {
  const f = fixture();
  f.faults.post = true;
  const update = f.target.update;
  f.target.update = async (data, options) => (options?.worldsBeyondCorrection ? undefined : update(data, options));
  await assert.rejects(stabilize(f.target, f.helper), /Recovery also failed/);
  assert.equal(f.helper.system.ap.value, 20);
  assert.equal(f.helper.system.command.value, 2);
  assert.equal(f.target.system.dying.stabilized, true);
});
