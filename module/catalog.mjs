// Foundry-free equipment catalog, transcribed from Notion "Weapons Explained" and
// "Armor Types Information" (both checked 2026-10-31). Notion is the authority:
// update these tables when Notion changes, then bump CATALOG_VERSION.
export const CATALOG_VERSION = 1;
export const CATALOG_PACK = { name: "worlds-beyond-catalog", label: "Worlds Beyond Catalog" };

export const SIGNATURE_TEXT = Object.freeze({
  sweep: "Sweep: a hit also strikes one other creature in your reach for half damage, rounded down.",
  hook: "Hook: on a hit, you can pull the target 5ft toward you.",
  stagger: "Stagger: on a hit, the target makes a Vitality save against 12 + the modifier you attacked with. On a failure, it loses 2 AP on its next turn.",
  disarm: "Disarm: on a hit, the target makes a Strength or Dexterity save against 12 + the modifier you attacked with. On a failure, it drops a weapon it's holding.",
  entangle: "Entangle: a creature it hits is Restrained until it escapes. Trying to escape costs 5 AP and a DC 12 Strength or Dexterity check.",
  puncture: "Puncture: its hits ignore 2 of the target's Armor Rating. On a Two-handed weapon, halve the Armor Rating first, then ignore 2 more.",
  sunder: "Sunder: on a hit, the target makes a Strength save against 12 + the modifier you attacked with. On a failure, its armor's Armor Rating drops by 1 until it's repaired. You can't lower a target's armor by more than the modifier you attack with.",
  bleed: "Bleed: a hit makes the target start Bleeding.",
  pierceThrough: "Pierce Through: a ranged hit carries on to the next creature in a straight line behind the target, dealing it half damage, rounded down.",
  bulwark: "Bulwark: you can spend a reaction to attack a creature that moves into your reach.",
  quickdraw: "Quickdraw: drawing, stowing or swapping to it costs 0 AP.",
  concealed: "Concealed: easy to hide on your body. Your first attack with it from hiding has advantage.",
  silent: "Silent: attacking with it doesn't give away where you are.",
  loud: "Loud: every attack with it can be heard from far away."
});

const SIGNATURE_KEYS = { Sweep: "sweep", Hook: "hook", Stagger: "stagger", Disarm: "disarm", Entangle: "entangle", Puncture: "puncture", Sunder: "sunder", Bleed: "bleed", "Pierce Through": "pierceThrough", Bulwark: "bulwark", Quickdraw: "quickdraw", Concealed: "concealed", Silent: "silent", Loud: "loud" };
const PROPERTY_KEYS = { Light: "light", "Two-handed": "twoHanded", Versatile: "versatile", Strapped: "strapped", Reach: "reach", Mount: "mount", Thrown: "thrown" };
const FAMILY_KEYS = { Heavy: "heavy", Finesse: "finesse" };

