import { test } from "node:test";
import assert from "node:assert/strict";
import { fearDistance, approachesFear, fearSightDefault } from "../module/frightened-core.mjs";
import {
  frightenedInSight,
  frightenedMovementBlock,
  fearLineOfSight,
  fearObserver,
  fearSourceToken,
  registerFrightened
} from "../module/frightened.mjs";
import { actorConditionRoll, defaultCheckMode, conditionControls } from "../module/condition-rolls.mjs";
import { rollStatCheck } from "../module/roll-actions.mjs";
import { registerMovement } from "../module/movement.mjs";
import { rollAbilityStrike } from "../module/ability-strikes.mjs";

const box = (x, y, w = 1, h = 1) => ({ x, y, w, h });
function fixture() {
  const settings = {},
    calls = { collisions: [], rolls: [], posts: [] };
  const scene = {
    id: "map",
    grid: { size: 100, distance: 5, isSquare: true, isHexagonal: false },
    levels: new Map([["ground", {}]]),
    tokens: []
  };
  const actor = {
    documentName: "Actor",
    type: "character",
    uuid: "Actor.hero",
    name: "Hero",
    statuses: new Set(["fear"]),
    effects: [],
    system: { stats: { str: { mod: 0 } }, exhaustion: 0, equipment: {} },
    isOwner: true
  };
  const sourceActor = { documentName: "Actor", uuid: "Actor.source", name: "Source", statuses: new Set() };
  const observer = {
    documentName: "Token",
    uuid: "Scene.map.Token.hero",
    id: "hero",
    actor,
    parent: scene,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    level: "ground",
    movementAction: "walk",
    hidden: false,
    object: {
      checkCollision(point, options) {
        calls.collisions.push({ point, options });
        return calls.blocked ?? false;
      }
    }
  };
  const source = {
    documentName: "Token",
    uuid: "Scene.map.Token.source",
    id: "source",
    actor: sourceActor,
    parent: scene,
    x: 500,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    level: "ground",
    hidden: false,
    getVisibilityTestPoints: () => [
      { x: 550, y: 50, elevation: 2.5 },
      { x: 501, y: 1, elevation: 2.5 }
    ]
  };
  scene.tokens = [observer, source];
  const effect = {
    id: "fear",
    statuses: new Set(["fear"]),
    disabled: false,
    flags: { "worlds-beyond": { conditionSources: { fear: { uuid: source.uuid, name: source.name } } } }
  };
  actor.effects.push(effect);
  const docs = new Map([
    [actor.uuid, actor],
    [sourceActor.uuid, sourceActor],
    [source.uuid, source]
  ]);
  globalThis.canvas = { scene, tokens: { controlled: [] } };
  globalThis.game = {
    user: { id: "owner" },
    combats: [],
    settings: {
      get: (_s, k) => (k === "messageMode" ? "public" : settings[k]),
      register: (_s, k, d) => {
        calls.setting = { key: k, ...d };
      }
    }
  };
  globalThis.CONFIG = { Token: { movement: { actions: { teleport: { teleport: true }, displace: { teleport: true } } } } };
  globalThis.foundry = {
    utils: { fromUuidSync: uuid => docs.get(uuid) },
    applications: { handlebars: { renderTemplate: async () => "card" } },
    dice: {
      Roll: class {
        constructor(formula) {
          this.formula = formula;
          this.dice = [{ faces: 20, total: 10, results: [{ result: 10, active: true }] }];
        }
        async evaluate() {
          calls.rolls.push(this.formula);
          this.total = 10;
          return this;
        }
        async render() {
          return "roll";
        }
        async toMessage(data) {
          calls.posts.push(data);
          return data;
        }
      }
    },
    documents: {
      ChatMessage: {
        implementation: {
          getSpeaker: () => ({}),
          create: async data => {
            calls.posts.push(data);
            return data;
          }
        }
      }
    }
  };
  const movement = (points, origin = { x: 0, y: 0, elevation: 0, level: "ground" }) => ({
    origin,
    passed: { waypoints: points },
    pending: { waypoints: [] }
  });
  return { actor, sourceActor, observer, source, effect, scene, docs, calls, settings, movement };
}

test("fear footprint distances match square-grid reach, including diagonal and large tokens", () => {
  assert.equal(fearDistance(box(0, 0), box(5, 3)), 5);
  assert.equal(fearDistance(box(0, 0, 2, 2), box(5, 3)), 4);
  assert.equal(fearDistance(box(0, 0, 3, 3), box(1, 1)), 0);
  assert.equal(approachesFear(box(0, 0), box(1, 0), box(5, 0)), true);
  assert.equal(approachesFear(box(0, 0), box(-1, 0), box(5, 0)), false);
  assert.equal(approachesFear(box(0, 0), box(0, 4), box(5, 0)), false);
});

