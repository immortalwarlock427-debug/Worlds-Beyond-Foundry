import { test } from "node:test";
import assert from "node:assert/strict";
import { decorateEquipmentDirectory } from "../module/item-artwork.mjs";

test("world/compendium thumbnails use resolved artwork without changing documents or index entries", () => {
  const loaded = { type: "weapon", name: "Hand Crossbow", img: "icons/weapons/crossbows/crossbow-blue.webp" };
  const indexed = { type: "weapon", name: "Arbalest", img: "icons/svg/target.svg" };
  const custom = { type: "weapon", name: "Crossbow", img: "worlds/test/my-crossbow.png" };
  const before = structuredClone([loaded, indexed, custom]);
  const images = [{}, {}, {}, {}];
  const rows = ["loaded", "indexed", "custom", "missing"].map((id, i) => ({ dataset: { entryId: id }, querySelector: () => images[i] }));
  const application = { documentName: "Item", collection: { get: id => ({ loaded, custom }[id]), index: new Map([["indexed", indexed]]) } };
  decorateEquipmentDirectory(application, { querySelectorAll: () => rows });
  assert.match(images[0].src, /handcrossbow-black/);
  assert.match(images[1].src, /crossbow-heavy-black/);
  assert.equal(images[2].src, custom.img);
  assert.equal(images[3].src, undefined);
  assert.deepEqual([loaded, indexed, custom], before);
});

test("non-item directories and rows without thumbnails are untouched", () => {
  decorateEquipmentDirectory({ documentName: "Actor" }, { querySelectorAll() { throw new Error("should not inspect actors"); } });
  decorateEquipmentDirectory({ documentName: "Item", collection: new Map([["item", { type: "weapon", name: "Dagger" }]]) }, {
    querySelectorAll: () => [{ dataset: { entryId: "item" }, querySelector: () => null }]
  });
});
