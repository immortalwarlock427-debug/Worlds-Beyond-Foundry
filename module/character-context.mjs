// Read-only sheet presenters. Inputs may be native documents or plain test data;
// this module needs no Foundry globals and never saves or prepares a document.
import { STATS, MILESTONE_SCORES, formatModifier } from "./stats.mjs";
import { MAGIC_RESOURCES, resourceEntries } from "./resources.mjs";
import { wholeDisplay, wholeNumber } from "./number-display.mjs";
import { apTotal } from "./ap.mjs";
import { exhaustionEffects } from "./exhaustion-core.mjs";
import { abilityGroups } from "./abilities-core.mjs";
import { effectContext, itemBonusSummary } from "./effects-core.mjs";
import { activeLoadoutForm, formShowsAbility, formShowsResource } from "./form-loadout-core.mjs";
import { favoriteSlots, overviewFill, archiveAppearance } from "./overview.mjs";
import { barColorContext } from "./bar-colors.mjs";
import { milestoneGroups } from "./milestones.mjs";
import { statAwards, statIncreases } from "./stat-advancement.mjs";
import { currencyTotal, GOLD_PER_PLATINUM } from "./currency.mjs";
import { hitDicePool } from "./rest-core.mjs";
import { normalizeResistances } from "./resistances.mjs";
import { DOLL_SLOTS, HAND_SLOTS, handAssignment, slotItems } from "./paper-doll.mjs";
import { itemIcon } from "./item-icons.mjs";

export const CHARACTER_DETAILS = [
  { key: "class", label: "Class", placeholder: "Class or path" },
  { key: "race", label: "Race", placeholder: "Race or ancestry" },
  { key: "background", label: "Background", rows: 3, placeholder: "Origins, occupation or upbringing" },
  { key: "appearance", label: "Appearance", rows: 3, placeholder: "Features, clothing and distinguishing details" },
  { key: "backstory", label: "Backstory", rows: 6, wide: true, placeholder: "Where you came from, what changed and what you want" },
  { key: "notes", label: "Notes", rows: 6, wide: true, placeholder: "Session notes, connections, languages and reminders" }
];