// [name, damage, type, properties, signatures, cost, range] in Notion's table order.
const ONE_HANDED = [
  ["Battleaxe", "1d8", "Slashing", "Light", "Sweep", "12 gc"],
  ["Chakram", "1d6", "Slashing", "Finesse, Thrown (30/60)", "Bleed", "35 gc"],
  ["Dagger", "1d4", "Piercing", "Light, Thrown (20/40)", "Concealed, Quickdraw", "6 gc"],
  ["Flail", "1d8", "Bludgeoning", "", "Disarm", "12 gc"],
  ["Flanged Mace", "1d10", "Bludgeoning", "Heavy", "Stagger", "20 gc"],
  ["Handaxe", "1d6", "Slashing", "Light, Thrown (20/40)", "Quickdraw", "8 gc"],
  ["Iron Fan", "1d6", "Slashing", "Finesse, Light", "Concealed, Disarm", "40 gc"],
  ["Javelin", "1d8", "Piercing", "Thrown (30/60)", "Pierce Through", "10 gc"],
  ["Katana", "1d8 (1d10)", "Slashing", "Finesse, Versatile", "Bleed", "50 gc"],
  ["Kusarigama", "1d8", "Slashing", "Finesse", "Hook, Sweep", "40 gc"],
  ["Light Hammer", "1d6", "Bludgeoning", "Light, Thrown (20/40)", "Stagger", "8 gc"],
  ["Longsword", "1d8 (1d10)", "Slashing", "Versatile", "", "15 gc"],
  ["Mace", "1d6", "Bludgeoning, Piercing", "", "Sunder", "8 gc"],
  ["Main-gauche", "1d4", "Piercing", "Finesse, Light", "Disarm", "30 gc"],
  ["Morningstar", "1d8", "Bludgeoning", "Light", "Stagger", "12 gc"],
  ["Quarterstaff", "1d6 (1d8)", "Bludgeoning", "Versatile", "", "5 gc"],
  ["Rapier", "1d10", "Piercing", "Finesse", "Puncture", "40 gc"],
  ["Scimitar", "1d8", "Slashing", "Light", "Bleed", "12 gc"],
  ["Shortsword", "1d6", "Piercing", "Light", "Puncture", "10 gc"],
  ["Sickle", "1d6", "Slashing", "Light, Thrown (20/40)", "Hook", "6 gc"],
  ["Spear", "1d8", "Piercing", "Thrown (20/40)", "Bulwark", "10 gc"],
  ["Trident", "1d8", "Piercing", "Thrown (20/40)", "Disarm", "15 gc"],
  ["Urumi", "1d8", "Slashing", "Finesse, Reach", "Sweep", "45 gc"],
  ["War Axe", "1d10", "Slashing", "Heavy", "Sunder", "20 gc"],
  ["War Pick", "1d8", "Piercing", "Light", "Sunder", "12 gc"],
  ["Whip", "1d4", "Slashing", "Light, Reach", "Disarm", "8 gc"]
];

const TWO_HANDED = [
  ["Glaive", "1d10", "Slashing", "Heavy, Reach", "Hook", "22 gc"],
  ["Greataxe", "1d12", "Slashing", "Heavy", "Sunder", "25 gc"],
  ["Greatclub", "1d10", "Bludgeoning", "", "Stagger", "8 gc"],
  ["Greatsword", "2d6", "Slashing", "Heavy", "Sweep", "25 gc"],
  ["Halberd", "1d10", "Slashing", "Heavy, Reach", "Sweep", "22 gc"],
  ["Lance", "2d10", "Piercing", "Mount, Reach", "", "60 gc"],
  ["Maul", "2d6", "Bludgeoning", "Heavy", "Stagger", "25 gc"],
  ["Naginata", "1d12", "Slashing", "Finesse, Reach", "Sweep", "55 gc"],
  ["Pike", "1d10", "Piercing", "Heavy, Reach", "Bulwark", "20 gc"],
  ["War Scythe", "2d6", "Slashing", "Heavy, Reach", "Hook", "28 gc"],
  ["Warhammer", "1d10", "Bludgeoning", "", "Sunder", "12 gc"],
  ["Zweihänder", "2d8", "Slashing", "Heavy", "Sweep", "30 gc"]
].map(row => [...row.slice(0, 3), ["Two-handed", row[3]].filter(Boolean).join(", "), ...row.slice(4)]);

