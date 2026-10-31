// Foundry-free armor rules from Notion's Armor Types Information.
import { numberOr } from "./core-numbers.mjs";

export function wornEquipment({ items = [], agility = 12, strength = 12, penaltyOverride = null } = {}) {
  const armor = Array.from(items).filter(item => item.type === "armor" && item.system.equipped);
  const shields = Array.from(items).filter(item => item.type === "shield" && item.system.equipped);
  const rank = { light: 1, medium: 2, heavy: 3 };
  const type = armor.reduce((type, item) => (rank[item.system.armorType] ?? 0) > (rank[type] ?? 0) ? item.system.armorType : type, "none");
  // Arm guards give one AR contribution even when both arms have separate records.
  const arms = armor.filter(item => item.system.piece === "arms");
  const other = armor.filter(item => item.system.piece !== "arms");
  const sum = (list, field) => list.reduce((total, item) => total + numberOr(item.system[field], 0), 0);
  const armorAR = sum(other, "armorRating") + (arms.length ? Math.max(...arms.map(item => numberOr(item.system.armorRating, 0))) : 0);
  const shieldAR = sum(shields, "armorRating");
  const evasion = type === "light" ? sum(armor.filter(item => item.system.armorType === "light"), "evasionBonus") : 0;
  const automaticPenalty = type === "heavy" ? Math.min(3, Math.max(0, armorAR - 3)) : 0;
  const agilityPenalty = numberOr(penaltyOverride, automaticPenalty);
  return {
    type, armorAR, shieldAR, armor: armorAR + shieldAR, evasion,
    automaticPenalty, agilityPenalty, effectiveAgility: numberOr(agility, 12) - agilityPenalty,
    heavyDisadvantage: type === "heavy" && numberOr(strength, 12) < 21,
    squareCost: type === "heavy" ? 10 : 5, difficultSquareCost: type === "heavy" ? 20 : 10,
    blockDice: shields.map(item => String(item.system.blockDie ?? "1d6")),
    duplicatePieces: [...new Set(armor.map(item => item.system.piece))].filter(piece => piece !== "arms" && armor.filter(item => item.system.piece === piece).length > 1)
  };
}

// Inventory rules from Notion's Equipment Rules.
export const BASE_INVENTORY_SLOTS = 10;
export const BACKPACK_SLOTS = 6;

// Slots one item takes before stacking. Shields and Two-handed weapons take 2.
export function defaultSlots(type, system = {}) {
  if (type === "shield") return 2;
  if (type === "weapon" && system.properties?.twoHanded) return 2;
  return 1;
}

// Worn armor and weapons or shields in hand take no slots. Equipped records cover one
// worn or held copy, so extra quantity on the same record is carried in the inventory.
export function carriedSlots(item) {
  const system = item.system ?? {};
  const quantity = Math.max(0, numberOr(system.quantity, 1));
  const equippable = ["weapon", "armor", "shield"].includes(item.type);
  const carried = equippable && system.equipped ? Math.max(0, quantity - 1) : quantity;
  const perSlot = Math.max(1, numberOr(system.perSlot, 1));
  const size = Math.max(0, numberOr(system.slots, defaultSlots(item.type, system)));
  return Math.ceil(carried / perSlot) * size;
}

export function inventory({ items = [], strengthMod = 0, backpack = false, capacityOverride = null } = {}) {
  const list = Array.from(items);
  const automatic = BASE_INVENTORY_SLOTS + numberOr(strengthMod, 0) + (backpack ? BACKPACK_SLOTS : 0);
  const capacity = numberOr(capacityOverride, automatic);
  const perItem = Object.fromEntries(list.map(item => [item.id, carriedSlots(item)]));
  const used = Object.values(perItem).reduce((total, slots) => total + slots, 0);
  return { used, capacity, automatic, free: capacity - used, over: Math.max(0, used - capacity), perItem };
}

// Block dice: 1d4 plus one die every 5 levels; a shield sets the size of every die.
// With several shields equipped, the largest die is used.
export function blockDice({ level = 1, items = [] } = {}) {
  const count = 1 + Math.floor(Math.max(1, numberOr(level, 1)) / 5);
  const faces = Array.from(items)
    .filter(item => item.type === "shield" && item.system?.equipped)
    .map(item => Number(/d(\d+)/i.exec(String(item.system.blockDie ?? ""))?.[1]))
    .filter(Number.isFinite);
  const size = faces.length ? Math.max(...faces) : 4;
  return { count, size, formula: `${count}d${size}`, fromShield: faces.length > 0, nextLevel: count * 5 };
}
