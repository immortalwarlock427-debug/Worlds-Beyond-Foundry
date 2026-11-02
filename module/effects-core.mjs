// Native v14 Active Effect records. This module never applies a bonus itself.
import { STATS } from "./stats.mjs";
import { customResourceId } from "./resources.mjs";
import { numberOr } from "./core-numbers.mjs";
import { wholeNumber } from "./number-display.mjs";
import { effectTimeLeft } from "./effect-duration.mjs";
import { timerKind, abilityActive, abilityTimeLeft } from "./ability-timers-core.mjs";

export const EFFECT_SCOPE = "worlds-beyond";
export const effectFlags = effect => effect.flags?.[EFFECT_SCOPE] ?? {};
export const managedEffect = effect => effectFlags(effect).managed === true;
export const formEffect = effect => managedEffect(effect) && effectFlags(effect).kind === "form";
export const effectChanges = effect => effect.system?.changes ?? [];
export const boundItem = effect => managedEffect(effect) && effectFlags(effect).itemBound ? (effect.item ?? (effect.parent?.documentName === "Item" ? effect.parent : null)) : null;
export function itemEffectState(effect) {
  const item = boundItem(effect);
  if (!item) return "";
  if (item.type === "consumable") return "On use";
  if (item.type === "ability") return item.system?.kind === "passive" || abilityActive(item) ? "" : "Ability inactive";
  return item.system?.equipped ? "" : "Not equipped";
}
export function itemEffectRows(item) {
  return Array.from(item.effects?.values?.() ?? item.effects ?? []).filter(effect => !timerKind(effect)).map(effect => ({
    id: effect.id, name: effect.name, disabled: !!effect.disabled,
    state: effect.disabled ? "Off" : itemEffectState(effect) || "Enabled",
    summary: effectChanges(effect).map(change => effectChangeText(change, item.actor?.system)).join(" · ") || "No bonuses"
  }));
}
const effectList = effects => effects?.values ? Array.from(effects.values()) : Array.from(effects ?? []);
export function itemBonusSummary(item) {
  const changes = effectList(item.effects).filter(effect => !effect.disabled && !effect.duration?.expired).flatMap(effect => Array.from(effectChanges(effect)));
  const totals = new Map(), advanced = [];
  for (const change of changes) {
    if (change.type !== "add" || change.phase !== "initial" || numberOr(change.value, null) === null) { advanced.push(effectChangeText(change, item.actor?.system)); continue; }
    if (customEffectResource(change.key) && !item.actor?.system?.customResources?.[customEffectResource(change.key)]) continue;
    totals.set(change.key, (totals.get(change.key) ?? 0) + Number(change.value));
  }
  return [...totals].filter(([, value]) => value !== 0).map(([key, value]) => {
    const stat = STATS.find(stat => key === `system.stats.${stat.key}.value`);
    const label = stat?.abbr ?? ({ "system.bonuses.armor": "AR", "system.bonuses.evasion": "Evasion", "system.bonuses.movement": "ft/AP" })[key]
      ?? effectTargets(item.actor?.system, key).find(target => target.value === key)?.label ?? key;
    return `${value >= 0 ? "+" : ""}${wholeNumber(value)} ${label}`;
  }).concat(advanced).join(" · ");
}
export const customEffectResource = key => /^system\.customResources\.([A-Za-z0-9]{16})\.bonus$/.exec(key)?.[1] ?? null;

export function effectTargets(system = {}, current = "") {
  const targets = [
    ...STATS.map(stat => ({ value: `system.stats.${stat.key}.value`, label: `${stat.label} score` })),
    { value: "system.bonuses.armor", label: "Armor Rating" }, { value: "system.bonuses.evasion", label: "Natural Evasion" },
    { value: "system.bonuses.movement", label: "Movement / AP (ft)" },
    { value: "system.mana.bonus", label: "Mana maximum" }, { value: "system.holyPower.bonus", label: "Holy power maximum" },
    ...Object.entries(system.customResources ?? {}).filter(([id]) => customResourceId(id)).map(([id, pool]) => ({
      value: `system.customResources.${id}.bonus`, label: `${pool.name || "Resource"} maximum`
    }))
  ];
  if (current && !targets.some(target => target.value === current)) targets.push({ value: current, label: "Missing resource / advanced target" });
  return targets.map(target => ({ ...target, selected: target.value === current }));
}