test("a path that passes closer then ends farther is blocked, but an instant teleport tests only the destination", () => {
  const a = box(0, 0),
    b = box(12, 0),
    source = box(5, 0);
  assert.equal(approachesFear(a, b, source), true);
  assert.equal(approachesFear(a, b, source, { teleport: true }), false);
  assert.equal(approachesFear(a, box(2, 0), source, { teleport: true }), true);
  assert.equal(approachesFear(box(0, 0), box(10, 5), box(5, 0)), true);
  assert.equal(approachesFear(box(0, 0), box(0, 0), source), false);
});

test("sight aggregation stays manual for unknown sources and needs every known source occluded to remove fear", () => {
  assert.equal(fearSightDefault([]), true);
  assert.equal(fearSightDefault([false, false]), false);
  assert.equal(fearSightDefault([false, null]), true);
  assert.equal(fearSightDefault([false, true]), true);
});

test("linked sight uses the actor token's sight collision, not GM visibility, and tests multiple points", () => {
  const f = fixture();
  assert.equal(frightenedInSight(f.actor), true);
  assert.deepEqual(f.calls.collisions[0].options, { type: "sight", mode: "any" });
  f.calls.blocked = true;
  assert.equal(frightenedInSight(f.actor), false);
  assert.equal(conditionControls(f.actor).fearInSight, false);
  f.observer.object.checkCollision = point => point.x === 550;
  assert.equal(fearLineOfSight(f.observer, f.source), true, "one unobstructed point suffices");
});

test("missing/ambiguous sources, blindness/invisibility, levels, backend failures and off-scene data stay manual", () => {
  const f = fixture();
  f.calls.blocked = true;
  f.docs.delete(f.source.uuid);
  assert.equal(frightenedInSight(f.actor), true);
  f.docs.set(f.source.uuid, f.source);
  f.actor.statuses.add("blind");
  assert.equal(frightenedInSight(f.actor), true);
  f.actor.statuses.delete("blind");
  f.sourceActor.statuses.add("invisible");
  assert.equal(frightenedInSight(f.actor), true);
  f.sourceActor.statuses.clear();
  f.source.level = "upstairs";
  assert.equal(frightenedInSight(f.actor), true);
  f.source.level = "ground";
  f.observer.object.checkCollision = () => {
    throw new Error("backend unavailable");
  };
  assert.equal(frightenedInSight(f.actor), true);
  f.observer.object.checkCollision = () => true;
  f.source.hidden = true;
  assert.equal(frightenedInSight(f.actor), true);
  f.source.hidden = false;
  f.effect.flags["worlds-beyond"].conditionSources.fear.uuid = f.sourceActor.uuid;
  f.scene.tokens.push({ ...f.source, id: "copy" });
  assert.equal(fearSourceToken(f.effect, f.observer), null);
  f.scene.tokens.push({ ...f.observer, id: "other" });
  assert.equal(fearObserver(f.actor), null);
  canvas.tokens.controlled = [{ document: f.observer }];
  assert.equal(fearObserver(f.actor), f.observer);
});

test("multiple active sources combine sight; disabled/expired effects do not hold the default on", () => {
  const f = fixture();
  f.calls.blocked = true;
  const other = { id: "unknown", statuses: new Set(["fear"]), flags: {} };
  f.actor.effects.push(other);
  assert.equal(frightenedInSight(f.actor), true);
  other.disabled = true;
  assert.equal(frightenedInSight(f.actor), false);
  other.disabled = false;
  other.duration = { expired: true };
  assert.equal(frightenedInSight(f.actor), false);
});

test("default check and attack dice use linked sight; per-roll and global opt-outs win and saves stay unchanged", async () => {
  const f = fixture();
  f.calls.blocked = true;
  assert.equal(defaultCheckMode(f.actor, "check"), "normal");
  assert.equal(actorConditionRoll(f.actor, "attack").disadvantages.length, 0);
  await rollStatCheck(f.actor, "str");
  assert.equal(f.calls.rolls.at(-1), "1d20 + @mod");
  await rollStatCheck(f.actor, "str", { fearInSight: true });
  assert.equal(f.calls.rolls.at(-1), "2d20kl1 + @mod");
  f.calls.blocked = false;
  await rollStatCheck(f.actor, "str", { fearInSight: false });
  assert.equal(f.calls.rolls.at(-1), "1d20 + @mod");
  await rollStatCheck(f.actor, "str", { kind: "save" });
  assert.equal(f.calls.rolls.at(-1), "1d20 + @mod");
  f.calls.blocked = true;
  f.settings.automateFrightened = false;
  assert.equal(defaultCheckMode(f.actor, "check"), "disadvantage", "legacy manual sight default remains");
  f.settings.automateConditionRolls = false;
  assert.equal(defaultCheckMode(f.actor, "check"), "normal");
});

