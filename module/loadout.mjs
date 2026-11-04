// Foundry-free hand rules. Notion Weapons Explained; explicit user equipment policy.
export const itemList = items => Array.from(items?.values?.() ?? items ?? []);
// Everything that can be worn or held. Equipped copies take no inventory slots.
export const WORN_TYPES = Object.freeze(["weapon", "shield", "armor", "accessory"]);
export const wornGear = item => WORN_TYPES.includes(item?.type);
// Accessories from the website's paper doll. Two ring fingers; one amulet and one belt.
export const ACCESSORY_SLOTS = Object.freeze({
  amulet: { label: "Amulet", capacity: 1 },
  ring: { label: "Ring", capacity: 2 },
  belt: { label: "Belt", capacity: 1 }
});
const handGear = item => ["weapon", "shield"].includes(item.type);
// Which body slot a worn item fills, and how many items that slot holds.
function bodySlot(item) {
  if (item.type === "armor" && item.system?.piece) return { key: `armor.${item.system.piece}`, capacity: 1 };
  if (item.type === "accessory") {
    const slot = ACCESSORY_SLOTS[item.system?.slot] ? item.system.slot : "ring";
    return { key: `accessory.${slot}`, capacity: ACCESSORY_SLOTS[slot].capacity };
  }
  return null;
}
export const heldWeapon = item => item.type === "weapon" && !item.system?.properties?.strapped;

export function loadoutError(items, twoHandedId = null) {
  const equipped = itemList(items).filter(item => handGear(item) && item.system?.equipped);
  const weapons = equipped.filter(heldWeapon);
  if (
    weapons.length > 1 &&
    !weapons.every(item => item.system.properties?.light && !item.system.properties?.twoHanded && item.id !== twoHandedId)
  ) {
    return "Only two Light weapons can share your hands. Strapped weapons take no hand.";
  }
  const hands = equipped.reduce(
    (sum, item) =>
      sum +
      (item.type === "shield"
        ? 1
        : item.system.properties?.strapped
          ? 0
          : item.system.properties?.twoHanded || item.id === twoHandedId
            ? 2
            : 1),
    0
  );
  return hands > 2 ? "Both hands are occupied. Stow conflicting weapons or shields first." : null;
}

// Keep the deliberately changed item first, then as much existing gear as fits.
// No document writes on load; this runs only for an intentional equipment edit.
export function stowedConflicts(items, preferredIds = []) {
  const all = itemList(items).filter(item => wornGear(item) && item.system?.equipped);
  const preferred = [...preferredIds]
    .reverse()
    .map(id => all.find(item => item.id === id))
    .filter(Boolean);
  const ordered = [...new Set([...preferred, ...all])];
  const kept = [],
    stowed = [];
  for (const item of ordered) {
    const slot = bodySlot(item);
    const occupied = !!slot && kept.filter(other => bodySlot(other)?.key === slot.key).length >= slot.capacity;
    if (occupied || loadoutError([...kept, item])) stowed.push(item.id);
    else kept.push(item);
  }
  return stowed;
}

export function requireWeaponReady(actor, weapon, grip = "one") {
  if (!weapon?.system?.equipped || !itemList(actor.items).some(item => item.id === weapon.id))
    throw new Error("That weapon is no longer equipped. Equip it on your character sheet first.");
  const error = loadoutError(actor.items, grip === "two" ? weapon.id : null);
  if (error) throw new Error(`${error} Re-equip your intended weapon on the sheet to correct the loadout.`);
}
