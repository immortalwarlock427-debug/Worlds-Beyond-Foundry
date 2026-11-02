import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.foundry = { abstract: { TypeDataModel: class {} }, applications: { api: { DocumentSheetV2: class {}, HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: class {} } } };
const { captureFormTriggers, processFormTriggers } = await import("../module/form-triggers.mjs");
const { useAbility } = await import("../module/abilities.mjs");
const id = "resource00000001";
const set = (target, path, value) => { const keys = path.split('.'), last = keys.pop(); keys.reduce((entry, key) => entry[key] ??= {}, target)[last] = value; };
function fixture() {
  const posts = [], warnings = [], jobs = [], dialogs = [];
  globalThis.game = { user: { id: "owner" }, combats: [], settings: { get: () => "public" } };
  globalThis.ui = { notifications: { warn: value => warnings.push(value) } };
  Object.assign(foundry, { documents: { ChatMessage: { implementation: { getSpeaker: () => ({}), async create(data) { posts.push(data); return data; } } } } });
  Object.assign(foundry.applications.api, { DialogV2: { confirm: async data => { dialogs.push(data); return false; }, input: async data => { dialogs.push(data); return { form: "1" }; } } });
  const actor = { uuid: "Actor.trigger", type: "character", isOwner: true, items: new Map(), effects: new Map(),
    system: { ap: { value: 15 }, stats: {}, customResources: { [id]: { name: "Blood", max: 100, value: 100, spent: 0, allowOverflow: true } } },
    async update(changes, options = {}) {
      captureFormTriggers(this, changes, options, "owner");
      for (const [key, value] of Object.entries(changes)) set(this, key, value);
      this.system.customResources[id].value = 100 - this.system.customResources[id].spent;
      const job = processFormTriggers(this, changes, options, "owner"); if (job) jobs.push(job);
      return this;
    }
  };
  const form = (name = "Beast") => {
    const item = { id: name, name, type: "ability", effects: [], system: { kind: "form", effectsActive: false, apCost: 5, apDiscountStat: "", resourceCost: null, resourceId: "", uses: { max: null, spent: 0 }, cooldown: { rounds: null, remaining: 0 },
      trigger: { mode: "automatic", resourceId: id, comparison: "above", threshold: 100, endMode: "stay" } },
      async update(changes) { for (const [key, value] of Object.entries(changes)) set(this, key, value); return this; }
    }; actor.items.set(item.id, item); return item;
  };
  return { actor, form, posts, warnings, jobs, dialogs, async drain() { let count = 0; while (count < jobs.length) await jobs[count++]; } };
}

test("native resource update enters an automatic form once, honors entry cost and suppresses recursive cost triggers", async () => {
  const f = fixture(), form = f.form();
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(form.system.effectsActive, true); assert.equal(f.actor.system.ap.value, 10); assert.equal(f.posts.length, 1); assert.equal(f.warnings.length, 0);
  await useAbility(f.actor, form.id, { end: true });
  await f.actor.update({ [`system.customResources.${id}.spent`]: -6 }); await f.drain();
  assert.equal(form.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 10);
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 }); await f.drain();
  await f.actor.update({ [`system.customResources.${id}.spent`]: -1 }); await f.drain();
  assert.equal(form.system.effectsActive, true); assert.equal(f.actor.system.ap.value, 5);
});

test("optional trigger ending is free and keeps the user's over-cap resource value rather than changing its maximum", async () => {
  const f = fixture(), form = f.form(); form.system.trigger.endMode = "automatic";
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(f.actor.system.customResources[id].value, 105); assert.equal(f.actor.system.customResources[id].max, 100);
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 }); await f.drain();
  assert.equal(form.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 10);
});

test("Ask first can cancel without paying, and multiple matching forms choose one instead of paying for both", async () => {
  let f = fixture(), a = f.form(); a.system.trigger.mode = "prompt";
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(a.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 15); assert.equal(f.dialogs.length, 1);
  f = fixture(); a = f.form("A"); const b = f.form("B");
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(a.system.effectsActive, false); assert.equal(b.system.effectsActive, true); assert.equal(f.actor.system.ap.value, 10); assert.equal(f.posts.length, 1);
});

test("insufficient AP reports the trigger failure without consuming resources or forcing the form", async () => {
  const f = fixture(), form = f.form(); f.actor.system.ap.value = 4;
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(form.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 4); assert.equal(f.actor.system.customResources[id].value, 105);
  assert.match(f.warnings[0], /Not enough AP/);
});

test("the requested Ask-first entry and exit prompts keep the form when ending is declined", async () => {
  const f = fixture(), form = f.form(); form.system.trigger.mode = "prompt"; form.system.trigger.endMode = "prompt";
  const answers = [true, false, true];
  foundry.applications.api.DialogV2.confirm = async data => { f.dialogs.push(data); return answers.shift(); };
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 }); await f.drain();
  assert.equal(form.system.effectsActive, true); assert.equal(f.actor.system.ap.value, 10);
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 }); await f.drain();
  assert.equal(form.system.effectsActive, true); assert.match(f.dialogs[1].window.title, /End transformation/);
  // Unrelated updates below the threshold must not nag again.
  await f.actor.update({ "system.ap.value": 9 }); await f.drain(); assert.equal(f.dialogs.length, 2);
  await f.actor.update({ [`system.customResources.${id}.spent`]: -1 }); await f.drain();
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 }); await f.drain();
  assert.equal(form.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 9);
});

test("an entry prompt rechecks the current value before paying if the resource changes while it is open", async () => {
  const f = fixture(), form = f.form(); form.system.trigger.mode = "prompt";
  let confirm;
  foundry.applications.api.DialogV2.confirm = () => new Promise(resolve => { confirm = resolve; });
  await f.actor.update({ [`system.customResources.${id}.spent`]: -5 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(typeof confirm, "function");
  await f.actor.update({ [`system.customResources.${id}.spent`]: 0 }); confirm(true); await f.drain();
  assert.equal(form.system.effectsActive, false); assert.equal(f.actor.system.ap.value, 15);
});

test("remote clients, observers and trigger-generated updates never execute the same crossing again", () => {
  const f = fixture(); f.form(); const options = {};
  captureFormTriggers(f.actor, {}, options, "another-client"); assert.equal(options.worldsBeyondFormBefore, undefined);
  f.actor.isOwner = false; captureFormTriggers(f.actor, {}, options, "owner"); assert.equal(options.worldsBeyondFormBefore, undefined);
  f.actor.isOwner = true; const triggered = { worldsBeyondFormTrigger: true }; captureFormTriggers(f.actor, {}, triggered, "owner"); assert.equal(triggered.worldsBeyondFormBefore, undefined);
});
