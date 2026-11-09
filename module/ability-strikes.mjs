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
import { areaLabel, visualSettings } from "./area-core.mjs";
import { broadcastEffect } from "./vfx.mjs";

const SYSTEM_ID = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const statLabel = key => STATS.find(stat => stat.key === key)?.label ?? key;

export function targetedAbilities(actor) {
  return itemList(actor.items).filter(
    item =>
      item.type === "ability" &&
      !["passive", "form"].includes(item.system.kind) &&
      ["attack", "save", "heal"].includes(item.system.targeting?.mode)
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
    plan.check === "heal"
      ? `<p>Heals ${escapeHTML(target.name)} for ${escapeHTML(healFormula(actor, item, plan) || "nothing")}.</p>`
      : plan.check === "save"
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

// One target, or every target caught in an area (`area` is the shape key). An area ability set
// to attack has no attack roll: each target Dodges against the DC for half damage (Notion Defenses).
export async function rollAbilityStrike(actor, item, targets, { rollMode = "normal", area = null, visual = null, use = null } = {}) {
  const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  const plan = abilityStrikePlan(actor, item);
  const healing = plan.check === "heal" ? healFormula(actor, item, plan) : null;
  if (healing !== null && (!healing || !foundry.dice.Roll.validate(healing)))
    throw new Error(`Set ${item.name}'s healing amount, such as 2d8 + fth, in Targeting → Healing.`);
  // Use pays AP (in combat), resource costs and uses, and starts cooldowns and bonuses.
  const pay = use ?? (await import("./abilities.mjs")).useAbility;
  const used = await pay(actor, item.id);
  if (!used) return;
  const messageMode = game.settings.get("core", "messageMode");
  const targeting = item.system.targeting;
  if (healing !== null) {
    const message = await postHealing(actor, item, list, { formula: healing, area, messageMode });
    playAbilityVisual(actor, item, list, visual);
    return message;
  }
  const base = {
    hand: "main",
    abilityId: item.id,
    name: item.name,
    stat: plan.stat,
    mod: plan.mod,
    damageType: targeting.damageType ?? ""
  };
  const hands = [];
  const sections = [];
  let rolls = [];
  if (!area && plan.check === "attack") {
    const target = list[0];
    const roll = await new foundry.dice.Roll(checkMode(rollMode).formula, { mod: plan.mod }).evaluate({
      allowInteractive: messageMode !== "blind"
    });
    const natural = roll.dice[0]?.total;
    const outcome = attackOutcome({ natural, total: roll.total, evasion: target?.evasion ?? null, threshold: 20 });
    hands.push({ ...base, target, total: roll.total, natural, ...outcome });
    const breakdown = describeD20Roll(roll, rollMode);
    const result =
      outcome.hit === null
        ? "Compare with the target's Natural Evasion."
        : outcome.hit
          ? outcome.critical
            ? `Critical hit on ${escapeHTML(target.name)}!`
            : `Hits ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`
          : `Misses ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`;
    sections.push(
      `<p>Attack with ${plan.stat ? `${statLabel(plan.stat)} (${formatModifier(plan.mod)})` : "no modifier"} · ${checkMode(rollMode).label}</p>` +
        `<p>${result}</p>` +
        (await roll.render()) +
        (breakdown ? `<p class="wb-dice-results">${breakdown.diceText}</p>` : "")
    );
    rolls = [roll];
  } else {
    const how =
      plan.check === "save"
        ? `makes ${plan.saveStat ? `a ${statLabel(plan.saveStat)}` : "a"} save against DC ${wholeNumber(plan.dc)}${targeting.onSave === "half" ? " for half damage" : ""}`
        : `can Dodge against DC ${wholeNumber(plan.dc)} for half damage`;
    for (const target of list) {
      hands.push({ ...base, target, hit: true, critical: false, total: null, natural: null });
      sections.push(`<p>${escapeHTML(target.name)} ${how}.</p>`);
    }
  }
  // Stat names resolve to this character's current modifiers at the moment of use.
  const mods = Object.fromEntries(STATS.map(stat => [stat.key, actor.system.stats[stat.key]?.mod ?? 0]));
  const damage = resolveStatTerms(targeting.damage, mods, plan.mod);
  const content =
    `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(item.name)}</h3>` +
    (area ? `<p class="wb-dialog-meta">${escapeHTML(areaLabel(targeting.area))}${list.length ? "" : " · no one inside"}</p>` : "") +
    sections.map((section, index) => `<section class="wb-attack-hand" data-hand="${index}">${section}</section>`).join("") +
    (damage ? `<p>Damage: ${escapeHTML(damage)}${targeting.damageType ? ` ${escapeHTML(targeting.damageType)}` : ""}.</p>` : "") +
    "</div>";
  const message = await createActionMessage(
    {
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content,
      rolls,
      flags: {
        [SYSTEM_ID]: {
          attack: {
            actorUuid: actor.uuid,
            attackerName: actor.name,
            target: area ? null : (list[0] ?? null),
            overwhelmingForce: false,
            automated: strikeAutomation() && hands.length > 0 && hands.every(hand => !!hand.target?.actorUuid),
            ability: {
              id: item.id,
              name: item.name,
              check: plan.check,
              area,
              dc: plan.check === "save" || area ? plan.dc : null,
              saveStat: plan.saveStat,
              onSave: targeting.onSave === "half" ? "half" : "none",
              damage,
              damageType: targeting.damageType ?? ""
            },
            hands: hands.map(hand => ({ ...hand, damageRolled: false }))
          }
        }
      }
    },
    { messageMode }
  );
  playAbilityVisual(actor, item, list, visual);
  return message;
}

// The healing formula with stat names turned into this character's modifiers.
function healFormula(actor, item, plan) {
  const mods = Object.fromEntries(STATS.map(stat => [stat.key, actor.system.stats[stat.key]?.mod ?? 0]));
  return resolveStatTerms(item.system.targeting?.damage, mods, plan.mod).trim();
}

// One roll heals every target by the same amount. The active GM's client applies it (healing.mjs).
async function postHealing(actor, item, list, { formula, area, messageMode }) {
  const roll = await new foundry.dice.Roll(formula).evaluate({ allowInteractive: messageMode !== "blind" });
  const amount = Math.max(0, Math.floor(roll.total));
  const names = list.map(target => escapeHTML(target.name)).join(", ");
  const content =
    `<div class="worlds-beyond wb-attack-card wb-heal-card"><h3>${escapeHTML(item.name)}</h3>` +
    (area ? `<p class="wb-dialog-meta">${escapeHTML(areaLabel(item.system.targeting.area))}${list.length ? "" : " · no one inside"}</p>` : "") +
    `<p class="wb-result">Heals ${wholeNumber(amount)}${names ? `: ${names}` : ""}.</p>` +
    (await roll.render()) +
    "</div>";
  return createActionMessage(
    {
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content,
      rolls: [roll],
      flags: {
        [SYSTEM_ID]: {
          heal: {
            actorUuid: actor.uuid,
            name: item.name,
            amount,
            targets: list.map(target => ({ actorUuid: target.actorUuid ?? null, name: target.name })),
            status: "pending"
          }
        }
      }
    },
    { messageMode }
  );
}

// Single targets get a streak from the caster to the target; areas fill their shape.
function playAbilityVisual(actor, item, targets, visual) {
  try {
    const settings = visual ?? visualSettings(item.system.targeting?.visual);
    if (!settings || settings.effect === "none" || !globalThis.canvas?.ready) return;
    const center = target => (target?.tokenUuid ? foundry.utils.fromUuidSync(target.tokenUuid)?.object?.center : null);
    const caster = actor.isToken ? actor.token?.object : actor.getActiveTokens?.()?.[0];
    broadcastEffect({
      effect: settings.effect,
      color: settings.color,
      shape: settings.shape ?? null,
      origin: settings.origin ?? caster?.center ?? null,
      targets: settings.targets ?? targets.map(center).filter(Boolean)
    });
  } catch (error) {
    console.warn("Worlds Beyond | ability effect failed", error);
  }
}
