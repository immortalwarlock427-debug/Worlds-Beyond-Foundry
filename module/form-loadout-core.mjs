// Form presentation and equipment plans, without Foundry or stored mutations.
import { abilityActive } from "./ability-timers-core.mjs";
import { itemList, stowedConflicts, wornGear } from "./loadout.mjs";
import { hasTokenLoadout } from "./form-token-core.mjs";
export const formGear = wornGear;
export const activeLoadoutForm = actor =>
  itemList(actor?.items).find(item => item.type === "ability" && item.system.kind === "form" && abilityActive(item)) ?? null;
export const equipmentSnapshot = actor =>
  Object.fromEntries(
    itemList(actor.items)
      .filter(formGear)
      .map(item => [item.id, !!item.system.equipped])
  );
export function equipmentPlan(actor, profile = {}) {
  const items = itemList(actor.items)
    .filter(formGear)
    .map(item => ({ id: item.id, type: item.type, system: { ...item.system, equipped: profile[item.id] === true } }));
  const stowed = new Set(stowedConflicts(items));
  return items
    .map(item => ({ _id: item.id, "system.equipped": item.system.equipped && !stowed.has(item.id) }))
    .filter(update => !!actor.items.get(update._id).system.equipped !== update["system.equipped"]);
}
export function formShowsAbility(form, item) {
  // Definitions remain accessible; an active source must always be endable.
  return item.system.kind === "form" || abilityActive(item) || form?.system.loadout?.abilities?.[item.id] !== false;
}
export const formShowsResource = (form, key) => form?.system.loadout?.resources?.[key] !== false;
export const hasPhysicalLoadout = form =>
  !!(form?.system.loadout?.portrait || form?.system.loadout?.gearEnabled || hasTokenLoadout(form?.system.loadout));

// Item sheets submit all controls. An untouched checkbox must not turn a
// portrait/notes edit into a new preset or write default visibility memberships.
export function formLoadoutFormUpdates(system, data) {
  const loadout = data.system?.loadout,
    saved = system.loadout ?? {};
  if (!loadout) return data;
  for (const [key, fallback] of [
    ["portrait", ""],
    ["portraitY", null],
    ["tokenImg", ""],
    ["tokenWidth", null],
    ["tokenHeight", null],
    ["tokenScale", null],
    ["transitionSeconds", 0],
    ["gearEnabled", false]
  ])
    if (loadout[key] === (saved[key] ?? fallback)) delete loadout[key];
  for (const key of ["equipment", "abilities", "resources"]) {
    if (!loadout[key]) continue;
    for (const [id, value] of Object.entries(loadout[key]))
      if (value === (saved[key]?.[id] ?? key !== "equipment")) delete loadout[key][id];
    if (!Object.keys(loadout[key]).length) delete loadout[key];
  }
  for (const [key, value] of Object.entries(loadout.resourceMaxima ?? {})) {
    const maximum = value == null || value === "" ? null : Number(value);
    if (maximum === (saved.resourceMaxima?.[key] ?? null)) delete loadout.resourceMaxima[key];
    else loadout.resourceMaxima[key] = maximum;
  }
  if (loadout.resourceMaxima && !Object.keys(loadout.resourceMaxima).length) delete loadout.resourceMaxima;
  if (!Object.keys(loadout).length) delete data.system.loadout;
  return data;
}
