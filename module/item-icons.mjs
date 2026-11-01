// Stock assets bundled with Foundry 14.365. Artwork only; no equipment rules.
const weaponIcons = {};
const assign = (names, path) => { for (const name of names) weaponIcons[name] = `icons/${path}`; };
assign(["Battleaxe", "Handaxe", "War Axe"], "weapons/axes/axe-battle-simple.webp");
assign(["Greataxe"], "weapons/axes/axe-double.webp");
assign(["Chakram"], "weapons/thrown/shuriken-double-red.webp");
assign(["Dagger", "Main-gauche", "Katar", "Iron Fan"], "weapons/daggers/dagger-black.webp");
assign(["Flail", "Kusarigama"], "weapons/maces/flail-ball-grey.webp");
assign(["Flanged Mace", "Mace"], "weapons/maces/mace-flanged-steel-grey.webp");
assign(["Morningstar"], "weapons/maces/flail-morning-star.webp");
assign(["Katana", "Odachi"], "weapons/swords/sword-katana.webp");
assign(["Longsword", "Rapier"], "weapons/swords/sword-guard-brass-worn.webp");
assign(["Shortsword"], "weapons/swords/shortsword-broad-engraved.webp");
assign(["Scimitar"], "weapons/swords/scimitar-blue.webp");
assign(["Greatsword", "Zweihänder"], "weapons/swords/greatsword-crossguard-barbed.webp");
assign(["Light Hammer", "Warhammer", "War Pick"], "weapons/hammers/hammer-war-spiked-simple.webp");
assign(["Maul"], "weapons/hammers/hammer-double-sledge-engraved.webp");
assign(["Quarterstaff", "Blowgun"], "weapons/staves/staff-simple-brown.webp");
assign(["Greatclub"], "weapons/clubs/bat-baseball-wood.webp");
assign(["Javelin", "Spear", "Pike", "Lance"], "weapons/polearms/spear-simple-engraved.webp");
assign(["Trident"], "weapons/polearms/trident-curved-steel.webp");
assign(["Glaive", "Halberd", "Naginata", "Guandao"], "weapons/polearms/glaive-hooked-steel.webp");
assign(["Sickle", "War Scythe"], "weapons/sickles/hand-sickle.webp");
assign(["Whip", "Urumi"], "weapons/misc/whip-leather.webp");
assign(["Dart"], "weapons/ammunition/arrow-broadhead-bent-teal.webp");
assign(["Sling"], "weapons/slings/sling-leather.webp");
assign(["Shortbow", "Longbow", "Warbow"], "weapons/bows/bow-ornamental-carved-brown.webp");
assign(["Hand Crossbow", "Light Crossbow", "Crossbow", "Arbalest"], "weapons/crossbows/crossbow-blue.webp");
assign(["Revolver", "Gun"], "weapons/guns/pistol-revolver-steel.webp");
assign(["Net"], "tools/fishing/net-simple-tan.webp");

const pieces = {
  chest: "equipment/chest/breastplate-banded-blue.webp",
  helmet: "equipment/head/helm-basinet-slotted-steel.webp",
  arms: "equipment/hand/gauntlet-armored-black.webp",
  pants: "equipment/leg/cuisses-banded-blue.webp",
  legs: "equipment/feet/boots-armored-brass.webp"
};
export function stockItemIcon({ type, name, system = {} }) {
  if (type === "weapon") return weaponIcons[name] ?? "icons/weapons/swords/sword-simple-white.webp";
  if (type === "armor") return `icons/${pieces[system.piece] ?? pieces.chest}`;
  if (type === "shield") return name === "Wooden Shield"
    ? "icons/equipment/shield/shield-round-boss-wood-brown.webp" : "icons/equipment/shield/buckler-iron-cross-gray.webp";
  if (type === "consumable") return system.kind === "ammunition"
    ? "icons/weapons/ammunition/arrow-broadhead-bent-teal.webp" : "icons/consumables/potions/bottle-bulb-corked-glowing-red.webp";
  return "icons/svg/item-bag.svg";
}

const generic = new Set(["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/target.svg", "icons/svg/statue.svg", "icons/svg/shield.svg"]);
export function itemIcon(item) {
  return item.img && !generic.has(item.img) ? item.img : stockItemIcon(item);
}
