import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { documents: { Combatant: class {} } };
const { registerCombatPortraits } = await import("../module/character-combatant.mjs");

function fixture() {
  const calls = [];
  // Replay the installed v14.365 post-render scroll branch. A failed find
  // becomes undefined before `in`, reproducing the native exception.
  class NativeTracker {
    viewed = { id: "viewed" };
    scrolls = 0;
    async _onRender(context, options) {
      calls.push({ context, options });
      if (this.failure) throw this.failure;
      const { parts, renderContext, renderData } = options;
      let data = {};
      if (Array.isArray(renderData)) data = renderData.find(d => d._id === this.viewed?.id);
      if (parts.includes("tracker") && renderContext === "updateCombat" && "turn" in data) this.scrolls++;
      return "rendered";
    }
  }
  globalThis.CONFIG = { ui: { combat: NativeTracker } };
  globalThis.Hooks = { on() {} };
  registerCombatPortraits();
  return { native: new NativeTracker(), tracker: new CONFIG.ui.combat(), calls };
}

const update = data => ({ parts: ["tracker"], renderContext: "updateCombat", renderData: data, force: false });

test("an unrelated encounter update reproduces the native error but renders through the system subclass", async () => {
  const f = fixture();
  const data = Object.freeze([Object.freeze({ _id: "inactive", turn: 1 })]);
  const options = Object.freeze(update(data));
  await assert.rejects(f.native._onRender({}, options), TypeError);
  const context = { combat: "viewed" };
  assert.equal(await f.tracker._onRender(context, options), "rendered");
  assert.equal(f.tracker.scrolls, 0);
  const passed = f.calls.at(-1);
  assert.equal(passed.context, context);
  assert.equal(passed.options.renderData, data);
  assert.equal(passed.options.parts, options.parts);
  assert.equal(options.renderContext, "updateCombat", "other hooks keep their original metadata");
  assert.equal(passed.options.renderContext, undefined);
  assert.equal(passed.options.force, false);
});

test("the viewed encounter's turn update keeps the untouched native options and scrolling", async () => {
  const f = fixture(),
    options = update([{ _id: "viewed", turn: 0 }]);
  await f.tracker._onRender({}, options);
  assert.equal(f.tracker.scrolls, 1);
  assert.equal(f.calls.at(-1).options, options);
});

test("a mixed update batch still finds and scrolls the displayed encounter", async () => {
  const f = fixture(),
    options = update([
      { _id: "other", round: 2 },
      { _id: "viewed", turn: 1 }
    ]);
  await f.tracker._onRender({}, options);
  assert.equal(f.tracker.scrolls, 1);
  assert.equal(f.calls.at(-1).options, options);
});

test("empty update arrays and a tracker with no viewed encounter render without scrolling", async () => {
  const f = fixture();
  await f.tracker._onRender({}, update([]));
  f.tracker.viewed = null;
  await f.tracker._onRender({}, update([{ _id: "removed", turn: 1 }]));
  assert.equal(f.calls.length, 2);
  assert.equal(f.tracker.scrolls, 0);
});

test("ordinary portrait refreshes, header-only updates and viewed updates without a turn pass through", async () => {
  const f = fixture();
  for (const options of [
    { parts: ["tracker"], renderContext: "updateActor", renderData: [{ _id: "actor" }] },
    { parts: ["header"], renderContext: "updateCombat", renderData: [{ _id: "other", turn: 1 }] },
    update([{ _id: "viewed", round: 4 }]),
    { parts: ["tracker"], renderContext: "updateCombat" },
    { parts: ["tracker"] }
  ]) {
    await f.tracker._onRender({}, options);
    assert.equal(f.calls.at(-1).options, options);
  }
  assert.equal(f.tracker.scrolls, 0);
});

test("unrelated parent-render failures still propagate instead of being hidden", async () => {
  const f = fixture(),
    failure = Error("template failed");
  f.tracker.failure = failure;
  await assert.rejects(f.tracker._onRender({}, update([{ _id: "other", turn: 1 }])), error => error === failure);
});
