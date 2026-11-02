import { STATS, MILESTONE_SCORES, statModifier, milestonesReached, formatModifier } from "./stats.mjs";
import { coreNumbers, numberOr, healthFromDamage, damageFromHealth } from "./core-numbers.mjs";
import { CharacterActor } from "./character-actor.mjs";
import { CharacterCombatant } from "./character-combatant.mjs";
import { refillTurnResources } from "./character-combat.mjs";
import { wonderPool } from "./rolls.mjs";
import { MAGIC_RESOURCES, RESOURCE_SCALING, RESOURCE_DISPLAYS, customResourceId, magicPool, customPool, resourceEntries } from "./resources.mjs";
import { addResource, resourceAction, resourceFormUpdates } from "./resource-actions.mjs";
import { queuedAction } from "./action-support.mjs";
import { wornEquipment, inventory, blockDice } from "./equipment-core.mjs";
import { bindStatInput, editedStatInputs } from "./stat-input.mjs";
import { wholeDisplay, wholeNumber, wholeFormUpdates, bindWholeNumbers } from "./number-display.mjs";
import { AbilityData, AbilitySheet, createAbility, useAbility } from "./abilities.mjs";
import { promptCommand, receiveCommand, decorateCommand } from "./command.mjs";
import { apTotal } from "./ap.mjs";
import { commandReady } from "./combat-support.mjs";
import { abilityGroups } from "./abilities-core.mjs";
import { effectContext, effectRows } from "./effects-core.mjs";
import { toggleEffect, openEffect, registerEffectSupport } from "./effects.mjs";
import { returnToBase } from "./forms.mjs";
import { registerFormTriggers } from "./form-triggers.mjs";
import { registerAbilityTimers } from "./ability-timers.mjs";
import { milestoneGroups } from "./milestones.mjs";
import { openMilestones } from "./milestone-sheet.mjs";
import { STAT_AWARD_LEVELS, statAwards, statIncreases } from "./stat-advancement.mjs";
import { openStatSetup } from "./stat-setup.mjs";
import { EQUIPMENT_MODELS, EquipmentSheet, ITEM_TYPES, equipmentRows, groupEquipmentRows, createEquipment, toggleEquipment, useConsumable, decorateConsumableMessage } from "./equipment.mjs";
import { decorateSystemMessage } from "./chat-style.mjs";
import { decorateEquipmentDirectory } from "./item-artwork.mjs";
import { registerCatalogSetting, registerCatalogMenu, offerCatalogImport, importCatalog } from "./catalog-import.mjs";
import { promptAttack, reloadWeapon, decorateAttackMessage } from "./attack-actions.mjs";
import { decorateAttackDefenses } from "./attack-defense.mjs";
import { registerEquipmentItem } from "./equipment-item.mjs";
import { registerTokenAttacks } from "./token-attacks.mjs";
import { promptBlock, promptDodge, promptParry, decorateReactionMessage } from "./reaction-actions.mjs";
import { promptStatCheck, longRest, decorateRollMessage, refreshWonderControls } from "./roll-actions.mjs";

