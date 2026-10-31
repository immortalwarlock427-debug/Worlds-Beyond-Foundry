import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogItems, catalogId, CATALOG_FOLDERS, SIGNATURE_TEXT } from "../module/catalog.mjs";
import { SIGNATURE_PROPERTIES, WEAPON_PROPERTIES, WEAPON_FAMILIES } from "./equipment-keys.mjs";

const items = catalogItems();
const byName = name => items.find(item => item.name === name);

test("catalog matches Notion's table sizes with unique stable ids", () => {
  assert.equal(items.filter(item => item.type === "weapon").length, 26 + 12 + 10 + 5);
  assert.equal(items.filter(item => item.type === "armor").length, 13);
  assert.equal(items.filter(item => item.type === "shield").length, 4);
  const ids = [...items, ...CATALOG_FOLDERS].map(item => item._id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9]{16}$/);
  assert.equal(catalogId("weapon:dagger"), byName("Dagger")._id);
  assert.deepEqual(catalogItems(), items);
});

test("every weapon uses only keys the item model defines", () => {
  for (const item of items.filter(item => item.type === "weapon")) {
    assert.ok(Object.hasOwn(WEAPON_FAMILIES, item.system.family), item.name);
    assert.deepEqual(Object.keys(item.system.properties).sort(), Object.keys(WEAPON_PROPERTIES).sort(), item.name);
    assert.deepEqual(Object.keys(item.system.signature).sort(), Object.keys(SIGNATURE_PROPERTIES).sort(), item.name);
    assert.ok(CATALOG_FOLDERS.some(folder => folder._id === item.folder), item.name);
  }
  assert.deepEqual(Object.keys(SIGNATURE_TEXT).sort(), Object.keys(SIGNATURE_PROPERTIES).sort());
});

test("weapon rows follow the classification contract in docs/EQUIPMENT.md", () => {
  const katana = byName("Katana").system;
  assert.equal(katana.family, "finesse");
  assert.equal(katana.damage, "1d8");
  assert.equal(katana.versatileDamage, "1d10");
  assert.equal(katana.properties.versatile, true);

  const chakram = byName("Chakram").system;
  assert.deepEqual([chakram.family, chakram.ranged, chakram.properties.thrown], ["finesse", false, true]);
  assert.deepEqual(chakram.range, { normal: 30, long: 60 });

  const dagger = byName("Dagger").system;
  assert.deepEqual([dagger.family, dagger.ranged, dagger.signature.concealed, dagger.signature.quickdraw], ["balanced", false, true, true]);

  const greatsword = byName("Greatsword").system;
  assert.deepEqual([greatsword.family, greatsword.properties.twoHanded, greatsword.slots], ["heavy", true, 2]);
  assert.equal(byName("Greatclub").system.family, "balanced");
  assert.equal(byName("Lance").system.properties.mount, true);

  const crossbow = byName("Crossbow").system;
  assert.deepEqual([crossbow.family, crossbow.ranged, crossbow.loading, crossbow.slots], ["none", true, 1, 2]);
  assert.deepEqual(crossbow.range, { normal: 80, long: 160 });
  assert.equal(byName("Hand Crossbow").system.properties.strapped, true);
  assert.equal(byName("Revolver").system.loading, 6);
  assert.deepEqual(byName("Net").system.range, { normal: 15, long: 0 });
  assert.equal(byName("Net").system.damage, "");
  assert.equal(byName("Dart").system.cost, "5 sc");
  assert.equal(byName("Mace").system.damageType, "Bludgeoning, Piercing");

  for (const name of ["Warbow", "Arbalest"]) assert.deepEqual([byName(name).system.family, byName(name).system.ranged], ["paragon", true]);
  for (const name of ["Katar", "Odachi", "Guandao"]) assert.deepEqual([byName(name).system.family, byName(name).system.ranged], ["paragon", false]);
  assert.equal(byName("Arbalest").system.damage, "3d12");
  assert.match(byName("Kusarigama").system.description, /^Sweep:.*\nHook:/s);
});

test("armor and shields match Notion's tables", () => {
  const sum = type => items.filter(item => item.type === "armor" && item.system.armorType === type)
    .reduce((total, item) => ({ ar: total.ar + item.system.armorRating, ne: total.ne + item.system.evasionBonus }), { ar: 0, ne: 0 });
  assert.deepEqual(sum("light"), { ar: 1, ne: 3 });
  assert.deepEqual(sum("medium"), { ar: 4, ne: 0 });
  assert.deepEqual(sum("heavy"), { ar: 6, ne: 0 });
  assert.equal(byName("Light Helmet"), undefined);
  assert.equal(byName("Medium Pants"), undefined);
  assert.equal(byName("Heavy Chestpiece").system.cost, "15 gc");
  const plate = byName("Plate Shield").system;
  assert.deepEqual([plate.blockDie, plate.armorRating, plate.slots, plate.cost], ["1d10", 1, 2, "60 gc"]);
  assert.equal(byName("Wooden Shield").system.blockDie, "1d6");
});
