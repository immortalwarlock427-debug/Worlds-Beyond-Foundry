import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceConditions,
  conditionSource,
  conditionSourceText,
  validConditionSourceUuid,
  sameGrappleSource
} from "../module/condition-sources-core.mjs";
import {
  resolveConditionSource,
  conditionSourceChoices,
  linkedGrappler,
  setConditionSource,
  promptConditionSource
} from "../module/condition-sources.mjs";
import { effectContext } from "../module/effects-core.mjs";

function fixture() {
  const calls = { updates: [], dialogs: [], cancel: false };
  const source = {
    documentName: "Actor",
    uuid: "Actor.grappler",
    name: "Grappler",
    system: { stats: { str: { mod: 4 } } },
    observer: true,
    limited: true,
    testUserPermission(_u, permission) {
      return permission === "OBSERVER" ? this.observer : this.limited;
    }
  };
  const synthetic = { ...source, uuid: "Scene.scene.Token.one.Actor.copy", name: "Exact copy", system: { stats: { str: { mod: 7 } } } };
  const scene = { id: "scene", name: "Map" };
  const token = {
    documentName: "Token",
    uuid: "Scene.scene.Token.one",
    name: "Token grappler",
    actor: synthetic,
    parent: scene,
    hidden: false,
    object: { visible: true }
  };
  const actor = { documentName: "Actor", type: "character", uuid: "Actor.victim", isOwner: true, system: {}, items: [], effects: [] };
  const effect = {
    id: "hold",
    uuid: "Actor.victim.ActiveEffect.hold",
    parent: actor,
    name: "Grappled",
    statuses: new Set(["grappled", "fear"]),
    disabled: false,
    flags: { "worlds-beyond": { condition: { sourceName: "Original", sourceLevel: 8 }, retained: true } },
    system: { changes: [] },
    async update(changes) {
      calls.updates.push(changes);
      if (calls.cancel) return undefined;
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split("."),
          key = parts.pop(),
          parent = parts.reduce((o, k) => (o[k] ??= {}), this);
        if (key.startsWith("-=")) delete parent[key.slice(2)];
        else parent[key] = value;
      }
      return this;
    }
  };
  actor.effects.push(effect);
  const docs = new Map([
    [source.uuid, source],
    [token.uuid, token]
  ]);
  globalThis.game = { user: { id: "owner", isGM: false }, actors: [source] };
  globalThis.canvas = { scene: { ...scene, tokens: [token] } };
  globalThis.foundry = {
    utils: { fromUuidSync: uuid => docs.get(uuid) },
    applications: {
      api: {
        DialogV2: {
          input: async options => {
            calls.dialogs.push(options);
            return null;
          }
        }
      }
    }
  };
  return { calls, source, synthetic, token, actor, effect, docs };
}

test("source metadata is explicit per supported condition and never guesses from name, origin or unrelated flags", () => {
  const f = fixture();
  assert.deepEqual(sourceConditions(f.effect), ["grappled", "fear"]);
  assert.equal(conditionSource(f.effect, "grappled"), null);
  f.effect.origin = f.source.uuid;
  assert.equal(conditionSource(f.effect, "grappled"), null);
  f.effect.flags["worlds-beyond"].conditionSources = {
    grappled: { uuid: f.token.uuid, name: "Exact copy" },
    fear: { uuid: "Item.other", name: "Not an actor" }
  };
  assert.deepEqual(conditionSource(f.effect, "grappled"), { uuid: f.token.uuid, name: "Exact copy" });
  assert.equal(conditionSource(f.effect, "fear"), null);
  assert.equal(conditionSource(f.effect, "poison"), null);
  assert.equal(conditionSourceText(f.effect), "Grappled from Exact copy");
  for (const uuid of ["Actor.one", "Scene.map.Token.one"]) assert.equal(validConditionSourceUuid(uuid), true);
  for (const uuid of ["https://example.com", "Actor.one.Item.two", "Scene.map.Token.one.Actor.two", null, "Actor.<bad>"])
    assert.equal(validConditionSourceUuid(uuid), false);
});

test("token links resolve their exact synthetic actor, including current STR rather than a world-actor fallback", async () => {
  const f = fixture();
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.token.uuid);
  assert.equal(resolveConditionSource(f.token.uuid).actor, f.synthetic);
  assert.equal(linkedGrappler(f.effect).modifier, 7);
  f.synthetic.system.stats.str.mod = 9;
  assert.equal(linkedGrappler(f.effect).modifier, 9);
  f.docs.delete(f.token.uuid);
  assert.equal(linkedGrappler(f.effect), null, "never substitute the world actor");
});