const SYSTEM_ID = "worlds-beyond";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { NumberField, SchemaField, StringField, BooleanField, TypedObjectField } = foundry.data.fields;
const CHARACTER_DETAILS = [
  { key: "class", label: "Class", placeholder: "Class or path" },
  { key: "race", label: "Race", placeholder: "Race or ancestry" },
  { key: "background", label: "Background", rows: 3, placeholder: "Origins, occupation or upbringing" },
  { key: "appearance", label: "Appearance", rows: 3, placeholder: "Features, clothing and distinguishing details" },
  { key: "backstory", label: "Backstory", rows: 6, wide: true, placeholder: "Where you came from, what changed and what you want" },
  { key: "notes", label: "Notes", rows: 6, wide: true, placeholder: "Session notes, connections, languages and reminders" }
];

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
      // Stores the component before earned points. A manual correction below
      // the award total can make this component negative; the displayed base
      // still includes the earned points, exactly as on the website.
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 12 }),
      manual: new BooleanField({ initial: false }),
      resetValue: override()
    });
    const resource = () => ({
      spent: number(), bonus: number(), amount: number(1, { min: 0 }),
      allowOverflow: new BooleanField({ initial: false }),
      maxOverride: number(null, { nullable: true, min: 0 }), minOverride: override(),
      display: new StringField({ required: true, nullable: false, blank: false, initial: "number", choices: RESOURCE_DISPLAYS }),
      value: number(0, { persisted: false }), max: number(0, { persisted: false }), min: number(0, { persisted: false })
    });
    const magicResource = () => new SchemaField({
      ...resource(), enabled: new BooleanField({ initial: false })
    });
    return {
      level: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
      details: new SchemaField(Object.fromEntries(CHARACTER_DETAILS.map(({ key }) => [key,
        new StringField({ required: true, nullable: false, blank: true, trim: false, initial: "" })
      ]))),
      stats: new SchemaField(Object.fromEntries(STATS.map(s => [s.key, stat()]))),
      advancement: new SchemaField(Object.fromEntries(STAT_AWARD_LEVELS.map(level => [
        `level${level}`, new SchemaField(Object.fromEntries(STATS.map(s => [s.key, number(0, { integer: true, min: 0, max: 2 })])))
      ]))),
      health: new SchemaField({
        damage: number(),
        allowOverflow: new BooleanField({ initial: false }),
        maxOverride: override(),
        value: number(0, { persisted: false }),
        max: number(0, { persisted: false })
      }),
      ap: pool(),
      command: new SchemaField({ value: number(), fresh: new BooleanField({ initial: false }) }),
      reactions: pool(),
      wonder: pool(),
      mana: magicResource(),
      holyPower: magicResource(),
      customResources: new TypedObjectField(new SchemaField({
        ...resource(), name: new StringField({ required: true, nullable: false, blank: true, initial: "Resource" }),
        scaleStat: new StringField({ required: true, nullable: false, blank: true, initial: "", choices: RESOURCE_SCALING }),
        baseMax: number(100, { min: 0 }), regen: number(0, { min: 0 }),
        refillOnRest: new BooleanField({ initial: true })
      }), { validateKey: customResourceId }),
      bonuses: new SchemaField({ armor: number(), evasion: number(), movement: number() }),
      inventory: new SchemaField({ backpack: new BooleanField({ initial: false }) }),
      overrides: new SchemaField({
        hitDie: new StringField({ required: true, nullable: false, initial: "", blank: true }),
        evasion: override(),
        armorRating: override(),
        movement: override(),
        armorAgilityPenalty: override(),
        inventorySlots: override()
      })
    };
  }

  prepareBaseData() {
    // Permanent increases join the base before Foundry applies Active Effects.
    // Only the allocation is persisted, never the augmented value.
    const source = this.toObject();
    const increases = statIncreases(source.level, source.advancement);
    for (const { key } of STATS) this.stats[key].value = source.stats[key].value + increases[key];
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
      bonuses: { armor: this.equipment.armor + this.bonuses.armor, evasion: this.equipment.evasion + this.bonuses.evasion, movement: this.bonuses.movement },
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
    for (const [key, def] of Object.entries(MAGIC_RESOURCES)) {
      if (this[key]) Object.assign(this[key], magicPool(this.level, this.stats[def.stat].effective, this[key]));
    }
    for (const resource of Object.values(this.customResources ?? {})) Object.assign(resource, customPool(resource, this));
    const items = this.parent?.items ?? [];
    this.carrying = inventory({
      items, strengthMod: this.stats.str.mod,
      backpack: this.inventory.backpack, capacityOverride: this.overrides.inventorySlots
    });
    this.block = blockDice({ level: this.level, items });
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
    classes: [SYSTEM_ID, "wb-sheet", "wb-character-sheet"],
    position: { width: 720, height: 780 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollStat: CharacterSheet.#onRollStat,
      statSetup: CharacterSheet.#onStatSetup,
      milestones: CharacterSheet.#onMilestones,
      longRest: CharacterSheet.#onLongRest,
      block: CharacterSheet.#onBlock,
      dodge: CharacterSheet.#onDodge,
      parry: CharacterSheet.#onParry,
      equipment: CharacterSheet.#onEquipment,
      pickPortrait: CharacterSheet.#onPickPortrait,
      resource: CharacterSheet.#onResource,
      ability: CharacterSheet.#onAbility,
      command: async function () { if (!this.isEditable) return; try { await promptCommand(this.actor); } catch (error) { ui.notifications.error(error.message); } },
      savedAbility: CharacterSheet.#onSavedAbility,
      status: CharacterSheet.#onStatus
    }
  };

  static PARTS = {
    sheet: { template: `systems/${SYSTEM_ID}/templates/character-sheet.hbs`, scrollable: [
      '.wb-sheet-panel[data-tab="character"]', '.wb-sheet-panel[data-tab="equipment"]',
      '.wb-sheet-panel[data-tab="abilities"]', '.wb-sheet-panel[data-tab="status"]', '.wb-sheet-panel[data-tab="notes"]'
    ] }
  };
  static TABS = {
    sheet: { initial: "character", tabs: [
      { id: "character", label: "Character" }, { id: "equipment", label: "Equipment" },
      { id: "abilities", label: "Abilities" }, { id: "status", label: "Status" }, { id: "notes", label: "Notes" }
    ] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const source = system.toObject();
    const effects = effectContext(this.actor);
    const abilities = abilityGroups(this.actor.items ?? [], system);
    for (const row of effects.savedAbilities) {
      let group = abilities.find(group => group.rows[0]?.kind === row.kind);
      if (!group) { group = { label: row.form ? "Forms" : "Active", rows: [] }; abilities.push(group); }
      group.rows.push(row);
    }
    const milestones = Object.fromEntries(milestoneGroups(system).map(group => [group.key, group.rows]));
    const statSources = key => [effects.sources[`system.stats.${key}.value`], key === "agl" && system.equipment?.agilityPenalty ? `Armor: −${wholeNumber(system.equipment.agilityPenalty)}` : ""].filter(Boolean).join(" · ");
    const increases = statIncreases(system.level, source.advancement);
    const rows = STATS.map(def => {
      const stat = system.stats[def.key];
      const stored = source.stats[def.key];
      const increase = increases[def.key];
      const baseValue = stored.value + increase;
      const value = stat.effective ?? stat.value;
      return {
        ...def,
        value, baseValue,
        sources: statSources(def.key),
        defaultValue: (stored.resetValue ?? (stored.manual ? 12 : stored.value)) + increase,
        adjusted: value !== baseValue,
        manual: !!source.stats[def.key].manual,
        modLabel: formatModifier(stat.mod),
        negative: stat.mod < 0,
        pips: def.milestones.map((name, i) => ({
          name,
          score: MILESTONE_SCORES[i],
          lit: milestones[def.key][i].unlocked,
          status: milestones[def.key][i].status,
          summary: milestones[def.key][i].summary
        }))
      };
    });
    const equipment = equipmentRows(this.actor.items ?? [], system.carrying?.perItem);
    return Object.assign(context, {
      actor: this.actor,
      commandPool: wholeDisplay(system.command ?? { value: 0, fresh: false }),
      characterDetails: CHARACTER_DETAILS.map(field => ({ ...field, value: source.details?.[field.key] ?? "" })),
      characterDetailsSummary: [source.details?.class, source.details?.race].filter(value => value?.trim()).join(" · "),
      system: wholeDisplay({ ...system, bonuses: source.bonuses ?? system.bonuses }),
      resourcePools: resourceEntries(system).map(pool => ({ ...pool, sources: [effects.sources[`${pool.path}.bonus`], statSources(pool.custom ? system.customResources[pool.key].scaleStat : MAGIC_RESOURCES[pool.key].stat)].filter(Boolean).join(" · ") })),
      activeStatuses: effects.statuses, hasForms: effects.hasForms, hasActiveForm: effects.hasActiveForm,
      abilityGroups: abilities,
      manaEnabled: !!system.mana?.enabled, holyPowerEnabled: !!system.holyPower?.enabled,
      editable: this.isEditable,
      unspentStatPoints: statAwards(system.level, source.advancement).reduce((sum, award) => sum + award.remaining, 0),
      hasAdjustments: ["health", "ap", "reactions", "wonder"].some(key => system[key]?.maxOverride != null)
        || Object.values(system.overrides ?? {}).some(value => value != null && value !== "")
        || Object.values(source.bonuses ?? system.bonuses ?? {}).some(value => !!value),
      resources: wholeDisplay([
        { key: "health", label: "Health", inputName: "healthCurrent", ...system.health, sources: statSources("vit") },
        { key: "ap", label: "Action Points", inputName: "system.ap.value", ...system.ap, value: apTotal(system), command: wholeNumber(system.command?.value ?? 0),
          commandPending: system.command?.value > 0 ? !commandReady(this.actor) : false },
        { key: "reactions", label: "Reactions", inputName: "system.reactions.value", ...system.reactions, sources: statSources("agl") },
        { key: "wonder", label: "Wonder", inputName: "system.wonder.value", ...system.wonder, sources: statSources("fth") }
      ]),
      defyFate: system.stats.fth.value >= 21,
      worn: wholeDisplay(system.equipment),
      equipment: wholeDisplay(equipment), equipmentGroups: wholeDisplay(groupEquipmentRows(equipment)),
      carrying: wholeDisplay(system.carrying),
      block: system.block && { ...system.block, strMod: formatModifier(system.stats.str?.mod ?? 0) },
      dodgeMod: formatModifier(system.stats.agl?.mod ?? 0),
      parryMod: formatModifier(system.stats.dex?.mod ?? 0),
      coreDetails: [
        { key: "hitDie", label: "Hit die", value: system.core.hitDie, type: "text" },
        { key: "evasion", label: "Natural Evasion", value: system.core.evasion, type: "number" },
        { key: "armorRating", label: "Armor Rating", value: system.core.armorRating, type: "number" },
        { key: "movement", label: "Movement / AP", value: system.core.movement, unit: "ft", type: "number" }
      ].map(detail => wholeDisplay({ ...detail, override: system.overrides[detail.key], automatic: system.core.automatic[detail.key],
        sources: [effects.sources[`system.bonuses.${({ armorRating: "armor", evasion: "evasion", movement: "movement" })[detail.key]}`], statSources(["evasion", "movement"].includes(detail.key) ? "agl" : "vit")].filter(Boolean).join(" · ") })),
      groups: wholeDisplay([
        { title: "Physical", rows: rows.filter(r => r.group === "physical") },
        { title: "Mental", rows: rows.filter(r => r.group === "mental") }
      ])
    });
  }

  _processFormData(event, form, formData) {
    const systemSource = this.actor.system.toObject?.();
    const shownAp = apTotal(this.actor.system);
    const data = wholeFormUpdates(super._processFormData(event, form, formData), form, { system: { ...this.actor.system, ap: { ...this.actor.system.ap, value: shownAp }, bonuses: systemSource?.bonuses ?? this.actor.system.bonuses } });
    // The main AP field includes Command. Manual total corrections change own AP,
    // while the separate Command correction remains explicit and unchanged.
    if (data.system?.ap && Object.hasOwn(data.system.ap, "value")) {
      const entered = numberOr(data.system.ap.value, null);
      if (entered === wholeNumber(shownAp)) delete data.system.ap.value;
      else {
        const grant = data.system.command && Object.hasOwn(data.system.command, "value") ? numberOr(data.system.command.value, 0) : numberOr(this.actor.system.command?.value, 0);
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

  async _onRender(context, options) {
    await super._onRender(context, options);
    // Native read-only actor sheets disable form buttons; rule references are
    // still viewable and never submit a document update.
    for (const button of this.element.querySelectorAll('[data-action="milestones"], .wb-sheet-tabs [data-action="tab"]')) button.disabled = false;
    if (this.isEditable) bindWholeNumbers(this.element);
    if (this.isEditable) for (const input of this.element.querySelectorAll("[data-stat-score]")) bindStatInput(input);
  }

  async _processSubmitData(event, form, submitData, options = {}) {
    return queuedAction(this.actor.uuid, () => super._processSubmitData(event, form, submitData, options));
  }

  static async #onRollStat(event, target) {
    try { return await promptStatCheck(this.actor, target.dataset.stat); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onStatSetup(event, target) {
    if (!this.isEditable) return;
    try { return await openStatSetup(this.actor, target.dataset.mode); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onMilestones(event, target) {
    try { return await openMilestones(this.actor, target.dataset.stat, target.dataset.threshold); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onLongRest() {
    if (!this.isEditable) return;
    try { return await longRest(this.actor); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onResource(event, target) {
    if (!this.isEditable) return;
    try {
      if (target.dataset.operation === "add") return await addResource(this.actor);
      const card = target.closest("[data-resource-key]");
      const key = card?.dataset.resourceKey;
      const operation = target.dataset.operation;
      if (operation === "remove" && !await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remove resource" }, content: "<p>Remove this custom resource and its balance?</p>", rejectClose: false
      })) return;
      return await resourceAction(this.actor, key, operation, card?.querySelector("[data-resource-amount]")?.value);
    } catch (error) { ui.notifications.error(error.message); }
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
      if (operation === "delete" && item && await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remove equipment" }, content: "<p>Remove this item from this character?</p>", rejectClose: false
      })) return await item.delete();
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async #onAbility(event, target) {
    const operation = target.dataset.operation;
    if (operation !== "edit" && !this.isEditable) return;
    try {
      if (operation === "create") return await createAbility(this.actor, target.dataset.kind ?? "active");
      if (operation === "base") return await returnToBase(this.actor);
      const item = this.actor.items.get(target.closest("[data-ability-id]")?.dataset.abilityId);
      if (item?.type !== "ability") throw new Error("That ability no longer exists. Reopen the sheet.");
      if (operation === "edit") return item.sheet.render({ force: true });
      if (["use", "end"].includes(operation)) return await useAbility(this.actor, item.id, { end: operation === "end" });
      if (operation === "delete" && await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remove ability" }, content: "<p>Remove this ability and its trackers from this character?</p>", rejectClose: false
      })) return await item.delete();
    } catch (error) { ui.notifications.error(error.message); }
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
      if (operation === "delete" && row.canRemove && await foundry.applications.api.DialogV2.confirm({
        window: { title: "Remove saved ability" }, content: "<p>Remove this saved ability or form and its bonuses?</p>", rejectClose: false
      })) return await row.effect.delete();
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async #onStatus(event, target) {
    const operation = target.dataset.operation;
    if (operation !== "edit" && !this.isEditable) return;
    try {
      const uuid = target.closest("[data-effect-uuid]")?.dataset.effectUuid;
      const row = effectContext(this.actor).statuses.find(row => row.uuid === uuid);
      if (!row) return; // A concurrent End already removed the live entry.
      const item = row.itemId ? this.actor.items.get(row.itemId) : null;
      if (operation === "edit") return await (item ? item.sheet.render({ force: true }) : openEffect(effectRows(this.actor).find(effect => effect.uuid === uuid).effect));
      if (operation === "end" && row.canEnd) return await (row.abilityId ? useAbility(this.actor, row.abilityId, { end: true }) : toggleEffect(this.actor, uuid, { active: false }));
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

  static async #onBlock() {
    if (!this.isEditable) return;
    try { return await promptBlock(this.actor); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onDodge() {
    if (!this.isEditable) return;
    try { return await promptDodge(this.actor); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #onParry() {
    if (!this.isEditable) return;
    try { return await promptParry(this.actor); }
    catch (error) { ui.notifications.error(error.message); }
  }
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerEffectSupport();
  registerEquipmentItem();
  registerTokenAttacks();
  CONFIG.Actor.documentClass = CharacterActor;
  CONFIG.Combatant.documentClass = CharacterCombatant;
  CONFIG.Actor.dataModels.character = CharacterData;
  Object.assign(CONFIG.Item.dataModels, EQUIPMENT_MODELS);
  CONFIG.Item.dataModels.ability = AbilityData;
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, AbilitySheet, {
    types: ["ability"], makeDefault: true, label: "Worlds Beyond Ability"
  });
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, EquipmentSheet, {
    types: Object.keys(ITEM_TYPES), makeDefault: true, label: "Worlds Beyond Equipment"
  });
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["health", "ap", "reactions", "mana", "holyPower"], value: ["core.evasion", "core.armorRating", "core.movement"] }
  };

  registerCatalogSetting();
  registerCatalogMenu();
  game.worldsBeyond = { importCatalog };

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
registerFormTriggers();
registerAbilityTimers();
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
  if (game.user.isActiveGM && message.getFlag(SYSTEM_ID, "command")) receiveCommand(message).catch(error => ui.notifications.warn(`Command is waiting in chat: ${error.message}`));
});
Hooks.on("updateActor", refreshWonderControls);
Hooks.on("createChatMessage", refreshWonderControls);

Hooks.on("combatTurnChange", refillTurnResources);
