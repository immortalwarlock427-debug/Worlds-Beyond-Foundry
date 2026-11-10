import { test } from "node:test";
import assert from "node:assert/strict";
import { stabilize, applyStabilized, promptStabilize } from "../module/death.mjs";
import { useWonder, rollCard } from "../module/roll-actions.mjs";
import { stabilizeSuccess } from "../module/death-core.mjs";

function fixture({ combat = true, owned = true, total = 20, stabilized = false } = {}) {
  const calls = { helper: [], target: [], posts: [], rolls: [], views: [] };
  const settings = new Map(),
    totals = [];
  const faults = { post: false, cancelTarget: false, ignoreTarget: false, receipt: false, afterRoll: null };
  const helper = {
    uuid: "Actor.helper",
    name: "Helper",
    type: "character",
    isOwner: true,
    statuses: new Set(),
    flags: {},
    getFlag: (scope, key) => helper.flags[scope]?.[key],
    system: {
      exhaustion: 0,
      wonder: { value: 3 },
      ap: { value: 20 },
      command: { value: 2 },
      stats: { int: { mod: 3 }, fth: { value: 12 } }
    },
    async update(data) {
      calls.helper.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split("."),
          key = parts.pop();
        const parent = parts.reduce((o, p) => (o[p] ??= {}), helper);
        if (key.startsWith("-=")) delete parent[key.slice(2)];
        else parent[key] = value;
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
  globalThis.game = {
    user: { id: "owner", isActiveGM: true },
    combats: combat ? [encounter] : [],
    messages: { contents: calls.posts },
    settings: { get: (_s, key) => settings.get(key) ?? (key === "messageMode" ? "public" : undefined) }
  };
  globalThis.foundry = {
    utils: { fromUuid: async uuid => (uuid === target.uuid ? target : null) },
    dice: {
      Roll: class {
        constructor(formula, data) {
          this.formula = formula;
          this.data = data;
          this.dice = [{ faces: 20, results: [{ result: 1, active: true }] }];
        }
        async evaluate(options) {
          this.total = totals.shift() ?? total;
          calls.rolls.push({ formula: this.formula, data: this.data, options });
          await faults.afterRoll?.();
          return this;
        }
        async render() {
          return "<div>dice</div>";
        }
        clone() {
          return new this.constructor(this.formula, this.data);
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({ actor: "helper" }),
          getSpeakerActor: () => helper,
          async create(data) {
            if (faults.post) return undefined;
            const m = {
              ...data,
              id: `stabilize${calls.posts.length}`,
              isContentVisible: true,
              whisper: data.whisper ?? [],
              blind: data.blind ?? false,
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
  foundry.applications = {
    handlebars: {
      renderTemplate: async (path, data) => {
        calls.views.push({ path, data });
        return "<article>Check</article>";
      }
    }
  };
  globalThis.ui = {
    notifications: {
      warn: message => {
        calls.warning = message;
      }
    }
  };
  return { helper, target, calls, faults, settings, totals };
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
  assert.equal(message.getFlag("worlds-beyond", "check").stabilizeCheck.applied, false);
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

test("stabilization accepts a tie or Defy Fate, but invalid totals fail", () => {
  assert.equal(stabilizeSuccess(12), true);
  assert.equal(stabilizeSuccess(11), false);
  assert.equal(stabilizeSuccess(1, true), true);
  for (const n of [null, undefined, NaN, Infinity, "20"]) assert.equal(stabilizeSuccess(n), false);
});

test("Stabilize uses helper check penalties and keeps editable dice with unchanged AP cost", async () => {
  const f = fixture({ total: 1 });
  f.helper.statuses.add("poison");
  const result = await stabilize(f.target, f.helper);
  assert.equal(f.calls.rolls[0].formula, "2d20kl1 + @mod");
  assert.equal(f.calls.rolls[0].data.mod, 3);
  assert.equal(result.getFlag("worlds-beyond", "check").actorUuid, f.helper.uuid);
  assert.match(result.getFlag("worlds-beyond", "check").conditionText, /Poisoned/);
  assert.equal(result.getFlag("worlds-beyond", "check").stabilizeCheck.targetUuid, f.target.uuid);
  assert.equal(f.helper.system.ap.value, 17);
  await stabilize(f.target, f.helper, { mode: "advantage" });
  assert.equal(f.calls.rolls[1].formula, "2d20kh1 + @mod");
  assert.equal(f.helper.system.ap.value, 12);
});

test("exhaustion, fear visibility and separate opt-outs select the expected defaults", async () => {
  const f = fixture({ total: 1 });
  f.helper.system.exhaustion = 3;
  await stabilize(f.target, f.helper);
  assert.equal(f.calls.rolls[0].formula, "2d20kl1 + @mod");
  f.settings.set("automateExhaustion", false);
  f.helper.statuses.add("fear");
  await stabilize(f.target, f.helper, { fearInSight: false });
  assert.equal(f.calls.rolls[1].formula, "1d20 + @mod");
  f.helper.statuses.add("poison");
  f.settings.set("automateConditionRolls", false);
  await stabilize(f.target, f.helper);
  assert.equal(f.calls.rolls[2].formula, "1d20 + @mod");
});

test("Wonder retries original dice and INT without more AP; a fresh result can use Wonder again", async () => {
  const f = fixture();
  f.helper.statuses.add("poison");
  f.totals.push(1, 11, 12);
  const first = await stabilize(f.target, f.helper);
  f.helper.statuses.clear();
  f.helper.system.stats.int.mod = 10;
  const retry = await useWonder(first);
  assert.equal(f.calls.rolls[1].formula, "2d20kl1 + @mod");
  assert.equal(f.calls.rolls[1].data.mod, 3);
  assert.equal(retry.getFlag("worlds-beyond", "stabilize").success, false);
  assert.equal(f.target.system.dying.stabilized, false);
  await assert.rejects(useWonder(first), /already used/);
  const success = await useWonder(retry);
  assert.deepEqual(success.getFlag("worlds-beyond", "stabilize"), { targetUuid: f.target.uuid, success: true, applied: false });
  assert.equal(f.helper.system.ap.value, 17);
  assert.equal(f.helper.system.wonder.value, 1);
  await applyStabilized(success);
  assert.equal(f.target.system.dying.stabilized, true);
  assert.equal(f.helper.system.ap.value, 17);
});

test("Defy Fate publishes a successful stabilization receipt without another die or AP payment", async () => {
  const f = fixture({ total: 1 });
  f.helper.system.stats.fth.value = 21;
  const first = await stabilize(f.target, f.helper),
    success = await useWonder(first);
  assert.equal(f.calls.rolls.length, 1);
  assert.equal(success.getFlag("worlds-beyond", "check").success, true);
  assert.equal(success.getFlag("worlds-beyond", "stabilize").success, true);
  assert.equal(success.getFlag("worlds-beyond", "check").stabilizeCheck.applied, false);
  await applyStabilized(success);
  assert.equal(f.target.system.dying.stabilized, true);
  assert.equal(f.helper.system.wonder.value, 2);
  assert.equal(f.helper.system.ap.value, 17);
});

test("failed Wonder posting refunds its use and does not apply stabilization or refund the original AP cost", async () => {
  const f = fixture({ total: 1 });
  f.helper.system.stats.fth.value = 21;
  const first = await stabilize(f.target, f.helper);
  f.faults.post = true;
  await assert.rejects(useWonder(first), /not posted/);
  assert.equal(f.helper.system.wonder.value, 3);
  assert.equal(f.target.system.dying.stabilized, false);
  assert.equal(f.helper.system.ap.value, 17);
  f.faults.post = false;
  const success = await useWonder(first);
  await applyStabilized(success);
  assert.equal(f.helper.system.wonder.value, 2);
  assert.equal(f.target.system.dying.stabilized, true);
});

test("Wonder retains the original patient and cannot stabilize a recovered or missing target", async () => {
  const f = fixture({ total: 1 });
  f.helper.system.stats.fth.value = 21;
  const first = await stabilize(f.target, f.helper);
  const success = await useWonder(first);
  f.target.system.health.value = 1;
  await assert.rejects(applyStabilized(success), /0 Health/);
  assert.equal(f.target.system.dying.stabilized, false);
  foundry.utils.fromUuid = async () => null;
  await assert.rejects(applyStabilized(success), /no longer exists/);
  assert.equal(success.getFlag("worlds-beyond", "stabilize").applied, false);
});

test("blind checks disable interactive dice and Wonder preserves the exact audience", async () => {
  const f = fixture({ total: 1 });
  f.settings.set("messageMode", "blind");
  const first = await stabilize(f.target, f.helper);
  first.whisper = ["gm"];
  first.blind = true;
  assert.equal(f.calls.rolls[0].options.allowInteractive, false);
  const retry = await useWonder(first);
  assert.deepEqual(retry.whisper, ["gm"]);
  assert.equal(retry.blind, true);
  assert.equal(f.calls.rolls[1].options.allowInteractive, false);
});

test("a cancelled Stabilize dialog is free, and a selected mode reaches the actual check", async () => {
  const f = fixture({ total: 1 });
  f.helper.statuses.add("poison");
  let prompt;
  foundry.applications.api = {
    DialogV2: {
      input: async options => {
        prompt = options;
        return null;
      }
    }
  };
  await promptStabilize(f.target, f.helper);
  assert.equal(f.calls.rolls.length, 0);
  assert.equal(f.helper.system.ap.value, 20);
  const context = f.calls.views.at(-1).data;
  assert.equal(context.disadvantage, true);
  assert.equal(context.ap, 5);
  assert.equal(context.targetName, "Patient");
  assert.equal(typeof prompt.render, "function");
  foundry.applications.api.DialogV2.input = async () => ({ mode: "normal" });
  await promptStabilize(f.target, f.helper);
  assert.equal(f.calls.rolls[0].formula, "1d20 + @mod");
});

test("shared cards project the stabilization DC, AP and Wonder outcome", async () => {
  const f = fixture();
  await rollCard(
    { total: 1, render: async () => "dice" },
    {
      label: "Stabilize Patient",
      mode: "normal",
      success: true,
      previousMessageId: "old",
      stabilizeCheck: { targetUuid: f.target.uuid, targetName: "Patient", dc: 12, ap: 5, applied: false }
    }
  );
  const view = f.calls.views.at(-1);
  assert.match(view.path, /roll-card.hbs$/);
  assert.equal(view.data.stabilizeCheck.success, true);
  assert.equal(view.data.stabilizeCheck.reroll, true);
  assert.equal(view.data.stabilizeCheck.ap, 5);
});
