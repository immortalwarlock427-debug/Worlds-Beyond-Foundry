import { itemList, heldWeapon } from "./loadout.mjs";

// Notion: Unconscious drops whatever it is holding. Strapped weapons are worn.
export const unconsciousHeldGear = items =>
  itemList(items).filter(item => item.system?.equipped && (item.type === "shield" || heldWeapon(item)));

// "health" means zero Health keeps the creature down; "other" is a positive-
// Health knockout (sleep, magic, etc.). Legacy effects use Health at the event.
export const unconsciousCause = (saved, health) => (["health", "other"].includes(saved) ? saved : health > 0 ? "other" : "health");

export function unconsciousWakes({ cause, beforeDamage, afterDamage, afterHealth, damage = false, correction = false } = {}) {
  if (correction || !(afterHealth >= 1)) return false;
  const healed = afterDamage < beforeDamage;
  const hurt = damage && afterDamage > beforeDamage;
  return healed || (cause === "other" && hurt);
}
