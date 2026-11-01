import { test } from "node:test";
import assert from "node:assert/strict";
class Sheet {
  constructor(options = {}) { this.document = options.document; }
  async _prepareContext() { return {}; }
  async _onRender() {}
  async render(options) { this.renderOptions = options; this.renders = (this.renders ?? 0) + 1; return this; }
  async close() { this.closed = true; }
}
globalThis.foundry = { applications: { api: { DocumentSheetV2: Sheet, HandlebarsApplicationMixin: base => base } } };
const { MilestoneSheet, openMilestones } = await import("../module/milestone-sheet.mjs");

test("reference opens the selected diamond; repeated opens reuse the actor window; All clears selection", async () => {
  const actor = { name: "Hero", system: { stats: { str: { effective: 21 }, vit: { effective: 28 } } } };
  const window = await openMilestones(actor, "str", "21");
  let context = await window._prepareContext({});
  assert.equal(window.title, "Hero: Milestones"); assert.equal(context.unlocked, 3); assert.equal(context.total, 16);
  assert.deepEqual(context.groups.map(group => group.key), ["str"]);
  assert.deepEqual(context.groups[0].rows.map(row => row.focused), [true, false]);
  assert.equal(await openMilestones(actor, "vit", 28), window);
  context = await window._prepareContext({});
  assert.deepEqual(context.groups[0].rows.map(row => row.focused), [false, true]);
  assert.equal(await openMilestones(actor), window);
  context = await window._prepareContext({}); assert.equal(context.groups.length, 8);
  assert.ok(context.groups.every(group => group.rows.every(row => !row.focused)));
  assert.notEqual(await openMilestones({ ...actor }), window);
});

test("refresh reads current actor data; filtering is local and form submission never updates an actor", async () => {
  let writes = 0, listener;
  const actor = { system: { stats: { agl: { effective: 28 } } }, update: () => { writes++; } };
  const window = await openMilestones(actor);
  window.element = { querySelector: () => ({ addEventListener: (type, callback) => { assert.equal(type, "change"); listener = callback; } }) };
  await window._onRender({}, {});
  listener({ target: { value: "agl" } });
  let context = await window._prepareContext({}); assert.equal(context.unlocked, 2); assert.equal(context.groups.length, 1);
  actor.system.stats.agl.effective = 20;
  context = await window._prepareContext({}); assert.equal(context.unlocked, 0);
  listener({ target: { value: "invalid" } }); assert.equal(window.statKey, "");
  assert.deepEqual(await window._processSubmitData(null, null, { name: "Should not save" }), {});
  assert.equal(writes, 0);
  assert.equal(MilestoneSheet.DEFAULT_OPTIONS.tag, "div", "read-only document disabling cannot disable reference controls");
  assert.equal(MilestoneSheet.DEFAULT_OPTIONS.canImport, false);
  await MilestoneSheet.DEFAULT_OPTIONS.actions.closeReference.call(window); assert.equal(window.closed, true);
});

test("a requested diamond reopens its preserved disclosure and scrolls it into view", async () => {
  const window = await openMilestones({ system: {} }, "wis", 28);
  let scrolled = false;
  const entry = { open: false, scrollIntoView: options => { assert.equal(options.block, "nearest"); scrolled = true; } };
  window.element = { querySelector: selector => selector.includes("data-milestone-id") ? entry : { addEventListener() {} } };
  await window._onRender({}, {});
  assert.equal(entry.open, true); assert.equal(scrolled, true); assert.equal(window.focusRequested, false);
});
