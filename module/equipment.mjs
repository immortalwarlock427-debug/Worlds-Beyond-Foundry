import { defaultSlots, consumableUse, healedDamage } from "./equipment-core.mjs";
import { shotsLeft } from "./attacks.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { itemIcon } from "./item-icons.mjs";

const SYSTEM_ID = "worlds-beyond";
// Equippable types; ITEM_TYPES adds carried-only items.
export const EQUIPMENT_TYPES = Object.freeze({ weapon: "Weapon", armor: "Armor", shield: "Shield" });
export const ITEM_TYPES = Object.freeze({ ...EQUIPMENT_TYPES, consumable: "Consumable", misc: "Miscellaneous" });
export const CONSUMABLE_KINDS = Object.freeze({ potion: "Potion", ammunition: "Ammunition", other: "Other" });
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

class CarriedData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: text(), quantity: number(1), slots: number(1), perSlot: number(1), cost: text() };
  }
}

class EquipmentData extends CarriedData {
  static defineSchema() {
    return { ...super.defineSchema(), equipped: new foundry.data.fields.BooleanField({ initial: false }) };
  }
}

// Ammunition and potions stack 5 to a slot.
export class ConsumableData extends CarriedData {
  static defineSchema() {
    return {
      ...super.defineSchema(), perSlot: number(5),
      kind: text("potion", { choices: CONSUMABLE_KINDS, blank: false }),
      healingDice: text()
    };
  }
}

export class MiscData extends CarriedData {}

export class WeaponData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      family: text("balanced", { choices: WEAPON_FAMILIES, blank: false }),
      ranged: new foundry.data.fields.BooleanField({ required: true, nullable: false, initial: false }),
      damage: text(), versatileDamage: text(), damageType: text(),
      properties: flags(WEAPON_PROPERTIES), signature: flags(SIGNATURE_PROPERTIES),
      range: new foundry.data.fields.SchemaField({ normal: number(), long: number() }),
      loading: number(),
      // Shots left before reloading; null means fully loaded.
      shots: new foundry.data.fields.NumberField({ required: true, nullable: true, initial: null, min: 0, integer: true })
    };
  }

  // A new Two-handed weapon takes 2 slots unless its data already says otherwise.
  async _preCreate(data, options, user) {
    if (await super._preCreate?.(data, options, user) === false) return false;
    if (!foundry.utils.hasProperty(data, "system.slots") && data.system?.properties?.twoHanded) {
      this.parent.updateSource({ "system.slots": 2 });
    }
  }

  // Toggling Two-handed moves the slot size between 1 and 2, unless the player
  // changed the slot size themselves (it no longer matches the old default).
  async _preUpdate(changes, options, user) {
    if (await super._preUpdate?.(changes, options, user) === false) return false;
    // Sheets submit every field, so compare against saved values rather than presence.
    const twoHanded = foundry.utils.getProperty(changes, "system.properties.twoHanded");
    if (twoHanded === undefined || !!twoHanded === !!this.properties?.twoHanded) return;
    const slots = foundry.utils.getProperty(changes, "system.slots");
    if (slots !== undefined && Number(slots) !== this.slots) return;
    if (this.slots === defaultSlots("weapon", this)) {
      foundry.utils.setProperty(changes, "system.slots", defaultSlots("weapon", { properties: { twoHanded } }));
    }
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
    return { ...super.defineSchema(), slots: number(2), armorRating: number(), blockDie: text("1d6") };
  }
}