export function simpleEffectChange(change) {
  const known = effectTargets().some(target => target.value === change.key) || !!customEffectResource(change.key);
  return known && change.type === "add" && change.phase === "initial" && numberOr(change.value, null) !== null;
}

export const newEffectChange = () => ({ key: "system.stats.str.value", type: "add", value: 0, phase: "initial", priority: 20 });

export function effectChangeText(change, system) {
  const label = effectTargets(system, change.key).find(target => target.value === change.key)?.label ?? change.key;
  const value = numberOr(change.value, null);
  return change.type === "add" && value !== null ? `${label} ${value >= 0 ? "+" : ""}${wholeNumber(value)}`
    : `${label}: ${change.type} ${String(change.value ?? "")}`;
}

export function effectSnapshot(effect) {
  return JSON.stringify([effect.name, effect.img, effect.description, effectChanges(effect), effectFlags(effect).kind, effectFlags(effect).source]);
}

export function effectRows(actor) {
  const all = actor.allApplicableEffects ? Array.from(actor.allApplicableEffects()) : effectList(actor.effects);
  return all.filter(effect => !timerKind(effect)).map(effect => {
    const direct = effect.parent === actor;
    const active = !effect.disabled && !effect.duration?.expired && !effect.isSuppressed && !itemEffectState(effect) && (effect.active ?? true);
    const form = direct && formEffect(effect);
    const source = boundItem(effect)?.name || effectFlags(effect).source || effect.item?.name || (effect.origin ? effect.sourceName : "") || "";
    return {
      id: effect.id, uuid: effect.uuid, name: effect.name, img: effect.img || "icons/svg/aura.svg", form, active,
      managed: managedEffect(effect), canRemove: direct, disabled: !!effect.disabled,
      state: effect.disabled ? "Off" : itemEffectState(effect) || (active ? "On" : "Suppressed / expired"),
      source, summary: effectChanges(effect).map(change => effectChangeText(change, actor.system)).join(" · ") || "No bonuses",
      effect, timeLeft: boundItem(effect)?.type === "ability" ? abilityTimeLeft(boundItem(effect)) : effectTimeLeft(effect)
    };
  });
}

