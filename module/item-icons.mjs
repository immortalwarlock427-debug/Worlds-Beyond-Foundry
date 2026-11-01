// Stock assets bundled with Foundry 14.365. Artwork only; no equipment rules.
// Recognize only the old automatic icon for the same named catalog item.
// Other saved artwork (including user-selected stock art) remains untouched.
const legacyWeaponIcons = {};
const assign = (names, path) => { for (const name of names) legacyWeaponIcons[name] = `icons/${path}`; };
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

const placeholder = name => `systems/worlds-beyond/icons/${name}.svg`;
export const ARTWORK_NEEDED = Object.freeze({
  Chakram: "A circular throwing blade with an open center.",
  Rapier: "A slim thrusting blade with a swept or cup hand guard.",
  Urumi: "A flexible metal ribbon sword, not a leather whip.",
  Lance: "A long mounted lance with a protective hand guard.",
  Blowgun: "A slender hollow blowpipe with a small dart.",
  "Chain Shield": "A shield faced with interlinked chain-mail rings.",
  "Scale Shield": "A shield faced with overlapping metal scales."
});
const weaponIcons = {
  Battleaxe: "weapons/axes/axe-battle-simple.webp",
  Chakram: placeholder("chakram"),
  Dagger: "weapons/daggers/dagger-black.webp",
  Flail: "weapons/maces/flail-ball-grey.webp",
  "Flanged Mace": "weapons/maces/mace-flanged-steel-grey.webp",
  Handaxe: "weapons/axes/axe-tomahawk-simple-grey.webp",
  "Iron Fan": "weapons/daggers/knife-fan.webp",
  Javelin: "weapons/polearms/javelin-simple.webp",
  Katana: "weapons/swords/sword-katana.webp",
  Kusarigama: "weapons/sickles/sickle-kusarigama-chain.webp",
  "Light Hammer": "weapons/hammers/shorthammer-double-simple.webp",
  Longsword: "weapons/swords/sword-guard-brass-worn.webp",
  Mace: "weapons/maces/mace-studded-steel.webp",
  "Main-gauche": "weapons/daggers/dagger-straight-thin-black.webp",
  Morningstar: "weapons/maces/mace-round-spiked-grey.webp",
  Quarterstaff: "weapons/staves/staff-simple-brown.webp",
  Rapier: placeholder("rapier"),
  Scimitar: "weapons/swords/scimitar-blue.webp",
  Shortsword: "weapons/swords/shortsword-broad-engraved.webp",
  Sickle: "weapons/sickles/hand-sickle.webp",
  Spear: "weapons/polearms/spear-simple-engraved.webp",
  Trident: "weapons/polearms/trident-curved-steel.webp",
  Urumi: placeholder("urumi"),
  "War Axe": "weapons/axes/axe-battle-heavy-black.webp",
  "War Pick": "weapons/axes/axe-pick-white.webp",
  Whip: "weapons/misc/whip-leather.webp",
  Glaive: "weapons/polearms/glaive-simple-hooked.webp",
  Greataxe: "weapons/axes/axe-double.webp",
  Greatclub: "weapons/clubs/club-heavy-barbed-brown.webp",
  Greatsword: "weapons/swords/greatsword-crossguard-steel.webp",
  Halberd: "weapons/polearms/halberd-worn-steel.webp",
  Lance: placeholder("lance"),
  Maul: "weapons/hammers/hammer-double-sledge-engraved.webp",
  Naginata: "weapons/polearms/glaive-simple.webp",
  Pike: "weapons/polearms/pike-flared-brown.webp",
  "War Scythe": "weapons/sickles/scythe-curved-steel.webp",
  Warhammer: "weapons/hammers/hammer-war-spiked-simple.webp",
  "Zweihänder": "weapons/swords/greatsword-flamberge.webp",
  Blowgun: placeholder("blowgun"),
  Dart: "weapons/thrown/dart-feathered.webp",
  Sling: "weapons/slings/sling-leather.webp",
  Shortbow: "weapons/bows/shortbow-recurve-leather.webp",
  Longbow: "weapons/bows/longbow-recurve-brown.webp",
  "Hand Crossbow": "weapons/crossbows/handcrossbow-black.webp",
  "Light Crossbow": "weapons/crossbows/crossbow-simple-brown.webp",
  Crossbow: "weapons/crossbows/crossbow-loaded-black.webp",
  Revolver: "weapons/guns/pistol-revolver-steel.webp",
  Net: "tools/fishing/net-simple-tan.webp",
  Katar: "weapons/fist/fist-katar-silver.webp",
  Odachi: "weapons/swords/sword-katana-tan.webp",
  Guandao: "weapons/polearms/glaive-hooked-steel.webp",
  Warbow: "weapons/bows/bow-ornamental-gold-blue.webp",
  Arbalest: "weapons/crossbows/crossbow-heavy-black.webp"
};
const armorIcons = {
  "Light Chestpiece": ["chest", "equipment/chest/breastplate-quilted-brown.webp"],
  "Light Arm Guard": ["arms", "equipment/wrist/bracer-belted-leather-brown.webp"],
  "Light Pants": ["pants", "equipment/leg/pants-breeches-leather-brown.webp"],
  "Light Leg Guards": ["legs", "equipment/feet/boots-armored-leather-brown.webp"],
  "Medium Chestpiece": ["chest", "equipment/chest/breastplate-scale-grey.webp"],
  "Medium Helmet": ["helmet", "equipment/head/helm-norman-reticulated.webp"],
  "Medium Arm Guard": ["arms", "equipment/wrist/bracer-studded-leather-steel.webp"],
  "Medium Leg Guards": ["legs", "equipment/feet/boots-armored-banded-steel.webp"],
  "Heavy Chestpiece": ["chest", "equipment/chest/breastplate-cuirass-steel-grey.webp"],
  "Heavy Helmet": ["helmet", "equipment/head/helm-basinet-slotted-steel.webp"],
  "Heavy Arm Guard": ["arms", "equipment/wrist/bracer-armored-steel.webp"],
  "Heavy Pants": ["pants", "equipment/leg/pants-armored-tasset-steel.webp"],
  "Heavy Leg Guards": ["legs", "equipment/feet/boots-armored-studded-steel.webp"]
};
const shieldIcons = {
  "Wooden Shield": "equipment/shield/shield-round-boss-wood-brown.webp",
  "Chain Shield": placeholder("chain-shield"),
  "Scale Shield": placeholder("scale-shield"),
  "Plate Shield": "equipment/shield/heater-steel-grey.webp"
};
const iconPath = path => path.startsWith("systems/") ? path : `icons/${path}`;