export const EQUIPMENT_MODELS = Object.freeze({ weapon: WeaponData, armor: ArmorData, shield: ShieldData, consumable: ConsumableData, misc: MiscData });

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
      artwork: itemIcon(this.item),
      typeLabel: ITEM_TYPES[this.item.type],
      propertySummary: Object.entries(WEAPON_PROPERTIES).filter(([key]) => this.item.system.properties?.[key]).map(([, label]) => label).join(" · ") || "None",
      signatureSummary: Object.entries(SIGNATURE_PROPERTIES).filter(([key]) => this.item.system.signature?.[key]).map(([, label]) => label).join(" · ") || "None",
      weapon: this.item.type === "weapon", armor: this.item.type === "armor", shield: this.item.type === "shield",
      consumable: this.item.type === "consumable", equippable: Object.hasOwn(EQUIPMENT_TYPES, this.item.type),
      consumableKinds: Object.entries(CONSUMABLE_KINDS).map(([value, label]) => ({ value, label, selected: value === this.item.system.kind })),
      weaponFamilies: Object.entries(WEAPON_FAMILIES).map(([value, label]) => ({ value, label, selected: value === this.item.system.family })),
      weaponProperties: Object.entries(WEAPON_PROPERTIES).map(([key, label]) => ({ key, label, checked: !!this.item.system.properties?.[key] })),
      signatureProperties: Object.entries(SIGNATURE_PROPERTIES).map(([key, label]) => ({ key, label, checked: !!this.item.system.signature?.[key] })),
      armorTypes: Object.entries(ARMOR_TYPES).map(([value, label]) => ({ value, label, selected: value === this.item.system.armorType })),
      armorPieces: Object.entries(ARMOR_PIECES).map(([value, label]) => ({ value, label, selected: value === this.item.system.piece }))
    });
  }
}

export function equipmentRows(items, slotsUsed = {}) {
  return Array.from(items).map(item => ({
    id: item.id, name: item.name, type: item.type, typeLabel: ITEM_TYPES[item.type] ?? "Gear", img: itemIcon(item),
    equipIcon: item.type === "shield" ? "fa-shield-halved" : item.type === "armor" ? "fa-shirt" : "fa-hand",
    canUse: item.type === "consumable",
    canAttack: item.type === "weapon" && !!item.system.equipped,
    canReload: item.type === "weapon" && item.system.loading > 0,
    shots: item.type === "weapon" ? shotsLeft(item) : null,
    quantity: item.system.quantity ?? 1, equipped: !!item.system.equipped,
    showQuantity: (item.system.quantity ?? 1) !== 1 || ["consumable", "misc", "gear"].includes(item.type),
    slots: slotsUsed[item.id] ?? null,
    canEquip: Object.hasOwn(EQUIPMENT_TYPES, item.type),
    brief: item.type === "weapon" ? [item.system.damage, item.system.damageType, item.system.loading ? `${shotsLeft(item)}/${item.system.loading} shots` : ""].filter(Boolean).join(" · ")
      : item.type === "armor" ? `AR ${item.system.armorRating} · Evasion +${item.system.evasionBonus}`
        : item.type === "shield" ? `Block ${item.system.blockDie} · AR ${item.system.armorRating}`
          : item.type === "consumable" && item.system.healingDice ? `Healing ${item.system.healingDice}` : "",
    detail: item.type === "weapon" ? [item.system.damage, item.system.damageType,
      item.system.ranged ? "Ranged" : "",
      item.system.family !== "none" ? WEAPON_FAMILIES[item.system.family] : "",
      ...Object.entries(WEAPON_PROPERTIES).filter(([key]) => item.system.properties?.[key]).map(([, label]) => label),
      ...Object.entries(SIGNATURE_PROPERTIES).filter(([key]) => item.system.signature?.[key]).map(([, label]) => label),
      item.system.loading ? `Loading (${item.system.loading}) · ${shotsLeft(item)} loaded` : "",
      item.system.range?.normal || item.system.range?.long ? `Range ${item.system.range.normal}/${item.system.range.long} ft` : ""
    ].filter(Boolean).join(" · ")
      : item.type === "armor" ? `${ARMOR_TYPES[item.system.armorType] ?? item.system.armorType} · ${ARMOR_PIECES[item.system.piece] ?? item.system.piece} · AR ${item.system.armorRating} · NE +${item.system.evasionBonus}`
        : item.type === "shield" ? `AR ${item.system.armorRating} · Block ${item.system.blockDie}`
          : item.type === "consumable" ? [CONSUMABLE_KINDS[item.system.kind] ?? item.system.kind,
            item.system.healingDice ? `Heals ${item.system.healingDice}` : "", `${item.system.perSlot} per slot`].filter(Boolean).join(" · ")
            : item.type === "misc" && item.system.perSlot > 1 ? `${item.system.perSlot} per slot` : ""
  }));
}

