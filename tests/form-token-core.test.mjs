import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTokenLoadout, tokenTransform, tokenAppearance } from "../module/form-token-core.mjs";
const base = () => ({ x: 300, y: 400, width: 1, height: 1, texture: { src: "base.webp", scaleX: -1, scaleY: 1 } });
function apply(token, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith("texture.")) token.texture[key.slice(8)] = value;
    else token[key] = value;
  }
}
test("blank token settings change nothing; scale preserves mirroring and images are independent of size", () => {
  const token = base(),
    snapshot = structuredClone(token);
  assert.equal(hasTokenLoadout({ tokenImg: "", tokenWidth: null, tokenHeight: null, tokenScale: null, transitionSeconds: 1.5 }), false);
  assert.deepEqual(tokenTransform(token, {}, undefined, 100).updates, {});
  const plan = tokenTransform(token, { tokenImg: "form.webp", tokenScale: 1.15 }, undefined, 100);
  assert.deepEqual(plan.updates, { "texture.src": "form.webp", "texture.scaleX": -1.15, "texture.scaleY": 1.15 });
  assert.deepEqual(token, snapshot);
});
test("even growth centers each axis; odd growth holds the top-left and Base reverses all prior offsets", () => {
  for (const size of [2, 3]) {
    const token = base();
    const first = tokenTransform(token, { tokenWidth: size, tokenHeight: size }, undefined, 100);
    apply(token, first.updates);
    assert.equal(token.x, size === 2 ? 300 : 200);
    assert.equal(token.y, size === 2 ? 400 : 300);
    const second = tokenTransform(token, { tokenWidth: 2, tokenHeight: 2 }, first.record, 100);
    apply(token, second.updates);
    token.x += 200;
    token.y += 100;
    apply(token, tokenTransform(token, {}, second.record, 100, true).updates);
    assert.equal(token.x, 500);
    assert.equal(token.y, 500);
    assert.equal(token.width, 1);
    assert.equal(token.height, 1);
  }
});
test("rectangular and fractional sizes keep per-axis anchoring, with exact image/scale restoration", () => {
  const token = base(),
    before = tokenAppearance(token);
  const plan = tokenTransform(token, { tokenWidth: 3, tokenHeight: 1.5, tokenScale: 1.15, tokenImg: "form.webp" }, undefined, 100);
  apply(token, plan.updates);
  assert.equal(token.x, 200);
  assert.equal(token.y, 400);
  apply(token, tokenTransform(token, {}, plan.record, 100, true).updates);
  assert.deepEqual(tokenAppearance(token), before);
});

test("unconfigured token fields preserve manual changes and newly enabled overrides remember their own base", () => {
  const token = base();
  const art = tokenTransform(token, { tokenImg: "form.webp" }, undefined, 100);
  apply(token, art.updates);
  token.width = 4;
  token.texture.scaleY = 1.7;
  const size = tokenTransform(token, { tokenImg: "form.webp", tokenWidth: 2 }, art.record, 100);
  assert.equal(size.record.base.width, 4);
  apply(token, size.updates);
  apply(token, tokenTransform(token, {}, size.record, 100, true).updates);
  assert.equal(token.width, 4);
  assert.equal(token.texture.scaleY, 1.7);
  assert.equal(token.texture.src, "base.webp");
});
