// Using a targeted ability on a token: pay its costs through Use, roll the attack or
// set the save, then post an attack card the automatic resolution can run.
import { STATS, formatModifier } from "./stats.mjs";
import { checkMode, describeD20Roll } from "./rolls.mjs";
import { attackOutcome } from "./attacks.mjs";
import { abilityRecord } from "./abilities-core.mjs";
import { abilityActive } from "./ability-timers-core.mjs";
import { createActionMessage } from "./action-support.mjs";
import { wholeNumber } from "./number-display.mjs";
import { strikeAutomation } from "./strike-settings.mjs";
import { saveDc, targetingStat, resolveStatTerms } from "./strike-core.mjs";
import { itemList } from "./loadout.mjs";

const SYSTEM_ID = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const statLabel = key => STATS.find(stat => stat.key === key)?.label ?? key;

export function targetedAbilities(actor) {
  return itemList(actor.items).filter(
    item =>
      item.type === "ability" && !["passive", "form"].includes(item.system.kind) && ["attack", "save"].includes(item.system.targeting?.mode)
  );
}

export function abilityStrikePlan(actor, item) {
  const targeting = item.system.targeting;
  const stat = targetingStat(item.system);
  const mod = stat ? (actor.system.stats[stat]?.mod ?? 0) : 0;
  return { check: targeting.mode, stat, mod, dc: saveDc(mod, targeting.dc), saveStat: targeting.saveStat || "" };
}

export async function promptAbilityStrike(actor, itemId, target) {
  const item = actor.items.get(itemId);
  if (!actor.isOwner || item?.type !== "ability" || !target) return;
  if (abilityActive(item)) throw new Error(`${item.name} is already active. End it on the sheet before using it again.`);
  const plan = abilityStrikePlan(actor, item);
  const record = abilityRecord(item, actor.system);
  const lines = [
    `<p class="wb-dialog-meta">${escapeHTML(actor.name)} → ${escapeHTML(target.name)}</p>`,
    `<p>${escapeHTML(record.summary)}</p>`,
    plan.check === "save"
      ? `<p>${escapeHTML(target.name)} makes ${plan.saveStat ? `a ${statLabel(plan.saveStat)}` : "a"} save against DC ${wholeNumber(plan.dc)}.</p>`
      : `<p>Attack with ${plan.stat ? `${statLabel(plan.stat)} (${formatModifier(plan.mod)})` : "no modifier"} against Natural Evasion ${wholeNumber(target.evasion ?? "?")}.</p>`
  ];
  const modes =
    plan.check === "attack"
      ? `<fieldset class="wb-dice-choices"><legend>Dice</legend>${["normal", "advantage", "disadvantage"]
          .map(
            mode =>
              `<label><input type="radio" name="rollMode" value="${mode}"${mode === "normal" ? " checked" : ""}> ${checkMode(mode).label}</label>`
          )
          .join("")}</fieldset>`
      : "";
  const form = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"],
    position: { width: 380 },
    window: { title: `Use ${item.name}` },
    content: `<div class="wb-check-options">${lines.join("")}${modes}</div>`,
    ok: { label: "Use" },
    rejectClose: false
  });
  if (!form) return;
  return rollAbilityStrike(actor, item, target, { rollMode: form.rollMode ?? "normal" });
}

export async function rollAbilityStrike(actor, item, target, { rollMode = "normal" } = {}) {
  const { useAbility } = await import("./abilities.mjs");
  // Use pays AP (in combat), resource costs and uses, and starts cooldowns and bonuses.
  const used = await useAbility(actor, item.id);
  if (!used) return;
  const plan = abilityStrikePlan(actor, item);
  const messageMode = game.settings.get("core", "messageMode");
  const targeting = item.system.targeting;
  const hand = {
    hand: "main",
    abilityId: item.id,
    name: item.name,
    stat: plan.stat,
    mod: plan.mod,
    damageType: targeting.damageType ?? ""
  };
  let section = "",
    rolls = [];
  if (plan.check === "attack") {
    const roll = await new foundry.dice.Roll(checkMode(rollMode).formula, { mod: plan.mod }).evaluate({
      allowInteractive: messageMode !== "blind"
    });
    const natural = roll.dice[0]?.total;
    const outcome = attackOutcome({ natural, total: roll.total, evasion: target.evasion ?? null, threshold: 20 });
    Object.assign(hand, { total: roll.total, natural, ...outcome });
    const breakdown = describeD20Roll(roll, rollMode);
    const result =
      outcome.hit === null
        ? "Compare with the target's Natural Evasion."
        : outcome.hit
          ? outcome.critical
            ? `Critical hit on ${escapeHTML(target.name)}!`
            : `Hits ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`
          : `Misses ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`;
    section =
      `<p>Attack with ${plan.stat ? `${statLabel(plan.stat)} (${formatModifier(plan.mod)})` : "no modifier"} · ${checkMode(rollMode).label}</p>` +
      `<p>${result}</p>` +
      (await roll.render()) +
      (breakdown ? `<p class="wb-dice-results">${breakdown.diceText}</p>` : "");
    rolls = [roll];
  } else {
    Object.assign(hand, { hit: true, critical: false, total: null, natural: null });
    section = `<p>${escapeHTML(target.name)} makes ${plan.saveStat ? `a ${statLabel(plan.saveStat)}` : "a"} save against DC ${wholeNumber(plan.dc)}${targeting.onSave === "half" ? " for half damage" : ""}.</p>`;
  }
  // Stat names resolve to this character's current modifiers at the moment of use.
  const mods = Object.fromEntries(STATS.map(stat => [stat.key, actor.system.stats[stat.key]?.mod ?? 0]));
  const damage = resolveStatTerms(targeting.damage, mods, plan.mod);
  const content =
    `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(item.name)}</h3>` +
    `<section class="wb-attack-hand" data-hand="0">${section}</section>` +
    (damage ? `<p>Damage: ${escapeHTML(damage)}${targeting.damageType ? ` ${escapeHTML(targeting.damageType)}` : ""}.</p>` : "") +
    "</div>";
  return createActionMessage(
    {
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content,
      rolls,
      flags: {
        [SYSTEM_ID]: {
          attack: {
            actorUuid: actor.uuid,
            attackerName: actor.name,
            target,
            overwhelmingForce: false,
            automated: strikeAutomation() && !!target?.actorUuid,
            ability: {
              id: item.id,
              name: item.name,
              check: plan.check,
              dc: plan.check === "save" ? plan.dc : null,
              saveStat: plan.saveStat,
              onSave: targeting.onSave === "half" ? "half" : "none",
              damage,
              damageType: targeting.damageType ?? ""
            },
            hands: [{ ...hand, damageRolled: false }]
          }
        }
      }
    },
    { messageMode }
  );
}