export function effectContext(actor) {
  const rows = effectRows(actor);
  const activeRows = rows.filter(row => row.active);
  const sources = {};
  for (const row of activeRows) for (const change of effectChanges(row.effect)) {
    if (change.phase !== "initial" || row.effect.shouldApplyChange?.(change, { phase: "initial" }) === false) continue;
    if (customEffectResource(change.key) && !actor.system.customResources?.[customEffectResource(change.key)]) continue;
    const value = numberOr(change.value, null);
    const adjustment = change.type === "add" && value !== null ? `${value >= 0 ? "+" : ""}${wholeNumber(value)}` : `${change.type} ${String(change.value ?? "")}`;
    (sources[change.key] ??= []).push(`${row.name}: ${adjustment}${row.source ? ` (${row.source})` : ""}`);
  }
  // Status is a live projection of active sources, never a bonus-definition list.
  const statuses = new Map();
  for (const row of activeRows) {
    const item = row.effect.item ?? (row.effect.parent?.documentName === "Item" ? row.effect.parent : null);
    const consumed = effectFlags(row.effect).consumableUse;
    const key = consumed?.id || item?.uuid || item?.id || row.uuid;
    const existing = statuses.get(key);
    if (existing) { existing.summaries.push(row.summary); if (row.timeLeft && !existing.timers.includes(row.timeLeft)) existing.timers.push(row.timeLeft); continue; }
    statuses.set(key, { uuid: row.uuid, itemId: item?.id, abilityId: item?.type === "ability" ? item.id : null,
      name: consumed?.name || item?.name || row.name, img: item?.img || row.img, source: consumed ? "Consumable" : item ? (item.type === "ability" ? (item.system.kind === "form" ? "Form" : "Ability") : "Equipment") : row.source,
      canEnd: item ? item.type === "ability" && item.system.kind !== "passive" && abilityActive(item) : true,
      summaries: [row.summary], timers: row.timeLeft ? [row.timeLeft] : [] });
  }
  const savedAbilities = rows.filter(row => row.effect.parent === actor && row.managed && !effectFlags(row.effect).consumableUse).map(row => ({ ...row,
    legacy: true, kind: row.form ? "form" : "active", effectsActive: row.active, canUse: true,
    category: "", hasDetails: false }));
  const forms = effectList(actor.items).filter(item => item.type === "ability" && item.system.kind === "form");
  for (const item of effectList(actor.items).filter(item => item.type === "ability" && item.system.kind !== "passive" && abilityActive(item))) {
    const key = item.uuid || item.id;
    if (!statuses.has(key)) statuses.set(key, { uuid: item.uuid, itemId: item.id, abilityId: item.id, name: item.name, img: item.img || "icons/svg/book.svg",
      source: item.system.kind === "form" ? "Form" : "Ability", canEnd: true, summaries: ["Active"], timers: abilityTimeLeft(item) ? [abilityTimeLeft(item)] : [] });
  }
  return {
    groups: [{ label: "Forms", rows: rows.filter(row => row.form) }, { label: "Effects", rows: rows.filter(row => !row.form) }].filter(group => group.rows.length),
    savedAbilities, statuses: Array.from(statuses.values(), row => ({ ...row, summary: row.summaries.join(" · "), timeLeft: row.timers.join(" · ") })),
    hasForms: forms.length > 0 || rows.some(row => row.form), hasActiveForm: forms.some(abilityActive) || rows.some(row => row.form && row.active),
    sources: Object.fromEntries(Object.entries(sources).map(([key, values]) => [key, values.join(" · ")]))
  };
}

export function formUpdates(effects, selectedId = null) {
  const forms = effectList(effects).filter(formEffect);
  if (selectedId !== null && !forms.some(effect => effect.id === selectedId)) throw new Error("That form no longer exists. Reopen the sheet.");
  // Include every form, even unchanged ones, so competing clients submit complete
  // selections rather than independently enabling two different forms.
  return forms.map(effect => ({ _id: effect.id, disabled: effect.id !== selectedId }));
}

// Preserve unknown/native advanced changes and unchanged fractional values.
export function effectFormUpdates(effect, data) {
  const edits = data.effectRows;
  delete data.effectRows;
  if (!edits) return data;
  const changes = effectChanges(effect).map((change, index) => {
    const edit = edits[index];
    if (!edit || !simpleEffectChange(change)) return { ...change };
    const key = edit.key ?? change.key;
    if (!effectTargets().some(target => target.value === key) && !customEffectResource(key)) throw new Error("Choose a supported bonus target.");
    let value = change.value;
    if (edit.value !== undefined) {
      const parsed = numberOr(edit.value, 0);
      if (!Number.isFinite(Number(edit.value))) throw new Error("Enter a numeric bonus or penalty.");
      if (edit.value === "" || edit.value === null || Math.floor(parsed) !== Math.floor(Number(change.value))) value = Math.floor(parsed);
    }
    return { ...change, key, value };
  });
  if (JSON.stringify(changes) !== JSON.stringify(effectChanges(effect))) {
    data.system ??= {}; data.system.changes = changes;
  }
  return data;
}
