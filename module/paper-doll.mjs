// Foundry-free paper doll: which worn item shows in which body or hand slot, and what
// choosing a slot changes. Ported from the website's equipment grid. Equip rules stay in loadout.mjs.
import { itemList, heldWeapon, ACCESSORY_SLOTS } from "./loadout.mjs";

// Reading order; side and row place each slot beside the figure. "Right" means the character's right,
// drawn on the viewer's left like the website.
export const DOLL_SLOTS = Object.freeze([
  { key: "helmet", label: "Head", side: "left", row: 1, kind: "armor", piece: "helmet" },
  { key: "amulet", label: "Amulet", side: "right", row: 1, kind: "accessory", slot: "amulet" },
  { key: "arms", label: "Arm guards", side: "left", row: 2, kind: "armor", piece: "arms" },
  { key: "strapped", label: "Strapped", side: "right", row: 2, kind: "strapped" },
  { key: "chest", label: "Chest", side: "left", row: 3, kind: "armor", piece: "chest" },
  { key: "belt", label: "Belt", side: "right", row: 3, kind: "accessory", slot: "belt" },
  { key: "ringRight", label: "Right ring", side: "left", row: 4, kind: "accessory", slot: "ring", index: 0 },
  { key: "ringLeft", label: "Left ring", side: "right", row: 4, kind: "accessory", slot: "ring", index: 1 },
  { key: "pants", label: "Pants", side: "left", row: 5, kind: "armor", piece: "pants" },
  { key: "legs", label: "Leg guards", side: "right", row: 5, kind: "armor", piece: "legs" }
]);
export const HAND_SLOTS = Object.freeze({ main: "Main hand", off: "Off hand" });
export const SLOT_KEYS = Object.freeze([...DOLL_SLOTS.map(slot => slot.key), ...Object.keys(HAND_SLOTS)]);

const equipped = item => !!item.system?.equipped;
const accessorySlot = item => (ACCESSORY_SLOTS[item.system?.slot] ? item.system.slot : "ring");
const strapped = item => item.type === "weapon" && !!item.system?.properties?.strapped;
const held = item => item.type === "shield" || heldWeapon(item);
const twoHanded = item => item.type === "weapon" && !!item.system?.properties?.twoHanded;

// Two-handed weapons fill the main hand and cover the off hand. Otherwise weapons go main hand first,
// then shields, which prefer the off hand. Anything the hand rules wouldn't allow is listed as extra.
export function handAssignment(items) {
  const inHand = itemList(items).filter(item => equipped(item) && held(item));
  const big = inHand.find(twoHanded);
  if (big) return { main: big, off: null, twoHanded: true, extra: inHand.filter(item => item !== big) };
  const weapons = inHand.filter(item => item.type === "weapon");
  const shields = inHand.filter(item => item.type === "shield");
  const main = weapons[0] ?? null;
  const off = weapons[1] ?? shields[0] ?? null;
  const rest = [...weapons.slice(2), ...shields.filter(item => item !== off)];
  if (!main && rest.length) return { main: rest[0], off, twoHanded: false, extra: rest.slice(1) };
  return { main, off, twoHanded: false, extra: rest };
}

// Items currently shown in one slot.
export function slotItems(items, key) {
  const list = itemList(items);
  if (key === "main" || key === "off") {
    const hands = handAssignment(list);
    return hands[key] ? [hands[key]] : [];
  }
  const slot = DOLL_SLOTS.find(entry => entry.key === key);
  if (!slot) return [];
  if (slot.kind === "strapped") return list.filter(item => equipped(item) && strapped(item));
  if (slot.kind === "armor") return list.filter(item => equipped(item) && item.type === "armor" && item.system?.piece === slot.piece).slice(0, 1);
  const worn = list.filter(item => equipped(item) && item.type === "accessory" && accessorySlot(item) === slot.slot);
  const index = slot.index ?? 0;
  return worn[index] ? [worn[index]] : [];
}

// Items that may go in a slot. Equipped items already shown elsewhere are left out, so choosing never
// shuffles gear between two slots of the same kind.
export function slotChoices(items, key) {
  const list = itemList(items);
  const current = new Set(slotItems(list, key).map(item => item.id));
  const fits = item => {
    if (key === "main") return heldWeapon(item);
    if (key === "off") return item.type === "shield" || (heldWeapon(item) && !twoHanded(item));
    const slot = DOLL_SLOTS.find(entry => entry.key === key);
    if (!slot) return false;
    if (slot.kind === "strapped") return strapped(item);
    if (slot.kind === "armor") return item.type === "armor" && item.system?.piece === slot.piece;
    return item.type === "accessory" && accessorySlot(item) === slot.slot;
  };
  return list.filter(item => fits(item) && (!equipped(item) || current.has(item.id) || key === "strapped"));
}

// The equip changes one slot choice makes, as {id: equipped}. A single slot takes one id or "" for empty;
// Strapped takes the full list of ids to wear.
export function slotPlan(items, key, choice) {
  const list = itemList(items);
  const allowed = new Set(slotChoices(list, key).map(item => item.id));
  const current = slotItems(list, key);
  const wanted = new Set((Array.isArray(choice) ? choice : [choice]).filter(id => id && allowed.has(id)));
  if (key !== "strapped" && wanted.size > 1) throw new Error("Choose one item for this slot.");
  const changes = {};
  for (const item of current) if (!wanted.has(item.id)) changes[item.id] = false;
  for (const id of wanted) if (!current.some(item => item.id === id)) changes[id] = true;
  return changes;
}

// Quickdraw weapons are free to draw, stow or swap to. A change that draws something else, or only stows
// gear that isn't Quickdraw, pays the normal cost once.
export function freeEquipmentChange(items, changes) {
  const list = itemList(items);
  const quick = id => {
    const item = list.find(entry => entry.id === id);
    return item?.type === "weapon" && !!item.system?.signature?.quickdraw;
  };
  const drawn = Object.keys(changes).filter(id => changes[id]);
  const stowed = Object.keys(changes).filter(id => !changes[id]);
  if (drawn.length) return drawn.every(quick);
  return stowed.length > 0 && stowed.every(quick);
}
