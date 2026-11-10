import { STATS, statModifier, milestonesReached } from "./stats.mjs";
import { coreNumbers, numberOr, healthFromDamage, damageFromHealth } from "./core-numbers.mjs";
import { CharacterActor } from "./character-actor.mjs";
import { CharacterCombatant, registerCombatPortraits } from "./character-combatant.mjs";
import { refillTurnResources } from "./character-combat.mjs";
import { wonderPool } from "./rolls.mjs";
import { MAGIC_RESOURCES, RESOURCE_SCALING, RESOURCE_DISPLAYS, customResourceId, magicPool, customPool } from "./resources.mjs";
import { applyFormMaximum } from "./resources.mjs";
import { restoreDisclosures, continueVortex } from "./sheet-state.mjs";
import { imagePicker } from "./image-picker.mjs";
import { addResource, resourceAction, resourceFormUpdates } from "./resource-actions.mjs";
import { queuedAction } from "./action-support.mjs";
import { wornEquipment, inventory, blockDice } from "./equipment-core.mjs";
import { bindStatInput, editedStatInputs } from "./stat-input.mjs";
import { wholeNumber, wholeFormUpdates, bindWholeNumbers } from "./number-display.mjs";
import { AbilityData, AbilitySheet, createAbility, createSpell, useAbility } from "./abilities.mjs";
import { registerSchemaVersion, runMigrations } from "./migrations.mjs";
import { promptCommand, receiveCommand, decorateCommand, refreshCommandControls } from "./command.mjs";
import { apTotal } from "./ap.mjs";
import { commandReady } from "./combat-support.mjs";
import { effectContext, effectRows } from "./effects-core.mjs";
import { toggleEffect, openEffect, registerEffectSupport } from "./effects.mjs";
import { returnToBase } from "./forms.mjs";
import { registerFormLoadouts, setCharacterPortrait, formResourceState, configureFormResourceMaximum } from "./form-loadouts.mjs";
import { configureFavorites, configureArchive } from "./overview.mjs";
import { barColorFormUpdates } from "./bar-colors.mjs";
import { registerFormTriggers } from "./form-triggers.mjs";
import { registerAbilityTimers } from "./ability-timers.mjs";
import { registerRecovery } from "./recovery-actions.mjs";
import { openMilestones } from "./milestone-sheet.mjs";
import { milestoneActionRows, useMilestone, setMilestoneUses, rollStabilize, registerMilestoneActions } from "./milestone-actions.mjs";
import { STAT_AWARD_LEVELS, statIncreases } from "./stat-advancement.mjs";
import { openStatSetup } from "./stat-setup.mjs";
import {
  EQUIPMENT_MODELS,
  EquipmentSheet,
  ITEM_TYPES,
  equipmentRows,
  groupEquipmentRows,
  createEquipment,
  toggleEquipment,
  chooseBodySlot,
  clearBodySlot,
  useConsumable,
  decorateConsumableMessage
} from "./equipment.mjs";
import { decorateSystemMessage } from "./chat-style.mjs";
import { decorateEquipmentDirectory } from "./item-artwork.mjs";
import { registerCatalogSetting, registerCatalogMenu, offerCatalogImport, importCatalog } from "./catalog-import.mjs";
import { promptAttack, reloadWeapon, decorateAttackMessage } from "./attack-actions.mjs";
import { decorateAttackDefenses } from "./attack-defense.mjs";
import { registerEquipmentItem } from "./equipment-item.mjs";
import { registerSheetLog, openSheetLog } from "./dm-log.mjs";
import { registerMovementRuler } from "./movement-ruler.mjs";
import { registerMovement, movementSetting } from "./movement.mjs";
import { registerOpportunityAttacks } from "./opportunity.mjs";
import { registerPositioning } from "./positioning.mjs";
import { registerTokenConfig } from "./token-config.mjs";
import { registerDarknessFade } from "./darkness-fade.mjs";
import { registerTokenAttacks } from "./token-attacks.mjs";
import { registerStrikes } from "./strike.mjs";
import { registerHealing } from "./healing.mjs";
import { registerConditions, endConditionAction, removeCondition } from "./conditions.mjs";
import { registerDeath, dyingContext, stabilize, treat } from "./death.mjs";
import { registerConditionRolls } from "./condition-rolls.mjs";
import { registerConditionActions } from "./condition-actions.mjs";
import { registerConditionMovement, promptMobilityAction } from "./condition-movement.mjs";
import { registerPetrified } from "./petrified.mjs";
import { registerUnconscious } from "./unconscious.mjs";
import { registerExhaustion, exhaustionAutomated, exhaustionContext, overexert } from "./exhaustion.mjs";
import { registerVfx } from "./vfx.mjs";
import { isTargetedAbility, useTargetedAbility } from "./area-targeting.mjs";
import { promptBlock, promptDodge, promptParry, decorateReactionMessage } from "./reaction-actions.mjs";
import { promptStatCheck, longRest, decorateRollMessage, refreshWonderControls } from "./roll-actions.mjs";
import { CHARACTER_DETAILS, prepareCharacterSheetContext } from "./character-context.mjs";
import { promptShortRest } from "./rest-actions.mjs";
import { configureResistances } from "./resistance-actions.mjs";

