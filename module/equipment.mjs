const SYSTEM_ID = "worlds-beyond";
export const EQUIPMENT_TYPES = Object.freeze({ weapon: "Weapon", armor: "Armor", shield: "Shield" });
export const ARMOR_TYPES = { light: "Light", medium: "Medium", heavy: "Heavy" };
export const ARMOR_PIECES = {
  chest: "Chest", pants: "Pants", arms: "Arm guards", legs: "Leg guards (pair)", helmet: "Helmet"
};

export const WEAPON_FAMILIES = Object.freeze({ balanced: "Balanced (melee)", heavy: "Heavy", finesse: "Finesse", paragon: "Paragon", none: "None (standard ranged)" });
export const WEAPON_PROPERTIES = Object.freeze({
  light: "Light", twoHanded: "Two-handed", versatile: "Versatile", strapped: "Strapped",
  reach: "Reach", mount: "Mount", thrown: "Thrown"
});
export const SIGNATURE_PROPERTIES = Object.freeze({
  sweep: "Sweep", hook: "Hook", stagger: "Stagger", disarm: "Disarm", entangle: "Entangle",
  puncture: "Puncture", sunder: "Sunder", bleed: "Bleed", pierceThrough: "Pierce Through",
  bulwark: "Bulwark", quickdraw: "Quickdraw", concealed: "Concealed", silent: "Silent", loud: "Loud"
});

const text = (initial = "", options = {}) => new foundry.data.fields.StringField({ required: true, nullable: false, initial, blank: true, ...options });
const number = (initial = 0) => new foundry.data.fields.NumberField({ required: true, nullable: false, initial });
const flags = keys => new foundry.data.fields.SchemaField(Object.fromEntries(
  Object.keys(keys).map(key => [key, new foundry.data.fields.BooleanField({ required: true, nullable: false, initial: false })])
));

class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: text(), quantity: number(1), slots: number(1), cost: text(),
      equipped: new foundry.data.fields.BooleanField({ initial: false })
    };
  }
}

export class WeaponData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      family: text("balanced", { choices: WEAPON_FAMILIES, blank: false }),
      ranged: new foundry.data.fields.BooleanField({ required: true, nullable: false, initial: false }),
      damage: text(), versatileDamage: text(), damageType: text(),
      properties: flags(WEAPON_PROPERTIES), signature: flags(SIGNATURE_PROPERTIES),
      range: new foundry.data.fields.SchemaField({ normal: number(), long: number() }),
      loading: number()
    };
  }
}

export class ArmorData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(), armorType: text("light"), piece: text("chest"),
      armorRating: number(), evasionBonus: number()
    };
  }
}

export class ShieldData extends EquipmentData {
  static defineSchema() {
    return { ...super.defineSchema(), armorRating: number(), blockDie: text("1d6") };
  }
}

export const EQUIPMENT_MODELS = Object.freeze({ weapon: WeaponData, armor: ArmorData, shield: ShieldData });

export class EquipmentSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet", "wb-item-sheet"],
    position: { width: 480, height: "auto" },
    window: { resizable: true }, form: { submitOnChange: true }
  };

  static PARTS = { sheet: { template: `systems/${SYSTEM_ID}/templates/equipment-sheet.hbs` } };

  async _prepareContext(options) {
    return Object.assign(await super._prepareContext(options), {
      item: this.item, system: this.item.system, editable: this.isEditable,
      typeLabel: EQUIPMENT_TYPES[this.item.type],
      weapon: this.item.type === "weapon", armor: this.item.type === "armor", shield: this.item.type === "shield",
      weaponFamilies: Object.entries(WEAPON_FAMILIES).map(([value, label]) => ({ value, label, selected: value === this.item.system.family })),
      weaponProperties: Object.entries(WEAPON_PROPERTIES).map(([key, label]) => ({ key, label, checked: !!this.item.system.properties?.[key] })),
      signatureProperties: Object.entries(SIGNATURE_PROPERTIES).map(([key, label]) => ({ key, label, checked: !!this.item.system.signature?.[key] })),
      armorTypes: Object.entries(ARMOR_TYPES).map(([value, label]) => ({ value, label, selected: value === this.item.system.armorType })),
      armorPieces: Object.entries(ARMOR_PIECES).map(([value, label]) => ({ value, label, selected: value === this.item.system.piece }))
    });
  }
}

export function equipmentRows(items) {
  return Array.from(items).map(item => ({
    id: item.id, name: item.name, typeLabel: EQUIPMENT_TYPES[item.type] ?? "Gear",
    quantity: item.system.quantity ?? 1, equipped: !!item.system.equipped,
    canEquip: Object.hasOwn(EQUIPMENT_TYPES, item.type),
    detail: item.type === "weapon" ? [item.system.damage, item.system.damageType,
      item.system.ranged ? "Ranged" : "",
      item.system.family !== "none" ? WEAPON_FAMILIES[item.system.family] : "",
      ...Object.entries(WEAPON_PROPERTIES).filter(([key]) => item.system.properties?.[key]).map(([, label]) => label),
      ...Object.entries(SIGNATURE_PROPERTIES).filter(([key]) => item.system.signature?.[key]).map(([, label]) => label),
      item.system.loading ? `Loading (${item.system.loading})` : "",
      item.system.range?.normal || item.system.range?.long ? `Range ${item.system.range.normal}/${item.system.range.long} ft` : ""
    ].filter(Boolean).join(" · ")
      : item.type === "armor" ? `${ARMOR_TYPES[item.system.armorType] ?? item.system.armorType} · ${ARMOR_PIECES[item.system.piece] ?? item.system.piece} · AR ${item.system.armorRating} · NE +${item.system.evasionBonus}`
        : item.type === "shield" ? `AR ${item.system.armorRating} · Block ${item.system.blockDie}` : ""
  }));
}

export async function createEquipment(actor, type) {
  if (!actor.isOwner || !Object.hasOwn(EQUIPMENT_TYPES, type)) return;
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name: `New ${EQUIPMENT_TYPES[type].toLowerCase()}`, type }]);
  item?.sheet.render({ force: true });
  return item;
}

export async function toggleEquipment(actor, id) {
  const item = actor.items.get(id);
  if (!actor.isOwner || !item || !Object.hasOwn(EQUIPMENT_TYPES, item.type)) return;
  return item.update({ "system.equipped": !item.system.equipped });
}
