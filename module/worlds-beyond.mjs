import { STATS, MILESTONE_SCORES, statModifier, milestonesReached, formatModifier } from "./stats.mjs";

const SYSTEM_ID = "worlds-beyond";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { NumberField, SchemaField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Data model                                  */
/* -------------------------------------------- */

class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const stat = () => new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 12 })
    });
    return {
      level: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
      stats: new SchemaField(Object.fromEntries(STATS.map(s => [s.key, stat()])))
    };
  }

  prepareDerivedData() {
    for (const { key } of STATS) {
      const stat = this.stats[key];
      stat.mod = statModifier(key, stat.value);
      stat.milestones = milestonesReached(stat.value);
    }
  }
}

/* -------------------------------------------- */
/*  Character sheet                             */
/* -------------------------------------------- */

class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet"],
    position: { width: 680, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollStat: CharacterSheet.#onRollStat,
      pickPortrait: CharacterSheet.#onPickPortrait
    }
  };

  static PARTS = {
    sheet: { template: `systems/${SYSTEM_ID}/templates/character-sheet.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const rows = STATS.map(def => {
      const stat = system.stats[def.key];
      return {
        ...def,
        value: stat.value,
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
      groups: [
        { title: "Physical", rows: rows.filter(r => r.group === "physical") },
        { title: "Mental", rows: rows.filter(r => r.group === "mental") }
      ]
    });
  }

  static async #onRollStat(event, target) {
    const def = STATS.find(s => s.key === target.dataset.stat);
    if (!def) return;
    const mod = this.actor.system.stats[def.key].mod;
    const roll = new foundry.dice.Roll("1d20 + @mod", { mod });
    await roll.toMessage({
      speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
      flavor: `${def.label} check`
    });
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
  CONFIG.Actor.dataModels.character = CharacterData;

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
