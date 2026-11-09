import { MAGIC_RESOURCES, customResourceId } from "./resources.mjs";
const entries = items => Array.from(items?.values?.() ?? items ?? []);
const value = input => (typeof input === "number" ? Math.floor(input) : (input ?? ""));
export const escapeLogText = input =>
  String(input ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function actorLogSnapshot(actor) {
  const system = actor.system ?? {};
  const fields = { Name: actor.name, Level: system.level, Portrait: actor.img };
  for (const key of ["health", "ap", "reactions", "wonder"]) {
    fields[`${key} Current`] = value(system[key]?.value);
    fields[`${key} Maximum`] = value(system[key]?.max);
  }
  fields["Hit dice spent"] = system.hitDice?.spent;
  fields.Exhaustion = system.exhaustion;
  fields["Command AP"] = system.command?.value;
  for (const [key, stat] of Object.entries(system.stats ?? {})) {
    fields[`${key.toUpperCase()} Base`] = stat.value;
    fields[`${key.toUpperCase()} Effective`] = stat.effective ?? stat.value;
  }
  for (const [key, amount] of Object.entries(system.currency ?? {})) fields[`Currency ${key}`] = amount;
  for (const [key, text] of Object.entries(system.details ?? {})) fields[`Text · ${key}`] = text;
  const pools = [
    ...Object.entries(MAGIC_RESOURCES)
      .filter(([key]) => system[key])
      .map(([key, definition]) => [definition.label, system[key]]),
    ...Object.entries(system.customResources ?? {})
      .filter(([key]) => customResourceId(key))
      .map(([, pool]) => [pool.name || "Resource", pool])
  ];
  for (const [name, pool] of pools) {
    for (const key of [
      "value",
      "max",
      "maxOverride",
      "bonus",
      "minOverride",
      "currentLimit",
      "regen",
      "autoRecover",
      "refillOnRest",
      "allowOverflow",
      "enabled",
      "display"
    ])
      fields[`${name} · ${key}`] = value(pool[key]);
  }
  fields.Favorites = JSON.stringify(system.favorites ?? []);
  fields.Advancement = JSON.stringify(system.advancement ?? {});
  return fields;
}

export function documentLogSnapshot(document) {
  const system = document.system ?? {};
  return {
    Name: document.name,
    Artwork: document.img,
    Equipped: system.equipped,
    Quantity: system.quantity,
    Shots: system.shots,
    Active: system.effectsActive,
    "Uses spent": system.uses?.spent,
    Cooldown: system.cooldown?.remaining,
    "AP cost": system.apCost,
    "Resource cost": system.resourceCost,
    "Maximum bonus": system.bonus,
    Damage: system.damage,
    "Armor rating": system.armorRating,
    Evasion: system.evasionBonus,
    Duration: JSON.stringify(system.activeDuration ?? system.bonusDuration ?? {}),
    Trigger: JSON.stringify(system.trigger ?? {}),
    Description: system.description,
    Notes: system.notes,
    Loadout: JSON.stringify(system.loadout ?? {}),
    Bonuses: JSON.stringify(system.changes ?? []),
    Disabled: document.disabled,
    Expired: document.duration?.expired
  };
}

export function logChanges(before = {}, after = {}) {
  const changes = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (Object.is(before[key], after[key])) continue;
    if (/^Text ·|Description|Notes|Portrait|Artwork|Loadout|Bonuses|Favorites|Advancement|Duration|Trigger/.test(key))
      changes.push(`${key} edited`);
    else changes.push(`${key}: ${String(before[key] ?? "—")} → ${String(after[key] ?? "—")}`);
  }
  return changes;
}

export function renderLog(records) {
  return (
    '<div class="worlds-beyond wb-dm-log">' +
    [...records]
      .reverse()
      .map(
        record =>
          `<article><h3>${escapeLogText(record.character)} · ${escapeLogText(record.player)}</h3><p><time>${escapeLogText(record.time)}</time> · ${escapeLogText(record.action)}${record.token ? " · Token copy" : ""}</p><ul>${record.changes.map(change => `<li>${escapeLogText(change)}</li>`).join("")}</ul></article>`
      )
      .join("") +
    "</div>"
  );
}