const RANGED = [
  ["Blowgun", "1", "Piercing", "", "Silent, Concealed", "5 gc", "20/40"],
  ["Dart", "1d4", "Piercing", "Thrown", "Quickdraw", "5 sc", "20/40"],
  ["Sling", "1d4", "Bludgeoning", "", "Silent", "5 gc", "30/60"],
  ["Shortbow", "1d6", "Piercing", "Two-handed", "Silent", "15 gc", "60/120"],
  ["Longbow", "1d8", "Piercing", "Two-handed", "Pierce Through", "25 gc", "90/180"],
  ["Hand Crossbow", "1d10", "Piercing", "Strapped, Loading (1)", "Concealed", "35 gc", "30/60"],
  ["Light Crossbow", "2d6", "Piercing", "Loading (1)", "Puncture", "40 gc", "60/120"],
  ["Crossbow", "2d10", "Piercing", "Two-handed, Loading (1)", "", "75 gc", "80/160"],
  ["Revolver", "1d6", "Piercing", "Loading (6)", "Loud, Quickdraw", "100 gc", "30/60"],
  ["Net", "", "", "Thrown", "Entangle", "10 gc", "15"]
];

const PARAGON = [
  ["Katar", "1d8", "Piercing", "Light", "Puncture, Quickdraw", "100 gc", ""],
  ["Odachi", "2d8", "Slashing", "Two-handed", "Bleed, Sweep", "140 gc", ""],
  ["Guandao", "2d6", "Slashing", "Two-handed, Reach", "Sweep, Hook", "130 gc", ""],
  ["Warbow", "2d8", "Piercing", "Two-handed", "Pierce Through", "130 gc", "120/240"],
  ["Arbalest", "3d12", "Piercing", "Two-handed, Loading (1)", "Puncture", "150 gc", "100/200"]
];

const list = text => String(text ?? "").split(",").map(part => part.trim()).filter(Boolean);
const slug = name => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Deterministic 16-character Foundry ids so a re-import updates items instead of duplicating them.
export function catalogId(key) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let a = 0x811c9dc5, b = 0x01000193;
  let id = "";
  for (let round = 0; id.length < 16; round++) {
    for (const character of `${round}:${key}`) {
      a = Math.imul(a ^ character.charCodeAt(0), 16777619) >>> 0;
      b = Math.imul(b + character.charCodeAt(0), 2246822519) >>> 0;
    }
    for (const value of [a, b]) for (let n = value; n > 0 && id.length < 16; n = Math.floor(n / 62)) id += alphabet[n % 62];
  }
  return id;
}

function parseRange(text) {
  const [normal = 0, long = 0] = String(text ?? "").split("/").map(Number);
  return { normal: normal || 0, long: long || 0 };
}

function weapon([name, damageText, damageType, propertyText, signatureText, cost, rangeText], { folder, family: forcedFamily, ranged = false }) {
  const [damage = "", versatileDamage = ""] = /^(\S+)(?: \((\S+)\))?$/.exec(damageText)?.slice(1) ?? [];
  const properties = Object.fromEntries(Object.values(PROPERTY_KEYS).map(key => [key, false]));
  const signature = Object.fromEntries(Object.values(SIGNATURE_KEYS).map(key => [key, false]));
  let family = forcedFamily ?? (ranged ? "none" : "balanced");
  let range = parseRange(rangeText);
  let loading = 0;
  for (const part of list(propertyText)) {
    const [, label, detail] = /^([^()]+?)(?: \(([^)]+)\))?$/.exec(part);
    if (FAMILY_KEYS[label]) family = FAMILY_KEYS[label];
    else if (label === "Loading") loading = Number(detail);
    else if (PROPERTY_KEYS[label]) {
      properties[PROPERTY_KEYS[label]] = true;
      if (label === "Thrown" && detail) range = parseRange(detail);
    } else throw new Error(`Unknown weapon property "${part}" on ${name}`);
  }
  for (const label of list(signatureText)) {
    if (!SIGNATURE_KEYS[label]) throw new Error(`Unknown signature "${label}" on ${name}`);
    signature[SIGNATURE_KEYS[label]] = true;
  }
  const description = Object.entries(signature).filter(([, on]) => on).map(([key]) => SIGNATURE_TEXT[key]).join("\n");
  return {
    _id: catalogId(`weapon:${slug(name)}`), name, type: "weapon", folder, img: ranged ? "icons/svg/target.svg" : "icons/svg/sword.svg",
    system: {
      description, quantity: 1, slots: properties.twoHanded ? 2 : 1, perSlot: 1, cost, equipped: false,
      family, ranged, damage, versatileDamage, damageType, properties, signature, range, loading
    }
  };
}

