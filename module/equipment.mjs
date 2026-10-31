const SYSTEM_ID = "worlds-beyond";
export const EQUIPMENT_TYPES = Object.freeze({ weapon: "Weapon", armor: "Armor", shield: "Shield" });
export const ARMOR_TYPES = { light: "Light", medium: "Medium", heavy: "Heavy" };
export const ARMOR_PIECES = {
  chest: "Chest", pants: "Pants", arms: "Arm guards", legs: "Leg guards (pair)", helmet: "Helmet"
};

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, NumberField, BooleanField } = foundry.data.fields;
    const text = (initial = "") => new StringField({ required: true, nullable: false, initial, blank: true });
    const number = (initial = 0) => new NumberField({ required: true, nullable: false, initial });
    return {
      description: text(), quantity: number(1), slots: number(1), cost: text(),
      equipped: new BooleanField({ initial: false }),
      damage: text(), versatileDamage: text(), damageType: text(),
      properties: text(), signature: text(), range: text(), loading: text(),
      armorType: text("light"), piece: text("chest"),
      armorRating: number(), evasionBonus: number(), blockDie: text("1d6")
    };
  }
}

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
    detail: item.type === "weapon" ? [item.system.damage, item.system.damageType, item.system.properties].filter(Boolean).join(" · ")
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
