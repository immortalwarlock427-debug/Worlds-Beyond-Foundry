import { test } from "node:test";
import assert from "node:assert/strict";

// A recording stand-in for PIXI.Graphics in either API generation.
function fakePixi(version) {
  const calls = [];
  class Graphics {
    constructor() {
      this.destroyed = false;
    }
    clear() {
      calls.push("clear");
      return this;
    }
    destroy() {
      this.destroyed = true;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    arc() {
      return this;
    }
    closePath() {
      return this;
    }
  }
  const record = name =>
    function (...args) {
      for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} got ${value}`);
      calls.push(name);
      return this;
    };
  const methods =
    version === 8
      ? ["circle", "poly", "rect", "fill", "stroke"]
      : ["drawCircle", "drawPolygon", "drawRect", "beginFill", "endFill", "lineStyle"];
  for (const name of methods) Graphics.prototype[name] = record(name);
  globalThis.PIXI = { Graphics, VERSION: `${version}.0.0`, BLEND_MODES: version === 8 ? undefined : { ADD: 1, NORMAL: 0 } };
  const ticks = new Set();
  const children = [];
  globalThis.canvas = {
    ready: true,
    scene: { id: "scene" },
    interface: { addChild: child => children.push(child) },
    app: { ticker: { deltaMS: 50, add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } }
  };
  const run = () => {
    for (let frame = 0; frame < 200 && ticks.size; frame++) for (const fn of [...ticks]) fn();
  };
  return { calls, run, children, ticks };
}

const { play } = await import("../module/vfx.mjs");
const shapes = {
  single: null,
  circle: { type: "circle", x: 500, y: 500, radius: 200 },
  cone: { type: "cone", x: 100, y: 100, radius: 300, direction: 0.5, angle: Math.PI / 3 },
  line: { type: "line", x: 100, y: 100, length: 600, width: 100, direction: 1 }
};
const effects = ["lightning", "fire", "ice", "arcane", "holy", "shadow", "poison", "force"];

for (const version of [8, 7]) {
  test(`every effect and shape animates and cleans up on PixiJS v${version}`, () => {
    for (const effect of effects)
      for (const [name, shape] of Object.entries(shapes)) {
        const pixi = fakePixi(version);
        play({ effect, color: 0x66ccff, shape, origin: { x: 50, y: 50 }, targets: name === "single" ? [{ x: 400, y: 300 }] : [] });
        pixi.run();
        assert.equal(pixi.ticks.size, 0, `${effect} ${name} left a ticker running`);
        assert.ok(pixi.children[0].destroyed, `${effect} ${name} wasn't destroyed`);
        const drew = pixi.calls.some(call =>
          (version === 8 ? ["fill", "stroke"] : ["drawCircle", "drawPolygon", "lineStyle"]).includes(call)
        );
        assert.ok(drew, `${effect} ${name} drew nothing`);
        if (version === 8) assert.ok(!pixi.calls.includes("beginFill"));
      }
  });
}