const SYSTEM_ID = "worlds-beyond";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { NumberField, SchemaField, StringField, BooleanField, TypedObjectField, ArrayField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Data model                                  */
/* -------------------------------------------- */

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const number = (initial = 0, options = {}) => new NumberField({ required: true, nullable: false, initial, ...options });
    const override = () => number(null, { nullable: true });
    const barColors = () =>
      new SchemaField(
        Object.fromEntries(
          ["start", "end"].map(key => [key, new StringField({ required: true, nullable: false, blank: true, initial: "" })])
        )
      );
    const pool = () =>
      new SchemaField({
        barColors: barColors(),
        value: override(),
        maxOverride: override(),
        max: number(0, { persisted: false })
      });
    const stat = () =>
      new SchemaField({
        // Stores the component before earned points. A manual correction below
        // the award total can make this component negative; the displayed base
        // still includes the earned points, exactly as on the website.
        value: new NumberField({ required: true, nullable: false, integer: true, initial: 12 }),
        manual: new BooleanField({ initial: false }),
        resetValue: override()
      });
    const resource = () => ({
      barColors: barColors(),
      spent: number(),
      bonus: number(),
      amount: number(1, { min: 0 }),
      regen: number(0, { min: 0 }),
      autoRecover: new BooleanField({ initial: false }),
      refillOnRest: new BooleanField({ initial: true }),
      allowOverflow: new BooleanField({ initial: false }),
      maxOverride: number(null, { nullable: true, min: 0 }),
      minOverride: override(),
      currentLimit: number(null, { nullable: true, min: 0 }),
      display: new StringField({ required: true, nullable: false, blank: false, initial: "number", choices: RESOURCE_DISPLAYS }),
      value: number(0, { persisted: false }),
      max: number(0, { persisted: false }),
      min: number(0, { persisted: false })
    });
    const magicResource = () =>
      new SchemaField({
        ...resource(),
        enabled: new BooleanField({ initial: false })
      });
    return {
      resistances: new ArrayField(new StringField({ required: true, nullable: false, blank: false }), { initial: [] }),
      immunities: new ArrayField(new StringField({ required: true, nullable: false, blank: false }), { initial: [] }),
      appearance: new SchemaField({
        baseFormName: new StringField({ required: true, nullable: false, blank: true, initial: "" }),
        portraitY: number(35, { integer: true, min: 0, max: 100 })
      }),
      favorites: new ArrayField(new StringField({ required: true, nullable: false, blank: true, initial: "" }), { initial: [] }),
      level: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
      exhaustion: number(0, { integer: true, min: 0, max: 10 }),
      details: new SchemaField(
        Object.fromEntries(
          CHARACTER_DETAILS.map(({ key }) => [
            key,
            new StringField({ required: true, nullable: false, blank: true, trim: false, initial: "" })
          ])
        )
      ),
      stats: new SchemaField(Object.fromEntries(STATS.map(s => [s.key, stat()]))),
      advancement: new SchemaField(
        Object.fromEntries(
          STAT_AWARD_LEVELS.map(level => [
            `level${level}`,
            new SchemaField(Object.fromEntries(STATS.map(s => [s.key, number(0, { integer: true, min: 0, max: 2 })])))
          ])
        )
      ),
      health: new SchemaField({
        barColors: barColors(),
        damage: number(),
        allowOverflow: new BooleanField({ initial: false }),
        maxOverride: override(),
        value: number(0, { persisted: false }),
        max: number(0, { persisted: false })
      }),
      // Death and Dying: Trauma lowers the Death Threshold until a long rest; stabilized stops Bleeding Out.
      dying: new SchemaField({
        trauma: number(0, { integer: true, min: 0 }),
        stabilized: new BooleanField({ initial: false })
      }),
      ap: pool(),
      command: new SchemaField({ value: number(), fresh: new BooleanField({ initial: false }) }),
      reactions: pool(),
      wonder: pool(),
      mana: magicResource(),
      holyPower: magicResource(),
      customResources: new TypedObjectField(
        new SchemaField({
          ...resource(),
          name: new StringField({ required: true, nullable: false, blank: true, initial: "Resource" }),
          scaleStat: new StringField({ required: true, nullable: false, blank: true, initial: "", choices: RESOURCE_SCALING }),
          baseMax: number(100, { min: 0 })
        }),
        { validateKey: customResourceId }
      ),
      bonuses: new SchemaField({ armor: number(), evasion: number(), movement: number() }),
      inventory: new SchemaField({ backpack: new BooleanField({ initial: false }) }),
      hitDice: new SchemaField({ spent: number(0, { integer: true, min: 0 }) }),
      currency: new SchemaField({
        gc: number(0, { integer: true, min: 0 }),
        pc: number(0, { integer: true, min: 0 })
      }),
      overrides: new SchemaField({
        hitDie: new StringField({ required: true, nullable: false, initial: "", blank: true }),
        evasion: override(),
        armorRating: override(),
        movement: override(),
        armorAgilityPenalty: override(),
        squareCost: number(null, { nullable: true, min: 0 }),
        inventorySlots: override()
      })
    };
  }

  prepareBaseData() {
    // Permanent increases join the base before Foundry applies Active Effects.
    // Only the allocation is persisted, never the augmented value.
    const source = this._source; // Read persisted values without copying or changing them.
    const increases = statIncreases(source.level, source.advancement);
    for (const { key } of STATS) this.stats[key].value = source.stats[key].value + increases[key];
  }

  prepareDerivedData() {
    this.equipment = wornEquipment({
      items: this.parent?.items ?? [],
      agility: this.stats.agl.value,
      strength: this.stats.str.value,
      penaltyOverride: this.overrides.armorAgilityPenalty,
      squareCostOverride: this.overrides.squareCost,
      heavySquares: movementSetting("heavyArmorSquares")
    });
    for (const { key } of STATS) {
      const stat = this.stats[key];
      stat.effective = key === "agl" ? this.equipment.effectiveAgility : stat.value;
      stat.mod = statModifier(key, stat.effective);
      stat.milestones = milestonesReached(stat.effective);
    }
    this.core = coreNumbers({
      level: this.level,
      exhaustion: exhaustionAutomated() ? this.exhaustion : 0,
      stats: { ...this.stats, agl: { value: this.equipment.effectiveAgility } },
      bonuses: {
        armor: this.equipment.armor + this.bonuses.armor,
        evasion: this.equipment.evasion + this.bonuses.evasion,
        movement: this.bonuses.movement
      },
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
    const formResources = formResourceState(this.parent);
    for (const [key, def] of Object.entries(MAGIC_RESOURCES)) {
      const resource = this[key];
      if (resource)
        Object.assign(
          resource,
          applyFormMaximum(
            magicPool(this.level, this.stats[def.stat].effective, resource),
            resource.spent,
            formResources?.maxima?.[key],
            formResources?.name
          )
        );
    }
    for (const [key, resource] of Object.entries(this.customResources ?? {}))
      Object.assign(
        resource,
        applyFormMaximum(customPool(resource, this), resource.spent, formResources?.maxima?.[key], formResources?.name)
      );
    const items = this.parent?.items ?? [];
    this.carrying = inventory({
      items,
      strengthMod: this.stats.str.mod,
      backpack: this.inventory.backpack,
      capacityOverride: this.overrides.inventorySlots
    });
    this.block = blockDice({ level: this.level, items });
  }

  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
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
    classes: [SYSTEM_ID, "wb-sheet", "wb-character-sheet"],
    position: { width: 880, height: 900 },
    window: { resizable: true, contentClasses: ["wb-body"] },
    form: { submitOnChange: true },
    actions: {
      rollStat: CharacterSheet.#onRollStat,
      statSetup: CharacterSheet.#onStatSetup,
      milestones: CharacterSheet.#onMilestones,
      milestoneAction: CharacterSheet.#onMilestoneAction,
      dying: async function (event, target) {
        try {
          if (target.dataset.operation === "treat") return await treat(this.actor);
          if (target.dataset.operation === "stabilize") return await stabilize(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      longRest: CharacterSheet.#onLongRest,
      overexert: async function () {
        if (!this.isEditable) return;
        try {
          return await overexert(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      resistances: async function () {
        if (!this.isEditable) return;
        try {
          return await configureResistances(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      shortRest: async function () {
        if (!this.isEditable) return;
        try {
          return await promptShortRest(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      block: CharacterSheet.#onBlock,
      dodge: CharacterSheet.#onDodge,
      parry: CharacterSheet.#onParry,
      equipment: CharacterSheet.#onEquipment,
      bodySlot: async function (event, target) {
        if (!this.isEditable) return;
        try {
          if (target.dataset.operation === "clear") return await clearBodySlot(this.actor, target.dataset.slot);
          return await chooseBodySlot(this.actor, target.dataset.slot);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      pickPortrait: CharacterSheet.#onPickPortrait,
      viewTab: function (event, target) {
        this.changeTab(target.dataset.tab, "sheet");
      },
      favorites: async function () {
        if (!this.isEditable) return;
        try {
          await configureFavorites(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      archiveAppearance: async function () {
        if (!this.isEditable) return;
        try {
          await configureArchive(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      overviewEdit: function (event, target) {
        this.changeTab("details", "sheet");
        const field = target.dataset.field;
        if (!field) {
          const section = this.element.querySelector('details[data-sync="adjust-values"]');
          if (section) {
            section.open = true;
            section.scrollIntoView({ block: "start" });
          }
          return;
        }
        const input = Array.from(this.element.querySelectorAll("[name]")).find(input => input.name === field);
        input?.scrollIntoView({ block: "center" });
        if (this.isEditable) input?.focus();
      },
      formView: async function (event, target) {
        const key = target.dataset.view === "resources" ? "_showAllFormResources" : "_showAllFormAbilities";
        this[key] = !this[key];
        return this.render({ parts: target.dataset.view === "resources" ? ["character", "details"] : ["abilities"] });
      },
      resource: CharacterSheet.#onResource,
      sheetLog: async function () {
        try {
          return await openSheetLog();
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      ability: CharacterSheet.#onAbility,
      command: async function () {
        if (!this.isEditable) return;
        try {
          await promptCommand(this.actor);
        } catch (error) {
          ui.notifications.error(error.message);
        }
      },
      savedAbility: CharacterSheet.#onSavedAbility,
      status: CharacterSheet.#onStatus
    }
  };

  static PARTS = {
    header: { template: `systems/${SYSTEM_ID}/templates/character-header.hbs` },
    character: { template: `systems/${SYSTEM_ID}/templates/character-overview.hbs`, scrollable: [""] },
    details: {
      template: `systems/${SYSTEM_ID}/templates/character-details.hbs`,
      scrollable: [""],
      templates: [
        `systems/${SYSTEM_ID}/templates/character-details-resources.hbs`,
        `systems/${SYSTEM_ID}/templates/character-details-values.hbs`
      ]
    },
    equipment: { template: `systems/${SYSTEM_ID}/templates/character-equipment.hbs`, scrollable: [""] },
    abilities: { template: `systems/${SYSTEM_ID}/templates/character-abilities.hbs`, scrollable: [""] },
    status: { template: `systems/${SYSTEM_ID}/templates/character-status.hbs`, scrollable: [""] },
    notes: { template: `systems/${SYSTEM_ID}/templates/character-notes.hbs`, scrollable: [""] }
  };
  static TABS = {
    sheet: {
      initial: "character",
      tabs: [
        { id: "character", label: "Character" },
        { id: "details", label: "Details" },
        { id: "equipment", label: "Equipment" },
        { id: "abilities", label: "Abilities" },
        { id: "status", label: "Status" },
        { id: "notes", label: "Notes" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const equipment = equipmentRows(this.actor.items ?? [], system.carrying?.perItem);
    return Object.assign(
      context,
      prepareCharacterSheetContext({
        actor: this.actor,
        source: system._source,
        editable: this.isEditable,
        isGM: !!globalThis.game?.user?.isGM,
        equipment,
        equipmentGroups: groupEquipmentRows(equipment),
        showAllFormAbilities: this._showAllFormAbilities,
        showAllFormResources: this._showAllFormResources,
        commandPending: system.command?.value > 0 ? !commandReady(this.actor) : false
      }),
      { milestoneActions: milestoneActionRows(this.actor), dying: dyingContext(this.actor), exhaustion: exhaustionContext(this.actor) }
    );
  }

  _processFormData(event, form, formData) {
    const systemSource = this.actor.system._source;
    const shownAp = apTotal(this.actor.system);
    const data = wholeFormUpdates(super._processFormData(event, form, formData), form, {
      system: {
        ...this.actor.system,
        ap: { ...this.actor.system.ap, value: shownAp },
        bonuses: systemSource?.bonuses ?? this.actor.system.bonuses,
        mana: { ...this.actor.system.mana, bonus: systemSource?.mana?.bonus },
        holyPower: { ...this.actor.system.holyPower, bonus: systemSource?.holyPower?.bonus },
        customResources: Object.fromEntries(
          Object.entries(this.actor.system.customResources ?? {}).map(([key, pool]) => [
            key,
            { ...pool, bonus: systemSource?.customResources?.[key]?.bonus ?? 0 }
          ])
        )
      }
    });
    barColorFormUpdates(this.actor.system, data);
    // The main AP field includes Command. Manual total corrections change own AP,
    // while the separate Command correction remains explicit and unchanged.
    if (data.system?.ap && Object.hasOwn(data.system.ap, "value")) {
      const entered = numberOr(data.system.ap.value, null);
      if (entered === wholeNumber(shownAp)) delete data.system.ap.value;
      else {
        const grant =
          data.system.command && Object.hasOwn(data.system.command, "value")
            ? numberOr(data.system.command.value, 0)
            : numberOr(this.actor.system.command?.value, 0);
        data.system.ap.value = entered === null ? null : Math.floor(entered) - Math.max(0, grant);
      }
    }
    // Unrelated sheet saves must not resubmit stored narrative text.
    for (const { key } of CHARACTER_DETAILS) {
      if (data.system?.details?.[key] === systemSource?.details?.[key]) delete data.system?.details?.[key];
    }
    delete data.statScores;
    const increases = statIncreases(this.actor.system.level, systemSource?.advancement);
    for (const [key, value] of editedStatInputs(form)) {
      if (!STATS.some(stat => stat.key === key) || (value !== null && !Number.isFinite(value))) continue;
      const source = systemSource.stats[key];
      const resetValue = source.resetValue ?? (source.manual ? 12 : source.value);
      foundry.utils.setProperty(data, `system.stats.${key}.value`, value === null ? resetValue : value - increases[key]);
      foundry.utils.setProperty(data, `system.stats.${key}.manual`, value !== null);
      foundry.utils.setProperty(data, `system.stats.${key}.resetValue`, value === null ? null : resetValue);
    }
    const current = data.healthCurrent;
    delete data.healthCurrent;
    // A full sheet submission includes unchanged trackers. Do not turn an unrelated
    // stat edit into healing or refill a spent pool just by submitting the form.
    for (const key of ["reactions", "wonder"]) {
      if (data.system?.[key] && numberOr(data.system[key].value, null) === wholeNumber(this.actor.system[key].value)) {
        delete data.system[key].value;
      }
    }
    if (current !== undefined && numberOr(current, null) !== wholeNumber(this.actor.system.health.value)) {
      const maximum = this.actor.clone(data).system.health.max;
      foundry.utils.setProperty(data, "system.health.damage", damageFromHealth(maximum, numberOr(current, maximum)));
    }
    return resourceFormUpdates(this.actor, data);
  }

  _syncPartState(partId, newElement, priorElement, state) {
    restoreDisclosures(newElement, state);
    super._syncPartState(partId, newElement, priorElement, state);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._vortexStartedAt ??= performance.now();
    continueVortex(this.element, this._vortexStartedAt);
    // Native read-only actor sheets disable form buttons; rule references are
    // still viewable and never submit a document update.
    for (const button of this.element.querySelectorAll(
      '[data-action="milestones"], [data-action="formView"], [data-action="overviewEdit"], .wb-sheet-tabs [data-action="tab"], [data-action="viewTab"], .wb-favorite-name'
    ))
      button.disabled = false;
    if (this.isEditable)
      for (const input of this.element.querySelectorAll("[data-milestone-uses]"))
        input.addEventListener("change", async event => {
          // A tracker correction, not a sheet field: keep it out of the form submit.
          event.stopPropagation();
          try {
            await setMilestoneUses(this.actor, input.dataset.milestoneUses, input.value);
          } catch (error) {
            ui.notifications.error(error.message);
            this.render();
          }
        });
    if (this.isEditable) bindWholeNumbers(this.element);
    if (this.isEditable) for (const input of this.element.querySelectorAll("[data-stat-score]")) bindStatInput(input);
  }

  async _processSubmitData(event, form, submitData, options = {}) {
    return queuedAction(this.actor.uuid, () => super._processSubmitData(event, form, submitData, options));
  }

  static async #onRollStat(event, target) {
    try {
      return await promptStatCheck(this.actor, target.dataset.stat);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onStatSetup(event, target) {
    if (!this.isEditable) return;
    try {
      return await openStatSetup(this.actor, target.dataset.mode);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onMilestones(event, target) {
    try {
      return await openMilestones(this.actor, target.dataset.stat, target.dataset.threshold);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onMilestoneAction(event, target) {
    if (!this.isEditable) return;
    try {
      if (target.dataset.operation === "stabilize") return await rollStabilize(this.actor);
      return await useMilestone(this.actor, target.closest("[data-milestone-action]")?.dataset.milestoneAction);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onLongRest() {
    if (!this.isEditable) return;
    try {
      return await longRest(this.actor);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onResource(event, target) {
    if (!this.isEditable) return;
    try {
      if (target.dataset.operation === "add") return await addResource(this.actor);
      const card = target.closest("[data-resource-key]");
      const key = card?.dataset.resourceKey;
      const operation = target.dataset.operation;
      if (operation === "formMaximum") return await configureFormResourceMaximum(this.actor, key);
      if (
        operation === "remove" &&
        !(await foundry.applications.api.DialogV2.confirm({
          window: { title: "Remove resource" },
          content: "<p>Remove this custom resource and its balance?</p>",
          rejectClose: false
        }))
      )
        return;
      return await resourceAction(this.actor, key, operation, card?.querySelector("[data-resource-amount]")?.value);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onEquipment(event, target) {
    const operation = target.dataset.operation;
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (operation !== "edit" && !this.isEditable) return;
    try {
      if (operation === "create") return await createEquipment(this.actor, target.dataset.type);
      if (operation === "edit") return item?.sheet.render({ force: true });
      if (operation === "toggle") return await toggleEquipment(this.actor, item?.id);
      if (operation === "use") return await useConsumable(this.actor, item?.id);
      if (operation === "attack") return await promptAttack(this.actor, item?.id);
      if (operation === "reload") return await reloadWeapon(this.actor, item?.id);
      if (
        operation === "delete" &&
        item &&
        (await foundry.applications.api.DialogV2.confirm({
          window: { title: "Remove equipment" },
          content: "<p>Remove this item from this character?</p>",
          rejectClose: false
        }))
      )
        return await item.delete();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onAbility(event, target) {
    const operation = target.dataset.operation;
    if (operation !== "edit" && !this.isEditable) return;
    try {
      if (operation === "create") return await createAbility(this.actor, target.dataset.kind ?? "active");
      if (operation === "spell") return await createSpell(this.actor);
      if (operation === "base") return await returnToBase(this.actor);
      const item = this.actor.items.get(target.closest("[data-ability-id]")?.dataset.abilityId);
      if (item?.type !== "ability") throw new Error("That ability no longer exists. Reopen the sheet.");
      if (operation === "edit") return item.sheet.render({ force: true });
      if (operation === "use" && isTargetedAbility(item)) return await useTargetedAbility(this.actor, item);
      if (["use", "end"].includes(operation)) return await useAbility(this.actor, item.id, { end: operation === "end" });
      if (
        operation === "delete" &&
        (await foundry.applications.api.DialogV2.confirm({
          window: { title: "Remove ability" },
          content: "<p>Remove this ability and its trackers from this character?</p>",
          rejectClose: false
        }))
      )
        return await item.delete();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onSavedAbility(event, target) {
    const operation = target.dataset.operation;
    if (operation !== "edit" && !this.isEditable) return;
    try {
      const uuid = target.closest("[data-effect-uuid]")?.dataset.effectUuid;
      const row = effectRows(this.actor).find(row => row.uuid === uuid && row.managed && row.effect.parent === this.actor);
      if (!row) throw new Error("That saved ability no longer exists. Reopen the sheet.");
      if (["use", "end"].includes(operation)) return await toggleEffect(this.actor, uuid, { active: operation === "use" });
      if (operation === "edit") return await openEffect(row.effect);
      if (
        operation === "delete" &&
        row.canRemove &&
        (await foundry.applications.api.DialogV2.confirm({
          window: { title: "Remove saved ability" },
          content: "<p>Remove this saved ability or form and its bonuses?</p>",
          rejectClose: false
        }))
      )
        return await row.effect.delete();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onStatus(event, target) {
    const operation = target.dataset.operation;
    if (operation !== "edit" && !this.isEditable) return;
    try {
      const uuid = target.closest("[data-effect-uuid]")?.dataset.effectUuid;
      const row = effectContext(this.actor).statuses.find(row => row.uuid === uuid);
      if (!row) return; // A concurrent End already removed the live entry.
      const item = row.itemId ? this.actor.items.get(row.itemId) : null;
      if (operation === "edit")
        return await (item
          ? item.sheet.render({ force: true })
          : openEffect(effectRows(this.actor).find(effect => effect.uuid === uuid).effect));
      if (operation === "condition" && row.endAction)
        return await (["prone", "grappled"].includes(row.endAction.id)
          ? promptMobilityAction(this.actor, row.endAction.id, uuid)
          : endConditionAction(this.actor, row.endAction.id));
      // A status condition ends by removing it, like clicking it off in the token HUD.
      if (operation === "end" && row.condition) return await removeCondition(this.actor, row.condition);
      if (operation === "end" && row.canEnd)
        return await (row.abilityId
          ? useAbility(this.actor, row.abilityId, { end: true })
          : toggleEffect(this.actor, uuid, { active: false }));
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onPickPortrait(event, target) {
    if (!this.isEditable) return;
    if (this._portraitPicker?.rendered) return this._portraitPicker.bringToFront();
    const picker = (this._portraitPicker = imagePicker({
      type: "image",
      current: this.actor.img,
      callback: path => setCharacterPortrait(this.actor, path).catch(error => ui.notifications.error(error.message))
    }));
    return picker.browse();
  }

  static async #onBlock() {
    if (!this.isEditable) return;
    try {
      return await promptBlock(this.actor);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onDodge() {
    if (!this.isEditable) return;
    try {
      return await promptDodge(this.actor);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onParry() {
    if (!this.isEditable) return;
    try {
      return await promptParry(this.actor);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerEffectSupport();
  registerEquipmentItem();
  registerTokenAttacks();
  registerStrikes();
  registerHealing();
  registerConditions();
  registerExhaustion();
  registerDeath();
  registerConditionRolls();
  registerConditionActions();
  registerConditionMovement();
  registerPetrified();
  registerUnconscious();
  registerVfx();
  registerMovementRuler();
  registerMovement();
  registerOpportunityAttacks();
  registerPositioning();
  registerTokenConfig();
  registerCombatPortraits();
  CONFIG.Actor.documentClass = CharacterActor;
  CONFIG.Combatant.documentClass = CharacterCombatant;
  CONFIG.Actor.dataModels.character = CharacterData;
  Object.assign(CONFIG.Item.dataModels, EQUIPMENT_MODELS);
  CONFIG.Item.dataModels.ability = AbilityData;
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, AbilitySheet, {
    types: ["ability"],
    makeDefault: true,
    label: "Worlds Beyond Ability"
  });
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, EquipmentSheet, {
    types: Object.keys(ITEM_TYPES),
    makeDefault: true,
    label: "Worlds Beyond Equipment"
  });
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["health", "ap", "reactions", "mana", "holyPower"], value: ["core.evasion", "core.armorRating", "core.movement"] }
  };

  registerCatalogSetting();
  registerSchemaVersion();
  registerSheetLog();
  registerDarknessFade();
  registerCatalogMenu();
  game.worldsBeyond = { importCatalog, openSheetLog };

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

Hooks.once("ready", offerCatalogImport);
Hooks.once("ready", () => runMigrations().catch(error => ui.notifications.error(`Worlds Beyond migration: ${error.message}`)));
registerFormTriggers();
registerAbilityTimers();
registerFormLoadouts();
registerRecovery();
registerMilestoneActions();
Hooks.on("renderItemDirectory", decorateEquipmentDirectory);
Hooks.on("renderCompendium", decorateEquipmentDirectory);
Hooks.on("renderChatMessageHTML", decorateSystemMessage);
Hooks.on("renderChatMessageHTML", decorateRollMessage);
Hooks.on("renderChatMessageHTML", decorateConsumableMessage);
Hooks.on("renderChatMessageHTML", decorateAttackMessage);
Hooks.on("renderChatMessageHTML", decorateAttackDefenses);
Hooks.on("renderChatMessageHTML", decorateReactionMessage);
Hooks.on("renderChatMessageHTML", decorateCommand);
Hooks.on("createChatMessage", message => {
  if (game.user.isActiveGM && message.getFlag(SYSTEM_ID, "command"))
    receiveCommand(message).catch(error => ui.notifications.warn(`Command is waiting in chat: ${error.message}`));
});
Hooks.on("updateActor", refreshWonderControls);
Hooks.on("updateActor", refreshCommandControls);
Hooks.on("createChatMessage", refreshWonderControls);

Hooks.on("combatTurnChange", refillTurnResources);
