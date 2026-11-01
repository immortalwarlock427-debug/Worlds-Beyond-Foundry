import { test } from "node:test";
import assert from "node:assert/strict";
import { itemIcon, stockItemIcon } from "../module/item-icons.mjs";
import { catalogItems } from "../module/catalog.mjs";

test("catalog weapons use fitting stock artwork rather than the shared SVG placeholder", () => {
  const weapons = catalogItems().filter(item => item.type === "weapon");
  for (const item of weapons) {
    assert.match(item.img, /^icons\/.+\.webp$/, item.name);
    assert.notEqual(item.img, "icons/weapons/swords/sword-simple-white.webp", item.name);
  }
  assert.ok(new Set(weapons.map(item => item.img)).size >= 20);
  assert.match(weapons.find(item => item.name === "Revolver").img, /pistol-revolver/);
  assert.match(weapons.find(item => item.name === "Battleaxe").img, /axes/);
  assert.match(weapons.find(item => item.name === "Dagger").img, /daggers/);
});

test("custom images are preserved while generic legacy images get display fallbacks without mutation", () => {
  const item = { type: "weapon", name: "Revolver", img: "worlds/my-world/custom-gun.png", system: {} };
  assert.equal(itemIcon(item), item.img);
  item.img = "icons/svg/target.svg";
  const before = structuredClone(item);
  assert.match(itemIcon(item), /pistol-revolver/);
  assert.deepEqual(item, before);
  assert.match(itemIcon({ type: "weapon", name: "Custom weapon", system: {} }), /sword/);
});

test("armor pieces, shields and consumables use appropriate stock families", () => {
  assert.match(stockItemIcon({ type: "armor", system: { piece: "helmet" } }), /head/);
  assert.match(stockItemIcon({ type: "armor", system: { piece: "legs" } }), /feet/);
  assert.match(stockItemIcon({ type: "shield", name: "Wooden Shield" }), /shield/);
  assert.match(stockItemIcon({ type: "consumable", system: { kind: "potion" } }), /potions/);
  assert.match(stockItemIcon({ type: "consumable", system: { kind: "ammunition" } }), /ammunition/);
});
