import { test } from "node:test";
import assert from "node:assert/strict";
import {
  overviewFill,
  favoriteSlots,
  favoriteSelection,
  configureFavorites,
  archiveAppearance,
  configureArchive
} from "../module/overview.mjs";
function fixture() {
  const posts = [],
    dialogs = [];
  const actor = {
    uuid: "Actor.favorites",
    documentName: "Actor",
    type: "character",
    isOwner: true,
    effects: [],
    items: new Map(),
    system: { favorites: [], stats: { int: { mod: 2 } } },
    async update(data) {
      posts.push(data);
      this.system.favorites = structuredClone(data["system.favorites"]);
      return this;
    }
  };
  for (const [id, kind] of [
    ["spell", "active"],
    ["form", "form"],
    ["passive", "passive"]
  ])
    actor.items.set(id, {
      id,
      name: `${id} <test>`,
      type: "ability",
      system: { kind, apCost: 11, apDiscountStat: "int", uses: { max: 3, spent: 1 } },
      effects: []
    });
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          input: async options => {
            dialogs.push(options);
            return null;
          }
        }
      }
    }
  };
  return { actor, posts, dialogs };
}
test("overview meters retain fractional geometry while clamping excess, deficits and unavailable maxima", () => {
  assert.equal(overviewFill({ value: 49.5, max: 100 }), 49.5);
  assert.equal(overviewFill({ value: 110, max: 100 }), 100);
  assert.equal(overviewFill({ value: -3, max: 100 }), 0);
  assert.equal(overviewFill({ value: 10, max: 0 }), 0);
  assert.equal(overviewFill({ max: 100 }), 0);
});
test("four stable favorite slots use current costs/state and preserve source counters, including removed abilities", () => {
  const { actor } = fixture();
  actor.system.favorites = ["spell", "passive", "removed", "form"];
  actor.items.get("form").system.effectsActive = true;
  const before = JSON.stringify(actor.system),
    rows = favoriteSlots(actor);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].id, "spell");
  assert.equal(rows[0].ap, 9);
  assert.equal(rows[0].operation, "use");
  assert.equal(rows[1].operation, "edit");
  assert.equal(rows[2].missing, true);
  assert.equal(rows[3].operation, "end");
  assert.equal(JSON.stringify(actor.system), before);
  assert.equal(actor.items.get("spell").system.uses.spent, 1);
});
test("saved legacy abilities/forms remain favoriteable by exact UUID and use the existing source actions", () => {
  const { actor } = fixture();
  const effect = {
    id: "old",
    uuid: "Actor.favorites.ActiveEffect.old",
    parent: actor,
    name: "Old form",
    disabled: false,
    flags: { "worlds-beyond": { managed: true, kind: "form" } },
    system: { changes: [] }
  };
  actor.effects = [effect];
  actor.system.favorites = [effect.uuid];
  const row = favoriteSlots(actor)[0];
  assert.equal(row.legacy, true);
  assert.equal(row.uuid, effect.uuid);
  assert.equal(row.operation, "end");
  assert.deepEqual(favoriteSelection(actor, { slot0: effect.uuid }), [effect.uuid, "", "", ""]);
});
test("selection validates exact owned definitions and duplicate slots without modifying other data", () => {
  const { actor } = fixture();
  assert.deepEqual(favoriteSelection(actor, { slot0: "form", slot2: "spell" }), ["form", "", "spell", ""]);
  assert.throws(() => favoriteSelection(actor, { slot0: "spell", slot1: "spell" }), /only once/);
  assert.throws(() => favoriteSelection(actor, { slot0: "missing" }), /no longer exists/);
  assert.deepEqual(actor.system.favorites, []);
});
test("favorite configuration escapes names, cancellation writes nothing, and Save changes only the four references", async () => {
  const f = fixture();
  await configureFavorites(f.actor);
  assert.equal(f.posts.length, 0);
  assert.match(f.dialogs[0].content, /spell &lt;test&gt;/);
  assert.equal((f.dialogs[0].content.match(/<select/g) || []).length, 4);
  foundry.applications.api.DialogV2.input = async () => ({ slot0: "spell", slot1: "form" });
  await configureFavorites(f.actor);
  assert.deepEqual(f.posts, [{ "system.favorites": ["spell", "form", "", ""] }]);
  await configureFavorites(f.actor);
  assert.equal(f.posts.length, 1, "unchanged preferences do not write");
});
test("observer/lost permission, removed selections and ignored updates cannot report a successful save", async () => {
  let f = fixture();
  f.actor.isOwner = false;
  await configureFavorites(f.actor);
  assert.equal(f.dialogs.length, 0);
  f = fixture();
  foundry.applications.api.DialogV2.input = async () => {
    f.actor.isOwner = false;
    return { slot0: "spell" };
  };
  await configureFavorites(f.actor);
  assert.equal(f.posts.length, 0);
  f = fixture();
  foundry.applications.api.DialogV2.input = async () => {
    f.actor.items.delete("spell");
    return { slot0: "spell" };
  };
  await assert.rejects(configureFavorites(f.actor), /no longer exists/);
  assert.equal(f.posts.length, 0);
  f = fixture();
  foundry.applications.api.DialogV2.input = async () => ({ slot0: "spell" });
  f.actor.update = async () => f.actor;
  await assert.rejects(configureFavorites(f.actor), /not saved/);
});