test("links preserve other conditions/bonuses and clearing one composite condition preserves the other source", async () => {
  const f = fixture();
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid);
  await setConditionSource(f.actor, f.effect.uuid, "fear", f.token.uuid);
  await setConditionSource(f.actor, f.effect.uuid, "grappled", "");
  assert.equal(conditionSource(f.effect, "grappled"), null);
  assert.equal(conditionSource(f.effect, "fear").uuid, f.token.uuid);
  assert.deepEqual([...f.effect.statuses], ["grappled", "fear"]);
  assert.deepEqual(f.effect.flags["worlds-beyond"].condition, { sourceName: "Original", sourceLevel: 8 });
  assert.equal(f.effect.flags["worlds-beyond"].retained, true);
});

test("picker lists visible exact tokens/limited characters, retains missing selection without leaking hidden names, and uses observable stats only", async () => {
  const f = fixture();
  assert.equal(conditionSourceChoices().length, 2);
  f.token.hidden = true;
  f.source.limited = false;
  const choices = conditionSourceChoices(f.token.uuid);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].label, "Existing source (unavailable here)");
  assert.equal(choices[0].selected, true);
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", f.token.uuid), /no longer available/);
  f.token.hidden = false;
  f.source.limited = true;
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid);
  f.source.observer = false;
  assert.equal(linkedGrappler(f.effect), null);
  f.source.observer = true;
  f.source.system.stats.str.mod = "4";
  assert.equal(linkedGrappler(f.effect), null, "unknown/non-native stats require manual input");
});

test("source writes reject deleted effects, unrelated statuses, missing sources, read-only actors, cancellation and stale dialog snapshots", async () => {
  const f = fixture();
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "poison", f.source.uuid), /no longer/);
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", "Actor.missing"), /no longer available/);
  f.actor.isOwner = false;
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid), /cannot be edited/);
  f.actor.isOwner = true;
  f.calls.cancel = true;
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid), /not saved/);
  f.calls.cancel = false;
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid);
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", f.token.uuid, { expectedUuid: "" }), /another window/);
  assert.equal(conditionSource(f.effect, "grappled").uuid, f.source.uuid);
  f.actor.effects = [];
  await assert.rejects(setConditionSource(f.actor, f.effect.uuid, "grappled", f.token.uuid), /no longer exists/);
});

test("Source editor supports composite conditions, escapes labels and does not save when cancelled", async () => {
  const f = fixture();
  f.source.name = '<img src=x onerror="bad">';
  await promptConditionSource(f.actor, f.effect.uuid);
  const content = f.calls.dialogs[0].content;
  assert.match(content, /Grappled source/);
  assert.match(content, /Frightened source/);
  assert.match(content, /&lt;img/);
  assert.doesNotMatch(content, /<img src/);
  assert.equal(f.calls.updates.length, 0);
  foundry.applications.api.DialogV2.input = async () => ({ grappled: f.token.uuid, fear: f.source.uuid });
  await promptConditionSource(f.actor, f.effect.uuid);
  assert.equal(conditionSource(f.effect, "grappled").uuid, f.token.uuid);
  assert.equal(conditionSource(f.effect, "fear").uuid, f.source.uuid);
});

test("Status offers Source only for direct relevant native effects and shows the recorded name", async () => {
  const f = fixture();
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid);
  let row = effectContext(f.actor).statuses[0];
  assert.equal(row.canSetSource, true);
  assert.equal(row.conditionSourceText, "Grappled from Grappler");
  f.effect.statuses = new Set(["fear", "grappled"]);
  row = effectContext(f.actor).statuses[0];
  assert.equal(row.endAction.id, "grappled", "composite order must not hide Escape");
  f.effect.statuses = new Set(["poison"]);
  row = effectContext(f.actor).statuses[0];
  assert.equal(row.canSetSource, false);
  assert.equal(row.conditionSourceText, "");
});

test("old Wonder cards retain compatibility; source snapshots reject a replacement on the same effect record", async () => {
  const f = fixture();
  assert.equal(sameGrappleSource(f.effect), true);
  assert.equal(sameGrappleSource(f.effect, { hold: "" }), true);
  await setConditionSource(f.actor, f.effect.uuid, "grappled", f.source.uuid);
  assert.equal(sameGrappleSource(f.effect, { hold: "" }), false);
  assert.equal(sameGrappleSource(f.effect, { hold: f.source.uuid }), true);
  assert.equal(sameGrappleSource(f.effect, {}), false);
});
