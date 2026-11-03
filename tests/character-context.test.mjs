import { test } from "node:test";
import assert from "node:assert/strict";
// Importing the presenters requires no Foundry runtime or app/document stubs.
import { prepareCharacterSheetContext } from "../module/character-context.mjs";
import { STATS, statModifier } from "../module/stats.mjs";
const resource = "resource00000001";
const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function fixture() {
  const source = {
    level: 8,
    advancement: { level4: { str: 2 } },
    stats: Object.fromEntries(STATS.map(stat => [stat.key, { value: 12, manual: false, resetValue: null }])),
    details: { class: "  Arcanist  ", race: "Human", notes: "First line\n120.4 <literal>" },
    bonuses: { armor: 0, evasion: 0, movement: 0 }
  };
  source.stats.str = { value: 19, manual: true, resetValue: 18 };
  const system = {
    ...structuredClone(source),
    favorites: [],
    appearance: { baseFormName: "Human Form", portraitY: 35 },
    health: { value: 88.75, max: 125.5, damage: 36.75 },
    ap: { value: 11.5, max: 17 },
    command: { value: 2.5, fresh: true },
    reactions: { value: 1, max: 1 },
    wonder: { value: 0, max: 0 },
    mana: { enabled: true, value: 108.75, max: 125.5, min: 0, spent: 16.75 },
    holyPower: { enabled: false },
    customResources: {
      [resource]: {
        name: "Blood",
        value: 105.5,
        max: 100,
        min: -20,
        spent: -5.5,
        scaleStat: "vit",
        display: "percent",
        barColors: { start: "#ABC", end: "#112233" }
      }
    },
    equipment: { agilityPenalty: 2, effectiveAgility: 10 },
    carrying: { max: 14, used: 2 },
    block: { formula: "2d4", nextLevel: 10 },
    core: {
      hitDie: "1d6",
      evasion: 11,
      armorRating: 0,
      movement: 5,
      automatic: { hitDie: "1d6", evasion: 11, armorRating: 0, movement: 5 }
    },
    overrides: { hitDie: "", evasion: null, armorRating: null, movement: null }
  };
  system.stats.str.value = 23;
  system.stats.agl.effective = 10;
  for (const stat of STATS)
    system.stats[stat.key].mod = statModifier(stat.key, system.stats[stat.key].effective ?? system.stats[stat.key].value);
  const actor = { system, items: new Map(), effects: [], type: "character", uuid: "Actor.context" };
  const input = { actor, source, editable: true, equipment: [], equipmentGroups: [], commandPending: false };
  const ability = (id, kind, active = false) => {
    const item = {
      id,
      uuid: `${actor.uuid}.Item.${id}`,
      name: id,
      type: "ability",
      effects: [],
      system: { kind, effectsActive: active, uses: {}, cooldown: {}, loadout: {} }
    };
    actor.items.set(id, item);
    return item;
  };
  return { actor, system, source, input, ability, render: extra => prepareCharacterSheetContext({ ...input, ...extra }) };
}

test("Equipment shows both coin balances and their combined gold value without changing them", () => {
  const f = fixture();
  f.system.currency = Object.freeze({ gc: 1500, pc: 2 });
  const view = f.render();
  assert.deepEqual(view.currency, { gc: 1500, pc: 2, total: 3500, goldPerPlatinum: 1000 });
  assert.deepEqual(f.system.currency, { gc: 1500, pc: 2 });
  assert.equal(view.resources.find(row => row.key === "ap").value, 14);
});

test("sheet presenters preserve earned bases, adjustments, reset scores and literal notes without writing frozen data", () => {
  const f = fixture(),
    before = structuredClone({ system: f.system, source: f.source });
  freeze(f.system);
  freeze(f.source);
  const view = f.render(),
    str = view.groups[0].rows.find(row => row.key === "str");
  assert.equal(str.baseValue, 21);
  assert.equal(str.value, 23);
  assert.equal(str.defaultValue, 20);
  assert.equal(str.manual, true);
  assert.equal(str.adjusted, true);
  assert.equal(str.pips[0].lit, true);
  assert.match(view.groups[0].rows.find(row => row.key === "agl").sources, /Armor: −2/);
  assert.equal(view.overviewClass, "Arcanist");
  assert.equal(view.characterDetails.find(row => row.key === "class").value, "  Arcanist  ");
  assert.equal(view.characterDetails.find(row => row.key === "notes").value, "First line\n120.4 <literal>");
  assert.deepEqual({ system: f.system, source: f.source }, before);
});

