import { STATS, MILESTONE_SCORES, statModifier, milestonesReached, formatModifier } from "./stats.mjs";
import { coreNumbers, numberOr, healthFromDamage, damageFromHealth } from "./core-numbers.mjs";
import { CharacterActor } from "./character-actor.mjs";
import { CharacterCombatant } from "./character-combatant.mjs";
import { wonderPool } from "./rolls.mjs";
import { wornEquipment } from "./equipment-core.mjs";
import { bindStatInput, editedStatInputs } from "./stat-input.mjs";
import { EQUIPMENT_MODELS, EquipmentSheet, EQUIPMENT_TYPES, equipmentRows, createEquipment, toggleEquipment } from "./equipment.mjs";
import { promptStatCheck, longRest, decorateRollMessage, refreshWonderControls } from "./roll-actions.mjs";

const SYSTEM_ID = "worlds-beyond";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { NumberField, SchemaField, StringField, BooleanField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Data model                                  */
/* -------------------------------------------- */

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const number = (initial = 0, options = {}) => new NumberField({ required: true, nullable: false, initial, ...options });
    const override = () => number(null, { nullable: true });
    const pool = () => new SchemaField({
      value: override(),
      maxOverride: override(),
      max: number(0, { persisted: false })
    });
    const stat = () => new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 12 }),
      manual: new BooleanField({ initial: false }),
      resetValue: override()
    });
    return {
      level: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
      stats: new SchemaField(Object.fromEntries(STATS.map(s => [s.key, stat()]))),
      health: new SchemaField({
        damage: number(),
        maxOverride: override(),
        value: number(0, { persisted: false }),
        max: number(0, { persisted: false })
      }),
      ap: pool(),
      reactions: pool(),
      wonder: pool(),
      bonuses: new SchemaField({ armor: number(), evasion: number() }),
      overrides: new SchemaField({
        hitDie: new StringField({ required: true, nullable: false, initial: "", blank: true }),
        evasion: override(),
        armorRating: override(),
        movement: override(),
        armorAgilityPenalty: override()
      })
    };
  }

  prepareDerivedData() {
    this.equipment = wornEquipment({
      items: this.parent?.items ?? [], agility: this.stats.agl.value, strength: this.stats.str.value,
      penaltyOverride: this.overrides.armorAgilityPenalty
    });
    for (const { key } of STATS) {
      const stat = this.stats[key];
      stat.effective = key === "agl" ? this.equipment.effectiveAgility : stat.value;
      stat.mod = statModifier(key, stat.effective);
      stat.milestones = milestonesReached(stat.effective);
    }
    this.core = coreNumbers({
      level: this.level,
      stats: { ...this.stats, agl: { value: this.equipment.effectiveAgility } },
      bonuses: { armor: this.equipment.armor + this.bonuses.armor, evasion: this.equipment.evasion + this.bonuses.evasion },
      overrides: {
        ...this.overrides,
        healthMax: this.health.maxOverride,
        apMax: this.ap.maxOverride,
        reactionsMax: this.reactions.maxOverride
      }
    });
    this.health.max = this.core.healthMax;
    this.health.value = healthFromDamage(this.health.max, this.health.damage);
    this.ap.max = this.core.apMax;
    this.ap.value = numberOr(this.ap.value, this.ap.max);
    this.reactions.max = this.core.reactionsMax;
    this.reactions.value = numberOr(this.reactions.value, this.reactions.max);
    Object.assign(this.wonder, wonderPool(this.stats.fth.value, this.wonder));
  }

  async _preCreate(data, options, user) {
    if (await super._preCreate(data, options, user) === false) return false;
    const defaults = {};
    // Honor supplied token settings, including an explicitly cleared bar.
    if (!foundry.utils.hasProperty(data, "prototypeToken.bar1.attribute")) defaults["prototypeToken.bar1.attribute"] = "health";
    if (!foundry.utils.hasProperty(data, "prototypeToken.bar2.attribute")) defaults["prototypeToken.bar2.attribute"] = "ap";
    this.parent.updateSource(defaults);
  }
}

/* -------------------------------------------- */
/*  Character sheet                             */
/* -------------------------------------------- */

