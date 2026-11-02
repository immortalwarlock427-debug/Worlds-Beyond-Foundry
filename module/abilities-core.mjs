// Foundry-free ability records and cost previews. Timers remain manual.
import { STATS } from "./stats.mjs";
import { actionApCost } from "./attacks.mjs";
import { numberOr } from "./core-numbers.mjs";
import { wholeNumber } from "./number-display.mjs";
import { recoveryChoices } from "./consumable-benefits.mjs";

export const ABILITY_TYPES = Object.freeze({ active: "Active", passive: "Passive", reaction: "Reaction", form: "Form", other: "Other" });
export const ABILITY_COST_UNITS = Object.freeze({ points: "Points", percent: "% of maximum" });
export const ABILITY_STATS = Object.freeze(Object.fromEntries([["", "None (fixed cost)"], ...STATS.map(stat => [stat.key, stat.label])]));
export const ABILITY_ICON = "icons/svg/book.svg";

export function abilityUses(system) {
  const max = numberOr(system.uses?.max, null);
  return { max, value: max === null ? null : max - numberOr(system.uses?.spent, 0), tracked: max !== null };
}

export function abilityResources(system, selected = "") {
  const choices = [{ value: "", label: "None" }, { value: "mana", label: "Mana" }, { value: "holyPower", label: "Holy power" },
    ...Object.entries(system?.customResources ?? {}).map(([value, resource]) => ({ value, label: resource.name || "Resource" }))];
  if (selected && !choices.some(choice => choice.value === selected)) choices.push({ value: selected, label: "Missing resource" });
  return choices.map(choice => ({ ...choice, selected: choice.value === selected }));
}

export function abilityRecord(item, character) {
  const system = item.system;
  const base = numberOr(system.apCost, null), modifier = character?.stats?.[system.apDiscountStat]?.mod;
  const adjusted = base !== null && Object.hasOwn(ABILITY_STATS, system.apDiscountStat || "") && system.apDiscountStat && modifier != null;
  const ap = base === null ? null : adjusted ? actionApCost(base, modifier) : base;
  const resource = abilityResources(character, system.resourceId).find(choice => choice.value === system.resourceId);
  const cost = numberOr(system.resourceCost, null);
  const uses = abilityUses(system);
  const cooldown = numberOr(system.cooldown?.rounds, null), remaining = numberOr(system.cooldown?.remaining, 0);
  const parts = [];
  if (ap !== null) parts.push(`${wholeNumber(ap)} AP`);
  if (cost !== null && system.resourceId) parts.push(`${wholeNumber(cost)}${system.resourceUnit === "percent" ? "%" : ""} ${resource.label}`);
  const restoration = String(system.restoration?.amount ?? "").trim();
  if (restoration && system.kind !== "passive") {
    const target = system.restoration.target ?? "health";
    const label = recoveryChoices(character, target).find(choice => choice.value === target)?.label ?? "Resource";
    parts.push(`Restore ${restoration}${system.restoration.unit === "percent" ? "%" : ""} ${label}`);
  }
  if (uses.tracked) parts.push(`${wholeNumber(uses.value)} / ${wholeNumber(uses.max)} uses`);
  if (remaining > 0) parts.push(`${wholeNumber(remaining)} rounds left`);
  else if (cooldown > 0) parts.push(`Ready · ${wholeNumber(cooldown)}-round cooldown`);
  return {
    id: item.id, name: item.name, effectsActive: !!system.effectsActive, canUse: system.kind !== "passive", img: !item.img || item.img === "icons/svg/item-bag.svg" ? ABILITY_ICON : item.img,
    kind: system.kind || "active", category: system.category || "", description: system.description || "", notes: system.notes || "",
    duration: system.duration || "", recovery: system.uses?.recovery || "", hasDetails: !!(system.description || system.notes || system.duration || system.uses?.recovery),
    summary: parts.join(" · ") || ABILITY_TYPES[system.kind] || "Ability",
    ap, baseAp: base, apAdjusted: !!adjusted, uses, cooldown, remaining
  };
}

export function abilityGroups(items, character) {
  const records = Array.from(items).filter(item => item.type === "ability").map(item => abilityRecord(item, character));
  return Object.entries(ABILITY_TYPES).map(([kind, label]) => ({ label: kind === "form" ? "Forms" : label, rows: records.filter(row => row.kind === kind) })).filter(group => group.rows.length);
}

export function abilityFormUpdates(system, data) {
  const entered = data.usesCurrent;
  delete data.usesCurrent;
  if (entered === undefined) return data;
  const current = entered == null || entered === "" ? null : Math.floor(Number(entered));
  if (current !== null && !Number.isFinite(current)) throw new Error("Enter a number of uses, or clear to restore uses.");
  const prior = abilityUses(system);
  if (current !== null && current === wholeNumber(prior.value)) return data;
  const maximum = data.system?.uses && Object.hasOwn(data.system.uses, "max") ? numberOr(data.system.uses.max, null) : prior.max;
  if (maximum !== null) {
    data.system ??= {}; data.system.uses ??= {};
    data.system.uses.spent = current === null ? 0 : maximum - current;
  }
  return data;
}
