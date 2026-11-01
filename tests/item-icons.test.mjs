import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_ARTWORK, itemIcon, stockItemIcon } from "../module/item-icons.mjs";
import { catalogItems } from "../module/catalog.mjs";

test("every catalog item has unique artwork, including seven supplied images", () => {
  const items = catalogItems();
  const weapons = items.filter(item => item.type === "weapon");
  assert.equal(new Set(items.map(item => item.img)).size, items.length);
  assert.equal(items.filter(item => item.img.startsWith("icons/")).length, 63);
  assert.equal(Object.keys(CUSTOM_ARTWORK).length, 7);
  for (const item of items) {
    assert.match(item.img, CUSTOM_ARTWORK[item.name] ? /^systems\/worlds-beyond\/icons\/.+\.png$/ : /^icons\/.+\.webp$/, item.name);
    assert.notEqual(item.img, "icons/weapons/swords/sword-simple-white.webp", item.name);
  }
  assert.match(weapons.find(item => item.name === "Revolver").img, /pistol-revolver/);
  assert.match(weapons.find(item => item.name === "Battleaxe").img, /axes/);
  assert.match(weapons.find(item => item.name === "Dagger").img, /daggers/);
});

test("old automatic stock images resolve per item while chosen stock art and renamed items stay as saved", () => {
  const old = { type: "weapon", name: "Hand Crossbow", img: "icons/weapons/crossbows/crossbow-blue.webp" };
  const original = structuredClone(old);
  assert.match(itemIcon(old), /handcrossbow-black/);
  assert.deepEqual(old, original);
  assert.match(itemIcon({ type: "weapon", name: "Kusarigama", img: "icons/weapons/maces/flail-ball-grey.webp" }), /sickle-kusarigama-chain/);
  assert.match(itemIcon({ type: "armor", name: "Light Arm Guard", img: "icons/equipment/hand/gauntlet-armored-black.webp" }), /bracer-belted-leather/);
  assert.match(itemIcon({ type: "shield", name: "Scale Shield", img: "icons/equipment/shield/buckler-iron-cross-gray.webp" }), /scale-shield.png/);
  const chosen = { ...old, img: "icons/weapons/crossbows/crossbow-ornamental-winged.webp" };
  assert.equal(itemIcon(chosen), chosen.img);
  const renamed = { ...old, name: "Family heirloom" };
  assert.equal(itemIcon(renamed), renamed.img);
});

test("saved placeholders resolve to supplied art only for the matching catalog item without changing documents", () => {
  for (const [name, path] of Object.entries(CUSTOM_ARTWORK)) {
    const type = name.endsWith("Shield") ? "shield" : "weapon";
    const item = { name, type, img: path.replace(/\.png$/, ".svg") };
    const original = structuredClone(item);
    assert.equal(itemIcon(item), path, name);
    assert.deepEqual(item, original);
    assert.equal(itemIcon({ ...item, name: "Personal heirloom" }), item.img);
    assert.equal(itemIcon({ ...item, type: "gear" }), item.img);
    assert.equal(itemIcon({ ...item, img: "worlds/my-world/chosen.png" }), "worlds/my-world/chosen.png");
  }
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