export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet"],
    position: { width: 720, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollStat: CharacterSheet.#onRollStat,
      longRest: CharacterSheet.#onLongRest,
      equipment: CharacterSheet.#onEquipment,
      pickPortrait: CharacterSheet.#onPickPortrait
    }
  };

  static PARTS = {
    sheet: { template: `systems/${SYSTEM_ID}/templates/character-sheet.hbs`, scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const source = system.toObject();
    const rows = STATS.map(def => {
      const stat = system.stats[def.key];
      const baseValue = source.stats[def.key].value;
      const value = stat.effective ?? stat.value;
      return {
        ...def,
        value, baseValue,
        defaultValue: source.stats[def.key].resetValue ?? (source.stats[def.key].manual ? 12 : baseValue),
        adjusted: value !== baseValue,
        manual: !!source.stats[def.key].manual,
        modLabel: formatModifier(stat.mod),
        negative: stat.mod < 0,
        pips: def.milestones.map((name, i) => ({
          name,
          score: MILESTONE_SCORES[i],
          lit: stat.milestones > i
        }))
      };
    });
    return Object.assign(context, {
      actor: this.actor,
      system,
      editable: this.isEditable,
      resources: [
        { key: "health", label: "Health", inputName: "healthCurrent", ...system.health },
        { key: "ap", label: "Action Points", inputName: "system.ap.value", ...system.ap },
        { key: "reactions", label: "Reactions", inputName: "system.reactions.value", ...system.reactions },
        { key: "wonder", label: "Wonder", inputName: "system.wonder.value", ...system.wonder }
      ],
      defyFate: system.stats.fth.value >= 21,
      worn: system.equipment,
      equipment: equipmentRows(this.actor.items ?? []),
      coreDetails: [
        { key: "hitDie", label: "Hit die", value: system.core.hitDie, type: "text" },
        { key: "evasion", label: "Natural Evasion", value: system.core.evasion, type: "number" },
        { key: "armorRating", label: "Armor Rating", value: system.core.armorRating, type: "number" },
        { key: "movement", label: "Movement / AP", value: system.core.movement, unit: "ft", type: "number" }
      ].map(detail => ({ ...detail, override: system.overrides[detail.key], automatic: system.core.automatic[detail.key] })),
      groups: [
        { title: "Physical", rows: rows.filter(r => r.group === "physical") },
        { title: "Mental", rows: rows.filter(r => r.group === "mental") }
      ]
    });
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    delete data.statScores;
    for (const [key, value] of editedStatInputs(form)) {
      if (!STATS.some(stat => stat.key === key) || (value !== null && !Number.isFinite(value))) continue;
      const source = this.actor.system.toObject().stats[key];
      const resetValue = source.resetValue ?? (source.manual ? 12 : source.value);
      foundry.utils.setProperty(data, `system.stats.${key}.value`, value === null ? resetValue : value);
      foundry.utils.setProperty(data, `system.stats.${key}.manual`, value !== null);
      foundry.utils.setProperty(data, `system.stats.${key}.resetValue`, value === null ? null : resetValue);
    }
    const current = data.healthCurrent;
    delete data.healthCurrent;
    // A full sheet submission includes unchanged trackers. Do not turn an unrelated
    // stat edit into healing or refill a spent pool just by submitting the form.
    for (const key of ["ap", "reactions", "wonder"]) {
      if (data.system?.[key] && numberOr(data.system[key].value, null) === this.actor.system[key].value) {
        delete data.system[key].value;
      }
    }
    if (current !== undefined && numberOr(current, null) !== this.actor.system.health.value) {
      const maximum = this.actor.clone(data).system.health.max;
      foundry.utils.setProperty(data, "system.health.damage", damageFromHealth(maximum, numberOr(current, maximum)));
    }
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.isEditable) for (const input of this.element.querySelectorAll("[data-stat-score]")) bindStatInput(input);
  }

  static async #onRollStat(event, target) {
    try { return await promptStatCheck(this.actor, target.dataset.stat); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onLongRest() {
    if (!this.isEditable) return;
    try { return await longRest(this.actor); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onEquipment(event, target) {
    const operation = target.dataset.operation;
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (operation !== "edit" && !this.isEditable) return;
    try {
      if (operation === "create") return await createEquipment(this.actor, target.dataset.type);
      if (operation === "edit") return item?.sheet.render({ force: true });
      if (operation === "toggle") return await toggleEquipment(this.actor, item?.id);
      if (operation === "delete" && item && await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remove equipment" }, content: "<p>Remove this item from this character?</p>", rejectClose: false
      })) return await item.delete();
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async #onPickPortrait(event, target) {
    if (!this.isEditable) return;
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const picker = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: path => this.actor.update({ img: path })
    });
    return picker.browse();
  }
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once("init", () => {
  CONFIG.Actor.documentClass = CharacterActor;
  CONFIG.Combatant.documentClass = CharacterCombatant;
  CONFIG.Actor.dataModels.character = CharacterData;
  Object.assign(CONFIG.Item.dataModels, EQUIPMENT_MODELS);
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, EquipmentSheet, {
    types: Object.keys(EQUIPMENT_TYPES), makeDefault: true, label: "Worlds Beyond Equipment"
  });
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["health", "ap", "reactions"], value: ["core.evasion", "core.armorRating", "core.movement"] }
  };

  // Initiative is d20 + Wisdom modifier.
  CONFIG.Combat.initiative = { formula: "1d20 + @stats.wis.mod", decimals: 0 };

  const Actors = foundry.documents.collections.Actors;
  Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet(SYSTEM_ID, CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Worlds Beyond Character Sheet"
  });
});

Hooks.on("renderChatMessageHTML", decorateRollMessage);
Hooks.on("updateActor", refreshWonderControls);
Hooks.on("createChatMessage", refreshWonderControls);