function appearanceFixture() {
  const f = fixture();
  f.actor.img = 'portrait".png';
  f.actor.system.appearance = { baseFormName: "", portraitY: 35 };
  f.actor.update = async data => {
    f.posts.push(data);
    for (const [path, value] of Object.entries(data)) f.actor.system.appearance[path.split(".").pop()] = value;
    return f.actor;
  };
  const form = f.actor.items.get("form");
  form.system.loadout = { portraitY: null };
  form.update = async data => {
    f.posts.push(data);
    form.system.loadout.portraitY = data["system.loadout.portraitY"];
    return form;
  };
  return { ...f, form };
}
test("archive appearance inherits Base framing, uses separate form framing and preserves data on reads", () => {
  const { actor, form } = appearanceFixture(),
    before = structuredClone(actor.system);
  assert.deepEqual(archiveAppearance(actor), { baseFormName: "Base Form", portraitY: 35, formId: "" });
  form.system.effectsActive = true;
  assert.equal(archiveAppearance(actor).portraitY, 35);
  form.system.loadout.portraitY = 70;
  assert.equal(archiveAppearance(actor).portraitY, 70);
  form.system.effectsActive = false;
  assert.equal(archiveAppearance(actor).portraitY, 35);
  assert.deepEqual(actor.system, before);
});
test("appearance saves only Base label/framing, supports reset label and cancellation, escaping previews", async () => {
  const f = appearanceFixture();
  await configureArchive(f.actor);
  assert.equal(f.posts.length, 0);
  assert.match(f.dialogs[0].content, /portrait&quot;.png/);
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: " Human Form ", portraitY: "62.8" });
  await configureArchive(f.actor);
  assert.deepEqual(f.posts, [{ "system.appearance.baseFormName": "Human Form", "system.appearance.portraitY": 62 }]);
  await configureArchive(f.actor);
  assert.equal(f.posts.length, 1);
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: "", portraitY: "62" });
  await configureArchive(f.actor);
  assert.equal(archiveAppearance(f.actor).baseFormName, "Base Form");
});
test("form framing never rewrites Base crop, artwork, stats or balances; changed forms require reopening", async () => {
  const f = appearanceFixture();
  f.form.system.effectsActive = true;
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: "", portraitY: "80" });
  await configureArchive(f.actor);
  assert.deepEqual(f.posts, [{ "system.loadout.portraitY": 80 }]);
  assert.equal(f.actor.system.appearance.portraitY, 35);
  assert.equal(f.actor.img, 'portrait".png');
  foundry.applications.api.DialogV2.input = async () => {
    f.form.system.effectsActive = false;
    return { baseFormName: "Changed", portraitY: "10" };
  };
  await assert.rejects(configureArchive(f.actor), /current form changed/);
  assert.equal(f.posts.length, 1);
});
test("appearance rejects invalid framing and ignored saves, compensates partial saves, and respects lost permission", async () => {
  let f = appearanceFixture();
  f.actor.isOwner = false;
  await configureArchive(f.actor);
  assert.equal(f.dialogs.length, 0);
  f = appearanceFixture();
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: "", portraitY: "101" });
  await assert.rejects(configureArchive(f.actor), /between 0 and 100/);
  assert.equal(f.posts.length, 0);
  f = appearanceFixture();
  foundry.applications.api.DialogV2.input = async () => {
    f.actor.isOwner = false;
    return { baseFormName: "Hidden", portraitY: "80" };
  };
  await configureArchive(f.actor);
  assert.equal(f.posts.length, 0);
  f = appearanceFixture();
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: "Human Form", portraitY: "80" });
  f.actor.update = async () => f.actor;
  await assert.rejects(configureArchive(f.actor), /not saved/);
  f = appearanceFixture();
  f.form.system.effectsActive = true;
  foundry.applications.api.DialogV2.input = async () => ({ baseFormName: "Human Form", portraitY: "80" });
  f.form.update = async () => {
    throw new Error("form update failed");
  };
  await assert.rejects(configureArchive(f.actor), /form update failed/);
  assert.equal(f.actor.system.appearance.baseFormName, "", "Base label is restored if form framing fails");
});