const pieces = {
  chest: "equipment/chest/breastplate-banded-blue.webp",
  helmet: "equipment/head/helm-basinet-slotted-steel.webp",
  arms: "equipment/hand/gauntlet-armored-black.webp",
  pants: "equipment/leg/cuisses-banded-blue.webp",
  legs: "equipment/feet/boots-armored-brass.webp"
};
export function stockItemIcon({ type, name, system = {} }) {
  if (type === "weapon") return iconPath(weaponIcons[name === "Gun" ? "Revolver" : name] ?? "weapons/swords/sword-simple-white.webp");
  if (type === "armor") return iconPath(armorIcons[name]?.[1] ?? pieces[system.piece] ?? pieces.chest);
  if (type === "shield") return iconPath(shieldIcons[name] ?? "equipment/shield/buckler-iron-cross-gray.webp");
  if (type === "consumable") return system.kind === "ammunition"
    ? "icons/weapons/ammunition/arrow-broadhead-bent-teal.webp" : "icons/consumables/potions/bottle-bulb-corked-glowing-red.webp";
  return "icons/svg/item-bag.svg";
}

const generic = new Set(["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/target.svg", "icons/svg/statue.svg", "icons/svg/shield.svg"]);
export function itemIcon(item) {
  const legacy = item.type === "weapon" ? legacyWeaponIcons[item.name]
    : item.type === "armor" && armorIcons[item.name] ? `icons/${pieces[armorIcons[item.name][0]]}`
      : item.type === "shield" && shieldIcons[item.name] ? item.name === "Wooden Shield"
        ? "icons/equipment/shield/shield-round-boss-wood-brown.webp" : "icons/equipment/shield/buckler-iron-cross-gray.webp" : null;
  return item.img && !generic.has(item.img) && item.img !== legacy ? item.img : stockItemIcon(item);
}