test("Command totals, fractional meter geometry, percentage overflow and colors stay consistent across tabs", () => {
  const f = fixture(),
    view = f.render({ commandPending: true });
  assert.equal(view.overviewEconomy[0].value, 14);
  assert.equal(view.resources.find(row => row.key === "ap").value, 14);
  assert.equal(view.resources.find(row => row.key === "ap").commandPending, true);
  assert.equal(view.overviewHealth.value, 88);
  assert.equal(view.overviewHealth.max, 125);
  assert.equal(view.overviewHealth.meter, (88.75 / 125.5) * 100);
  const blood = view.resourcePools.find(row => row.key === resource);
  assert.equal(view.overviewPools.find(row => row.key === resource).overflow, true);
  assert.equal(blood.inputValue, 104);
  assert.equal(blood.min, -20);
  assert.match(blood.barStyle, /#AABBCC/);
  assert.match(blood.barStyle, /#112233/);
  assert.equal(f.system.ap.value, 11.5);
  assert.equal(f.system.customResources[resource].value, 105.5);
});

test("form visibility changes list projections while active sources and explicit favorite shortcuts remain accessible", () => {
  const f = fixture(),
    form = f.ability("Monstrous", "form", true);
  f.ability("Hidden", "active");
  f.ability("Active buff", "active", true);
  form.system.loadout = { resources: { [resource]: false }, abilities: { Hidden: false, "Active buff": false } };
  f.system.favorites = ["Hidden"];
  const view = f.render();
  assert.equal(view.overviewForm, "Monstrous");
  assert.equal(view.hasActiveForm, true);
  assert.equal(view.hasHiddenFormAbilities, true);
  assert.equal(view.hasHiddenFormResources, true);
  assert.ok(!view.abilityGroups.flatMap(group => group.rows).some(row => row.id === "Hidden"));
  assert.ok(view.abilityGroups.flatMap(group => group.rows).some(row => row.id === "Active buff"));
  assert.ok(!view.resourcePools.some(row => row.key === resource));
  assert.equal(view.favoriteSlots[0].id, "Hidden");
  const all = f.render({ showAllFormAbilities: true, showAllFormResources: true });
  assert.ok(all.abilityGroups.flatMap(group => group.rows).some(row => row.id === "Hidden"));
  assert.ok(all.resourcePools.some(row => row.key === resource));
  assert.ok(!all.overviewPools.some(row => row.key === resource), "Show all affects the editor's list, preserving the overview filter");
  assert.equal(form.system.loadout.resources[resource], false);
  assert.equal(form.system.effectsActive, true);
});

test("saved legacy forms retain their header, ability entry, favorite reference and active Status", () => {
  const f = fixture();
  const effect = {
    id: "legacy",
    uuid: `${f.actor.uuid}.ActiveEffect.legacy`,
    name: "Saved form",
    parent: f.actor,
    disabled: false,
    system: { changes: [] },
    flags: { "worlds-beyond": { managed: true, kind: "form" } }
  };
  f.actor.effects.push(effect);
  f.system.favorites = [effect.uuid];
  const view = f.render({ editable: false });
  assert.equal(view.hasForms, true);
  assert.equal(view.hasActiveForm, true);
  assert.equal(view.overviewForm, "Saved form");
  assert.equal(view.canRenameBaseForm, false);
  assert.equal(view.abilityGroups.flatMap(group => group.rows)[0].uuid, effect.uuid);
  assert.equal(view.favoriteSlots[0].legacy, true);
  assert.equal(view.activeStatuses[0].name, "Saved form");
  assert.equal(effect.disabled, false);
});

test("zero overrides and blank identity remain intentional while equipment presentation leaves input rows untouched", () => {
  const f = fixture();
  f.source.details = { class: " ", race: "", notes: "" };
  f.system.health.maxOverride = 0;
  const equipment = [{ id: "sword", quantity: 1.5 }],
    groups = [{ label: "Weapons", rows: equipment }];
  freeze(equipment);
  freeze(groups);
  const view = f.render({ equipment, equipmentGroups: groups });
  assert.equal(view.overviewClass, "");
  assert.equal(view.overviewRace, "");
  assert.equal(view.hasForms, false);
  assert.equal(view.hasAdjustments, true);
  assert.equal(view.resources[0].maxOverride, 0);
  assert.equal(view.equipment[0].quantity, 1);
  assert.equal(equipment[0].quantity, 1.5);
  assert.equal(view.equipmentGroups[0].rows[0].id, "sword");
});
