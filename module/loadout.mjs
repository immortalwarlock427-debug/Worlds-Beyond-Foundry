// Foundry-free hand rules. Notion Weapons Explained; explicit user equipment policy.
export const itemList = items => Array.from(items?.values?.() ?? items ?? []);
const handGear = item => ["weapon", "shield"].includes(item.type);
export const heldWeapon = item => item.type === "weapon" && !item.system?.properties?.strapped;

export function loadoutError(items, twoHandedId = null) {
  const equipped = itemList(items).filter(item => handGear(item) && item.system?.equipped);
  const weapons = equipped.filter(heldWeapon);
  if (weapons.length > 1 && !weapons.every(item => item.system.properties?.light && !item.system.properties?.twoHanded && item.id !== twoHandedId)) {
    return "Only two Light weapons can share your hands. Strapped weapons take no hand.";
  }
  const hands = equipped.reduce((sum, item) => sum + (item.type === "shield" ? 1 : item.system.properties?.strapped ? 0
    : item.system.properties?.twoHanded || item.id === twoHandedId ? 2 : 1), 0);
  return hands > 2 ? "Both hands are occupied. Stow conflicting weapons or shields first." : null;
}

// Keep the deliberately changed item first, then as much existing gear as fits.
// No document writes on load; this runs only for an intentional equipment edit.
export function stowedConflicts(items, preferredIds = []) {
  const all = itemList(items).filter(item => handGear(item) && item.system?.equipped);
  const preferred = [...preferredIds].reverse().map(id => all.find(item => item.id === id)).filter(Boolean);
  const ordered = [...new Set([...preferred, ...all])];
  const kept = [], stowed = [];
  for (const item of ordered) {
    if (loadoutError([...kept, item])) stowed.push(item.id);
    else kept.push(item);
  }
  return stowed;
}

export function requireWeaponReady(actor, weapon, grip = "one") {
  if (!weapon?.system?.equipped || !itemList(actor.items).some(item => item.id === weapon.id)) throw new Error("That weapon is no longer equipped. Equip it on your character sheet first.");
  const error = loadoutError(actor.items, grip === "two" ? weapon.id : null);
  if (error) throw new Error(`${error} Re-equip your intended weapon on the sheet to correct the loadout.`);
}