test("ordinary approach blocks regardless of combat or sight; away/equal-distance movement and corrections remain", () => {
  const f = fixture();
  f.calls.blocked = true;
  const toward = f.movement([{ x: 100, y: 0 }]);
  assert.match(frightenedMovementBlock(f.observer, toward), /Frightened/);
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: -100, y: 0 }])), null);
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 0, y: 100 }])), null);
  for (const operation of [{ isUndo: true }, { isPaste: true }, { worldsBeyondFormLoadout: true }, { worldsBeyondCorrection: true }])
    assert.equal(frightenedMovementBlock(f.observer, toward, operation), null);
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 100, y: 0, action: "displace" }])), null);
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 0, y: 0, rotation: 90, width: 2 }])), null);
});

test("intermediate approaches, later closer legs and voluntary teleports are checked without charging a resource", () => {
  const f = fixture();
  assert.match(frightenedMovementBlock(f.observer, f.movement([{ x: 1200, y: 0 }])), /Frightened/);
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 1200, y: 0, action: "teleport" }])), null);
  assert.match(frightenedMovementBlock(f.observer, f.movement([{ x: 100, y: 0, action: "teleport" }])), /Frightened/);
  assert.match(
    frightenedMovementBlock(
      f.observer,
      f.movement([
        { x: -200, y: 0 },
        { x: -100, y: 0 }
      ])
    ),
    /Frightened/
  );
  const movement = f.movement([{ x: -100, y: 0 }]);
  movement.pending.waypoints = [{ x: 0, y: 0 }];
  assert.match(frightenedMovementBlock(f.observer, movement), /Frightened/);
});

test("unknown sources and unsupported geometry never invent movement restrictions", () => {
  const f = fixture(),
    toward = f.movement([{ x: 100, y: 0 }]);
  f.source.hidden = true;
  assert.equal(frightenedMovementBlock(f.observer, toward), null);
  f.source.hidden = false;
  f.scene.grid.isSquare = false;
  assert.equal(frightenedMovementBlock(f.observer, toward), null);
  f.scene.grid.isSquare = true;
  f.source.elevation = 5;
  assert.equal(frightenedMovementBlock(f.observer, toward), null);
  f.source.elevation = 0;
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 100, y: 0, elevation: 5 }])), null);
  f.docs.delete(f.source.uuid);
  assert.equal(frightenedMovementBlock(f.observer, toward), null);
});

test("each known fear source constrains movement independently, and opt-out changes no stored source flags", () => {
  const f = fixture();
  const west = { ...f.source, id: "west", uuid: "Scene.map.Token.west", x: -500 };
  f.docs.set(west.uuid, west);
  f.actor.effects.push({
    ...f.effect,
    id: "westFear",
    flags: { "worlds-beyond": { conditionSources: { fear: { uuid: west.uuid, name: "West" } } } }
  });
  assert.match(frightenedMovementBlock(f.observer, f.movement([{ x: -100, y: 0 }])), /Frightened/);
  const saved = structuredClone(f.effect.flags);
  f.settings.automateFrightened = false;
  assert.equal(frightenedMovementBlock(f.observer, f.movement([{ x: 100, y: 0 }])), null);
  assert.deepEqual(f.effect.flags, saved);
  registerFrightened();
  assert.equal(f.calls.setting.default, true);
  assert.equal(f.calls.setting.key, "automateFrightened");
});

test("native movement preflight rejects approach before any AP or ledger write", async () => {
  const f = fixture();
  const warnings = [];
  globalThis.Hooks = { on() {} };
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
  CONFIG.Token.documentClass = class {
    async _preUpdateMovement() {}
  };
  CONFIG.Token.objectClass = class {};
  CONFIG.Token.rulerClass = class {};
  f.actor.system.ap = { value: 20 };
  f.actor.system.command = { value: 3 };
  f.actor.update = async () => assert.fail("blocked movement must not write AP, Command AP or a ledger");
  registerMovement();
  const token = new CONFIG.Token.documentClass();
  Object.assign(token, f.observer);
  assert.equal(await token._preUpdateMovement(f.movement([{ x: 100, y: 0 }]), {}), false);
  assert.match(warnings[0], /Frightened/);
  assert.equal(f.actor.system.ap.value, 20);
  assert.equal(f.actor.system.command.value, 3);
});

test("ability attack uses automatic sight and honors a manual override", async () => {
  const f = fixture();
  f.calls.blocked = true;
  game.socket = { emit() {} };
  game.users = { activeGM: { id: "gm" } };
  const ability = {
    id: "spell",
    name: "Spell",
    type: "ability",
    system: { apDiscountStat: "str", targeting: { mode: "attack", stat: "str", damage: "1d6", area: {}, visual: {} } }
  };
  const use = async () => ({ id: "used" });
  await rollAbilityStrike(f.actor, ability, [], { use });
  assert.equal(f.calls.rolls.at(-1), "1d20 + @mod");
  await rollAbilityStrike(f.actor, ability, [], { use, fearInSight: true });
  assert.equal(f.calls.rolls.at(-1), "2d20kl1 + @mod");
  f.calls.blocked = false;
  await rollAbilityStrike(f.actor, ability, [], { use });
  assert.equal(f.calls.rolls.at(-1), "2d20kl1 + @mod");
});
