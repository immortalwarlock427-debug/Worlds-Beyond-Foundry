import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areaSettings,
  areaLabel,
  buildShape,
  pointInShape,
  tokensInShape,
  colorNumber,
  visualSettings,
  isArea
} from "../module/area-core.mjs";

// 100 px squares of 5 ft: 20 px per foot.
const ppf = 20;
const token = (id, col, row, size = 1) => ({ id, x: col * 100, y: row * 100, width: size * 100, height: size * 100 });

test("blank sizes use the defaults and labels read plainly", () => {
  assert.deepEqual(areaSettings({ shape: "cone" }), { shape: "cone", size: 15, width: 5, angle: 60, includeSelf: false });
  assert.equal(areaSettings({ shape: "line", size: 60, width: 10 }).width, 10);
  assert.equal(areaSettings({ shape: "nonsense" }).shape, "single");
  assert.equal(areaLabel({ shape: "circle", size: 20 }), "20 ft radius circle");
  assert.equal(areaLabel({ shape: "line" }), "30 ft line, 5 ft wide");
  assert.equal(areaLabel({ shape: "aura" }), "10 ft around you");
  assert.equal(isArea("single"), false);
  assert.equal(isArea("cone"), true);
});

test("a placed circle catches tokens whose space it covers, not a clipped corner", () => {
  const shape = buildShape(areaSettings({ shape: "circle", size: 10 }), {
    origin: { x: 50, y: 50 },
    point: { x: 550, y: 550 },
    pixelsPerFoot: ppf
  });
  assert.deepEqual(shape, { type: "circle", x: 550, y: 550, radius: 200 });
  const tokens = [token("center", 5, 5), token("near", 6, 5), token("edge", 7, 5), token("far", 9, 9)];
  assert.deepEqual(
    tokensInShape(shape, tokens).map(t => t.id),
    ["center", "near", "edge"]
  );
  assert.equal(pointInShape(shape, { x: 800, y: 800 }), false);
});

test("an aura centers on the caster and leaves the caster out unless asked", () => {
  const caster = token("caster", 5, 5);
  const shape = buildShape(areaSettings({ shape: "aura", size: 5 }), {
    origin: { x: 550, y: 550 },
    point: { x: 0, y: 0 },
    pixelsPerFoot: ppf
  });
  const tokens = [caster, token("adjacent", 6, 5), token("two away", 7, 5)];
  assert.deepEqual(
    tokensInShape(shape, tokens, { excludeId: "caster" }).map(t => t.id),
    ["adjacent"]
  );
});

test("a cone spreads from the caster toward the aim point", () => {
  const shape = buildShape(areaSettings({ shape: "cone", size: 15, angle: 60 }), {
    origin: { x: 50, y: 550 },
    point: { x: 1000, y: 550 },
    pixelsPerFoot: ppf
  });
  assert.equal(shape.type, "cone");
  assert.equal(pointInShape(shape, { x: 300, y: 550 }), true);
  assert.equal(pointInShape(shape, { x: 300, y: 450 }), true);
  assert.equal(pointInShape(shape, { x: 300, y: 300 }), false);
  assert.equal(pointInShape(shape, { x: -100, y: 550 }), false);
  assert.equal(pointInShape(shape, { x: 400, y: 550 }), false);
});

test("a line runs from the caster with its width centered", () => {
  const shape = buildShape(areaSettings({ shape: "line", size: 30, width: 5 }), {
    origin: { x: 50, y: 50 },
    point: { x: 50, y: 1000 },
    pixelsPerFoot: ppf
  });
  assert.equal(pointInShape(shape, { x: 50, y: 600 }), true);
  assert.equal(pointInShape(shape, { x: 100, y: 600 }), true);
  assert.equal(pointInShape(shape, { x: 120, y: 600 }), false);
  assert.equal(pointInShape(shape, { x: 50, y: 700 }), false);
  const tokens = [token("in path", 0, 3), token("beside", 1, 3)];
  assert.deepEqual(
    tokensInShape(shape, tokens).map(t => t.id),
    ["in path"]
  );
});

test("colors accept #RGB and #RRGGBB and fall back to the effect's color", () => {
  assert.equal(colorNumber("#ff8800"), 0xff8800);
  assert.equal(colorNumber("f80"), 0xff8800);
  assert.equal(colorNumber("orange"), null);
  assert.deepEqual(visualSettings({ effect: "fire", color: "" }), { effect: "fire", color: 0xff7a1a });
  assert.deepEqual(visualSettings({ effect: "ice", color: "#123456" }), { effect: "ice", color: 0x123456 });
  assert.equal(visualSettings({ effect: "bogus" }).effect, "none");
});