export function groupEquipmentRows(rows) {
  const known = new Set(["weapon", "armor", "shield", "consumable"]);
  return [["weapon", "Weapons"], ["armor", "Armor"], ["shield", "Shields"], ["consumable", "Consumables"], ["misc", "Gear"]]
    .map(([type, label]) => ({ label, rows: rows.filter(row => type === "misc" ? !known.has(row.type) : row.type === type) }))
    .filter(group => group.rows.length);
}

export async function createEquipment(actor, type) {
  if (!actor.isOwner || !Object.hasOwn(ITEM_TYPES, type)) return;
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name: `New ${ITEM_TYPES[type].toLowerCase()}`, type }]);
  item?.sheet.render({ force: true });
  return item;
}

export async function toggleEquipment(actor, id) {
  const item = actor.items.get(id);
  if (!actor.isOwner || !item || !Object.hasOwn(EQUIPMENT_TYPES, item.type)) return;
  return item.update({ "system.equipped": !item.system.equipped });
}

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// Spend one consumable and post a card. Healing dice are rolled, and the card
// offers to apply them so the player confirms before Health changes.
export async function useConsumable(actor, id) {
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const item = actor.items.get(id);
    if (!actor.isOwner || item?.type !== "consumable") return;
    const use = consumableUse(item.system.quantity);
    if (!use.ok) throw new Error(use.message);
    const formula = String(item.system.healingDice ?? "").trim();
    let roll = null;
    if (formula) {
      if (!foundry.dice.Roll.validate(formula)) throw new Error("Enter complete healing dice such as 2d6+2, or leave healing blank.");
      roll = await new foundry.dice.Roll(formula).evaluate({ allowInteractive: messageMode !== "blind" });
    }
    const amount = roll ? Math.max(0, roll.total) : 0;
    const content = `<div class="worlds-beyond wb-consumable-card"><h3>${escapeHTML(item.name)}</h3>`
      + (item.system.description ? `<details class="wb-disclosure wb-help"><summary>Item description</summary><p>${escapeHTML(item.system.description)}</p></details>` : "")
      + `<p>One used, ${use.quantity} left.${roll ? ` Healing: ${amount}.` : " Apply any effects at the table."}</p>`
      + (roll ? await roll.render() : "") + "</div>";
    await change(() => item.update({ "system.quantity": use.quantity }), () => item.update({ "system.quantity": item.system.quantity + 1 }));
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content, rolls: roll ? [roll] : [],
      flags: { [SYSTEM_ID]: { consumable: { actorUuid: actor.uuid, amount, applied: false } } }
    }, { messageMode });
  }));
}

export async function applyConsumableHealing(message) {
  if (!message.isContentVisible) return;
  const context = message.getFlag(SYSTEM_ID, "consumable");
  if (!context) return;
  const actor = await foundry.utils.fromUuid(context.actorUuid);
  if (!actor?.isOwner) return;
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
      const data = structuredClone(message.getFlag(SYSTEM_ID, "consumable"));
      if (!data || data.applied || !(data.amount > 0)) return;
      await change(() => message.setFlag(SYSTEM_ID, "consumable", { ...data, applied: true }), () => message.setFlag(SYSTEM_ID, "consumable", data));
      const updated = await actor.update({ "system.health.damage": healedDamage(actor.system.health.damage, data.amount) });
      if (!updated) throw new Error("Healing update was cancelled.");
      return updated;
  }));
}

export function decorateConsumableMessage(message, html) {
  if (!message.isContentVisible) return;
  const data = message.getFlag?.(SYSTEM_ID, "consumable");
  if (!data || !(data.amount > 0)) return;
  const actor = foundry.utils.fromUuidSync(data.actorUuid);
  const content = html.querySelector(".wb-consumable-card");
  if (!actor?.isOwner || !content || content.querySelector(".wb-consumable-heal")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wb-consumable-heal";
  button.disabled = !!data.applied;
  button.textContent = data.applied ? `Healed ${data.amount}` : `Apply ${data.amount} healing to me`;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await applyConsumableHealing(message); }
    catch (error) { button.disabled = false; ui.notifications.error(error.message); }
  });
  content.append(button);
}