// Notion's armor table. Missing cells (light helmet, medium pants) have no item.
const ARMOR = [
  ["light", "chest", 1, 0, "6 gc"], ["light", "arms", 0, 1, "3 gc"], ["light", "pants", 0, 1, "2 gc"], ["light", "legs", 0, 1, "3 gc"],
  ["medium", "chest", 1, 0, "8 gc"], ["medium", "helmet", 1, 0, "5 gc"], ["medium", "arms", 1, 0, "5 gc"], ["medium", "legs", 1, 0, "5 gc"],
  ["heavy", "chest", 2, 0, "15 gc"], ["heavy", "helmet", 1, 0, "8 gc"], ["heavy", "arms", 1, 0, "8 gc"], ["heavy", "pants", 1, 0, "8 gc"], ["heavy", "legs", 1, 0, "8 gc"]
];
const PIECE_NAMES = { chest: "Chestpiece", helmet: "Helmet", arms: "Arm Guard", pants: "Pants", legs: "Leg Guards" };
const PIECE_NOTES = {
  arms: "Arm guards work on one arm or both. Two arm guards give the same Armor Rating as one. If both have special effects, you get both.",
  legs: "Leg guards are a pair and only work when you wear both."
};

const SHIELDS = [["Wooden", "1d6", 0, "5 gc"], ["Chain", "1d8", 0, "15 gc"], ["Scale", "1d10", 0, "25 gc"], ["Plate", "1d10", 1, "60 gc"]];

export const CATALOG_FOLDERS = Object.freeze([
  { key: "one-handed", name: "Melee Weapons: One-handed" },
  { key: "two-handed", name: "Melee Weapons: Two-handed" },
  { key: "ranged", name: "Ranged Weapons" },
  { key: "paragon", name: "Paragon Weapons" },
  { key: "armor", name: "Armor" },
  { key: "shields", name: "Shields" }
].map((folder, sort) => ({ _id: catalogId(`folder:${folder.key}`), name: folder.name, type: "Item", sort: sort * 100000, key: folder.key })));

const folderId = key => CATALOG_FOLDERS.find(folder => folder.key === key)._id;

export function catalogItems() {
  const items = [
    ...ONE_HANDED.map(row => weapon(row, { folder: folderId("one-handed") })),
    ...TWO_HANDED.map(row => weapon(row, { folder: folderId("two-handed") })),
    ...RANGED.map(row => weapon(row, { folder: folderId("ranged"), ranged: true })),
    ...PARAGON.map(row => weapon(row, { folder: folderId("paragon"), family: "paragon", ranged: !!row[6] })),
    ...ARMOR.map(([armorType, piece, armorRating, evasionBonus, cost]) => {
      const name = `${armorType[0].toUpperCase()}${armorType.slice(1)} ${PIECE_NAMES[piece]}`;
      return {
        _id: catalogId(`armor:${armorType}-${piece}`), name, type: "armor", folder: folderId("armor"), img: "icons/svg/statue.svg",
        system: { description: PIECE_NOTES[piece] ?? "", quantity: 1, slots: 1, perSlot: 1, cost, equipped: false, armorType, piece, armorRating, evasionBonus }
      };
    }),
    ...SHIELDS.map(([material, blockDie, armorRating, cost]) => ({
      _id: catalogId(`shield:${slug(material)}`), name: `${material} Shield`, type: "shield", folder: folderId("shields"), img: "icons/svg/shield.svg",
      system: { description: "", quantity: 1, slots: 2, perSlot: 1, cost, equipped: false, armorRating, blockDie }
    }))
  ];
  return items.map((item, index) => ({ ...item, sort: index * 100 }));
}