function attributeRows({ system, source, statSources }) {
  const milestones = Object.fromEntries(milestoneGroups(system).map(group => [group.key, group.rows]));
  const increases = statIncreases(system.level, source.advancement);
  return STATS.map(def => {
    const stat = system.stats[def.key],
      stored = source.stats[def.key],
      increase = increases[def.key];
    const baseValue = stored.value + increase,
      value = stat.effective ?? stat.value;
    return {
      ...def,
      value,
      baseValue,
      sources: statSources(def.key),
      defaultValue: (stored.resetValue ?? (stored.manual ? 12 : stored.value)) + increase,
      adjusted: value !== baseValue,
      manual: !!stored.manual,
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
}

export function headerContext({ source, effects, activeForm, appearance, editable }) {
  return {
    overviewClass: source.details?.class?.trim() || "",
    overviewRace: source.details?.race?.trim() || "",
    baseFormName: appearance.baseFormName,
    canRenameBaseForm: editable && !effects.hasActiveForm,
    overviewForm: activeForm?.name || effects.savedAbilities.find(row => row.form && row.effectsActive)?.name || appearance.baseFormName
  };
}

function coreBreakdowns({ system, effects, statSources }) {
  const { stats, equipment, bonuses, overrides, core } = system;
  const pieces = list => (list ?? []).map(({ name, amount }) => `${name} ${formatModifier(amount)}`);
  const tooltip = (key, lines) =>
    [...lines.filter(Boolean), overrides?.[key] != null ? `Manual override: ${core[key]}` : ""].filter(Boolean).join(" · ");
  const adjustment = (key, value) => effects.sources[`system.bonuses.${key}`] || (value ? `Adjustment ${formatModifier(value)}` : "");
  const vit = stats.vit.effective ?? stats.vit.value;
  return {
    evasion: tooltip("evasion", [
      "Base 12",
      `AGL ${formatModifier(stats.agl.mod)}`,
      statSources("agl"),
      ...pieces(equipment?.evasionSources),
      adjustment("evasion", bonuses?.evasion),
      ...pieces(equipment?.suppressedEvasion).map(source => `${source} suppressed by ${equipment.type} armor`)
    ]),
    armorRating: tooltip("armorRating", [
      vit >= 28 ? `Adamantine Body +${Math.floor(vit / 2)}` : `VIT ${formatModifier(stats.vit.mod)}`,
      statSources("vit"),
      ...pieces(equipment?.armorSources),
      adjustment("armor", bonuses?.armor)
    ]),
    movement: tooltip("movement", [
      "Base 5 ft",
      `AGL ${formatModifier(5 * stats.agl.mod)} ft (minimum 5 ft before bonuses)`,
      statSources("agl"),
      adjustment("movement", bonuses?.movement)
    ]),
    initiative: ["1d20", `WIS ${formatModifier(stats.wis.mod)}`, statSources("wis")].filter(Boolean).join(" · ")
  };
}

function resourceSources(pool, { system, effects, statSources }) {
  if (pool.normalMax != null) return `${pool.formName} form maximum: ${pool.max} · Outside forms: ${pool.normalMax}`;
  const stat = pool.custom ? system.customResources[pool.key].scaleStat : MAGIC_RESOURCES[pool.key].stat;
  return [
    pool.maxOverride != null
      ? `Base maximum override: ${pool.maxOverride}`
      : stat
        ? `${stat.toUpperCase()} × (level + 2)`
        : "Manual base maximum",
    effects.sources[`${pool.path}.bonus`] || (pool.bonus ? `Maximum bonus ${formatModifier(pool.bonus)}` : ""),
    pool.maxOverride == null && statSources(stat)
  ]
    .filter(Boolean)
    .join(" · ");
}

export function characterContext({ actor, system, effects, activeForm, appearance, rows, pools, statSources }) {
  const health = system.health;
  return {
    overviewStats: wholeDisplay(rows),
    favoriteSlots: favoriteSlots(actor, effects.savedAbilities),
    overviewPortraitY: appearance.portraitY,
    overviewHealth: {
      ...barColorContext(health, "health"),
      value: wholeNumber(health.value),
      max: wholeNumber(health.max),
      meter: overviewFill(health),
      overflow: health.value > health.max,
      sources: [
        health.maxOverride != null ? `Maximum override: ${health.maxOverride}` : "VIT × level",
        health.maxOverride == null &&
        system.core?.automatic?.healthMax < (system.stats.vit.effective ?? system.stats.vit.value) * system.level
          ? "Exhaustion: half maximum (rounded down)"
          : "",
        statSources("vit")
      ]
        .filter(Boolean)
        .join(" · "),
      low: health.max > 0 && health.value / health.max <= 0.25
    },
    overviewEconomy: [
      {
        label: "Action Points",
        value: apTotal(system),
        max: system.ap.max,
        barColors: system.ap.barColors,
        field: "system.ap.value",
        icon: "bolt",
        sources:
          system.ap.maxOverride != null
            ? `Maximum override: ${system.ap.maxOverride}`
            : `15 AP + 2 per 5 levels${system.core?.apMax < 15 + 2 * Math.floor(system.level / 5) ? ` · Exhaustion −${exhaustionEffects(system.exhaustion).apReduction}` : ""}`,
        command: system.command?.value ?? 0
      },
      {
        label: "Reactions",
        value: system.reactions.value,
        max: system.reactions.max,
        barColors: system.reactions.barColors,
        field: "system.reactions.value",
        icon: "shield-halved",
        sources: [
          system.reactions.maxOverride != null ? `Maximum override: ${system.reactions.maxOverride}` : "1 reaction + AGL milestones",
          statSources("agl")
        ]
          .filter(Boolean)
          .join(" · ")
      },
      {
        label: "Wonder",
        value: system.wonder.value,
        max: system.wonder.max,
        barColors: system.wonder.barColors,
        field: "system.wonder.value",
        icon: "sparkles",
        sources: [
          system.wonder.maxOverride != null ? `Maximum override: ${system.wonder.maxOverride}` : "Nonnegative FTH modifier",
          statSources("fth")
        ]
          .filter(Boolean)
          .join(" · ")
      }
    ].map(pool => ({
      ...wholeDisplay(pool),
      ...barColorContext(pool, pool.field.split(".")[1]),
      meter: overviewFill(pool),
      segments: Number.isInteger(pool.max) && pool.max > 0 && pool.max <= 24 ? pool.max : 1,
      overflow: pool.value > pool.max
    })),
    overviewPools: pools
      .filter(pool => formShowsResource(activeForm, pool.key))
      .map(pool => ({
        ...pool,
        ...barColorContext(pool),
        overflow: pool.value > pool.max,
        sources: resourceSources(pool, { system, effects, statSources })
      })),
    overviewBreakdowns: coreBreakdowns({ system, effects, statSources }),
    overviewInitiative: formatModifier(system.stats.wis.mod),
    overviewStatus: effects.statuses
      .slice(0, 3)
      .map(row => row.name)
      .join(" · "),
    overviewStatusCount: effects.statuses.length
  };
}

export function detailsContext(state) {
  const { system, source, effects, activeForm, rows, pools, statSources, showAllFormResources, commandPending } = state;
  return {
    hasHiddenFormResources: pools.some(pool => !formShowsResource(activeForm, pool.key)),
    showAllFormResources: !!showAllFormResources,
    commandPool: wholeDisplay(system.command ?? { value: 0, fresh: false }),
    resourcePools: pools
      .filter(pool => showAllFormResources || formShowsResource(activeForm, pool.key))
      .map(pool => ({
        ...pool,
        activeFormName: activeForm?.name ?? "",
        formMaximum: activeForm?.system.loadout?.resourceMaxima?.[pool.key] ?? null,
        storedBonus: (pool.custom ? source.customResources?.[pool.key]?.bonus : source[pool.key]?.bonus) ?? 0,
        ...barColorContext(pool),
        sources: resourceSources(pool, { system, effects, statSources })
      })),
    manaEnabled: !!system.mana?.enabled,
    holyPowerEnabled: !!system.holyPower?.enabled,
    unspentStatPoints: statAwards(system.level, source.advancement).reduce((sum, award) => sum + award.remaining, 0),
    hasAdjustments:
      ["health", "ap", "reactions", "wonder"].some(key => system[key]?.maxOverride != null) ||
      Object.values(system.overrides ?? {}).some(value => value != null && value !== "") ||
      Object.values(source.bonuses ?? system.bonuses ?? {}).some(value => !!value),
    resources: wholeDisplay([
      { key: "health", label: "Health", inputName: "healthCurrent", ...system.health, sources: statSources("vit") },
      {
        key: "ap",
        label: "Action Points",
        inputName: "system.ap.value",
        ...system.ap,
        value: apTotal(system),
        command: wholeNumber(system.command?.value ?? 0),
        commandPending
      },
      { key: "reactions", label: "Reactions", inputName: "system.reactions.value", ...system.reactions, sources: statSources("agl") },
      { key: "wonder", label: "Wonder", inputName: "system.wonder.value", ...system.wonder, sources: statSources("fth") }
    ]).map(pool => ({ ...pool, ...barColorContext(pool) })),
    defyFate: system.stats.fth.value >= 21,
    worn: wholeDisplay(system.equipment),
    block: system.block && { ...system.block, strMod: formatModifier(system.stats.str?.mod ?? 0) },
    dodgeMod: formatModifier(system.stats.agl?.mod ?? 0),
    parryMod: formatModifier(system.stats.dex?.mod ?? 0),
    coreDetails: [
      { key: "hitDie", label: "Hit die", value: system.core.hitDie, type: "text" },
      { key: "evasion", label: "Natural Evasion", value: system.core.evasion, type: "number" },
      { key: "armorRating", label: "Armor Rating", value: system.core.armorRating, type: "number" },
      { key: "movement", label: "Movement / AP", value: system.core.movement, unit: "ft", type: "number" }
    ].map(detail =>
      wholeDisplay({
        ...detail,
        override: system.overrides[detail.key],
        automatic: system.core.automatic[detail.key],
        sources: [
          effects.sources[`system.bonuses.${{ armorRating: "armor", evasion: "evasion", movement: "movement" }[detail.key]}`],
          statSources(["evasion", "movement"].includes(detail.key) ? "agl" : "vit")
        ]
          .filter(Boolean)
          .join(" · ")
      })
    ),
    groups: wholeDisplay([
      { title: "Physical", rows: rows.filter(row => row.group === "physical") },
      { title: "Mental", rows: rows.filter(row => row.group === "mental") }
    ])
  };
}

const ARMOR_WEIGHTS = { light: "Light", medium: "Medium", heavy: "Heavy" };
// One line under an item's name: what it adds while worn or held.
function wornDetail(item) {
  const system = item.system ?? {};
  if (item.type === "armor")
    return [`AR ${wholeNumber(system.armorRating ?? 0)}`, ARMOR_WEIGHTS[system.armorType]].filter(Boolean).join(" · ");
  if (item.type === "shield")
    return `Block ${system.blockDie || "1d6"}${system.armorRating ? ` · AR ${wholeNumber(system.armorRating)}` : ""}`;
  if (item.type === "weapon") return [system.damage, system.damageType].filter(Boolean).join(" ");
  return itemBonusSummary(item);
}
const slotView = (items, extra = {}) => {
  const [first] = items;
  return {
    ...extra,
    filled: items.length > 0,
    itemId: items.length === 1 ? first.id : "",
    name: items.length ? items.map(item => item.name).join(", ") : "Empty",
    img: first ? itemIcon(first) : "",
    detail: items.length > 1 ? `${items.length} worn` : first ? wornDetail(first) : ""
  };
};

// The website's paper doll: body slots around the figure, both hands and the armor total.
export function paperDollContext(items, system = {}, equipment = {}) {
  const list = Array.from(items?.values?.() ?? items ?? []);
  const slots = DOLL_SLOTS.map(slot =>
    slotView(slotItems(list, slot.key), { key: slot.key, label: slot.label, side: slot.side, row: slot.row })
  );
  const worn = Object.fromEntries(slots.map(slot => [slot.key, slot.filled]));
  const hands = handAssignment(list);
  const handSlots = Object.entries(HAND_SLOTS).map(([key, label]) => {
    const covered = key === "off" && hands.twoHanded;
    return slotView(hands[key] ? [hands[key]] : [], {
      key,
      label,
      covered,
      coverText: covered ? `Both hands: ${hands.main.name}` : "",
      canAttack: hands[key]?.type === "weapon"
    });
  });
  const armorType = ARMOR_WEIGHTS[equipment.type];
  // Armor Rating already includes worn armor and shields; the rest is VIT and gear or effect bonuses.
  const total = Number(system.core?.armorRating ?? 0) || 0;
  const other = total - (Number(equipment.armorAR) || 0) - (Number(equipment.shieldAR) || 0);
  const notes = [
    armorType ? `${armorType} armor` : "No armor worn",
    equipment.evasion ? `+${wholeNumber(equipment.evasion)} Natural Evasion` : "",
    equipment.agilityPenalty ? `AGL −${wholeNumber(equipment.agilityPenalty)}` : "",
    equipment.heavyDisadvantage ? "Below 21 STR: attacks, Agility saves and Dodge at disadvantage" : ""
  ].filter(Boolean);
  return {
    slots,
    worn,
    hands: handSlots,
    extraHeld: hands.extra.map(item => item.name).join(", "),
    armorRating: wholeNumber(total),
    armorParts: [
      equipment.armorAR ? `Armor ${wholeNumber(equipment.armorAR)}` : "",
      equipment.shieldAR ? `Shield ${wholeNumber(equipment.shieldAR)}` : "",
      other ? `VIT and bonuses ${other > 0 ? "+" : "−"}${wholeNumber(Math.abs(other))}` : ""
    ]
      .filter(Boolean)
      .join(" · "),
    armorNotes: notes
  };
}

export function equipmentContext({ actor, system, equipment, equipmentGroups }) {
  return {
    doll: paperDollContext(actor?.items, system, system.equipment),
    equipment: wholeDisplay(equipment),
    equipmentGroups: wholeDisplay(equipmentGroups),
    carrying: wholeDisplay(system.carrying),
    currency: {
      gc: system.currency?.gc ?? 0,
      pc: system.currency?.pc ?? 0,
      total: currencyTotal(system.currency),
      goldPerPlatinum: GOLD_PER_PLATINUM
    }
  };
}

export function abilitiesContext({ actor, system, effects, activeForm, showAllFormAbilities }) {
  const all = Array.from(actor.items?.values?.() ?? actor.items ?? []);
  const hidden = all.some(item => item.type === "ability" && !formShowsAbility(activeForm, item));
  const visible = showAllFormAbilities ? all : all.filter(item => item.type !== "ability" || formShowsAbility(activeForm, item));
  const groups = abilityGroups(visible, system);
  for (const row of effects.savedAbilities) {
    let group = groups.find(group => group.rows[0]?.kind === row.kind);
    if (!group) {
      group = { label: row.form ? "Forms" : "Active", rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return {
    currentFormName: activeForm?.name ?? "",
    hasHiddenFormAbilities: hidden,
    showAllFormAbilities: !!showAllFormAbilities,
    abilityGroups: groups
  };
}

export function statusContext({ effects }) {
  return { activeStatuses: effects.statuses, hasForms: effects.hasForms, hasActiveForm: effects.hasActiveForm };
}

export function notesContext({ source, isGM }) {
  return {
    canViewSheetLog: !!isGM,
    characterDetails: CHARACTER_DETAILS.map(field => ({ ...field, value: source.details?.[field.key] ?? "" })),
    characterDetailsSummary: [source.details?.class, source.details?.race].filter(value => value?.trim()).join(" · ")
  };
}

export function prepareCharacterSheetContext(input) {
  const { actor, source, editable } = input,
    system = actor.system;
  const effects = effectContext(actor),
    activeForm = activeLoadoutForm(actor);
  const statSources = key =>
    [
      effects.sources[`system.stats.${key}.value`],
      key === "agl" && system.equipment?.agilityPenalty ? `Armor: −${wholeNumber(system.equipment.agilityPenalty)}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  const state = {
    ...input,
    system,
    effects,
    activeForm,
    statSources,
    appearance: archiveAppearance(actor),
    pools: resourceEntries(system)
  };
  state.rows = attributeRows(state);
  return {
    actor,
    system: wholeDisplay({ ...system, bonuses: source.bonuses ?? system.bonuses }),
    hitDice: hitDicePool(system),
    resistances: normalizeResistances(system.resistances),
    immunities: normalizeResistances(system.immunities),
    editable,
    ...headerContext(state),
    ...characterContext(state),
    ...detailsContext(state),
    ...equipmentContext(state),
    ...abilitiesContext(state),
    ...statusContext(state),
    ...notesContext(state)
  };
}
