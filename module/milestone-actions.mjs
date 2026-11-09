// Milestone Use buttons and trackers. Rules and counting live in milestone-actions-core.mjs.
import { milestoneUsage, milestoneUsages, spendMilestone, correctMilestone, usageText } from "./milestone-actions-core.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { planApPayment, payAp } from "./combat-support.mjs";
import { rollStatCheck } from "./roll-actions.mjs";
import { formatModifier } from "./stats.mjs";
import { wholeNumber } from "./number-display.mjs";
import { selfStabilize } from "./death.mjs";

const SYSTEM_ID = "worlds-beyond";
const FLAG = "milestoneUses";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The started combat this character is in, as { id, round }, or null.
export function actorCombat(actor) {
  const combat = Array.from(globalThis.game?.combats ?? []).find(
    combat => combat.started && combat.combatants.some(c => c.actor?.uuid === actor.uuid)
  );
  return combat ? { id: combat.id, round: combat.round } : null;
}

export const milestoneRecords = actor => actor.getFlag?.(SYSTEM_ID, FLAG) ?? {};

// Rows for the Abilities tab: unlocked milestones that have a Use button or tracker.
export function milestoneActionRows(actor) {
  return milestoneUsages(actor.system, milestoneRecords(actor), actorCombat(actor))
    .filter(usage => usage.unlocked)
    .map(usage => ({
      id: usage.id,
      label: usage.label,
      threshold: usage.at,
      stat: usage.stat,
      statLabel: usage.statLabel,
      text: usage.text,
      usage: usageText(usage),
      remaining: usage.remaining,
      maximum: usage.maximum,
      ready: usage.ready,
      attack: !!usage.attack,
      stabilize: usage.id === "indomitable",
      dc: usage.dc
    }));
}

const flagPath = id => `flags.${SYSTEM_ID}.${FLAG}.${id}`;

async function saveRecord(actor, id, next, change) {
  const previous = milestoneRecords(actor)[id] ?? { combatId: null, round: null, outside: 0 };
  return change(
    () => actor.update({ [flagPath(id)]: next }),
    () => actor.update({ [flagPath(id)]: previous })
  );
}

// Spend one use of a milestone, paying its AP in combat. Returns the chat message.
export async function useMilestone(actor, id) {
  if (!actor?.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      const combat = actorCombat(actor);
      const record = milestoneRecords(actor)[id] ?? {};
      const usage = milestoneUsage(actor.system, id, record, combat);
      if (!usage) return;
      if (usage.attack) throw new Error(`Declare ${usage.label} in a weapon attack's dialog.`);
      const next = spendMilestone(actor.system, id, record, combat);
      if (usage.ap) planApPayment(actor, usage.ap);
      if (usage.ap) await payAp(actor, usage.ap, change);
      await saveRecord(actor, id, next, change);
      const after = milestoneUsage(actor.system, id, next, combat);
      const extra =
        usage.id === "stratagem"
          ? `<p class="wb-result">Your ally's next attack roll or ability check adds ${formatModifier(usage.modifier)}.</p>`
          : usage.id === "commanding-presence"
            ? `<p class="wb-result">Charisma save DC ${wholeNumber(usage.dc)}.</p>`
            : usage.id === "titans-might"
              ? '<p class="wb-result">Push 15 ft, or try to knock the target prone.</p>'
              : "";
      const message = await createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content:
            `<div class="worlds-beyond wb-ability-card wb-milestone-card"><h3>${escapeHTML(usage.label)}</h3>` +
            `<p class="wb-dialog-meta">${usage.statLabel} ${usage.at} milestone${usage.ap ? ` · ${usage.ap} AP spent` : ""} · Uses left: ${after.remaining} / ${after.maximum} ${after.period}</p>` +
            extra +
            `<p>${escapeHTML(usage.text)}</p></div>`,
          flags: { [SYSTEM_ID]: { sheetActivity: { actorUuid: actor.uuid, label: `Used ${usage.label}` } } }
        },
        { messageMode: game.settings.get("core", "messageMode") }
      );
      if (usage.roll) await rollStatCheck(actor, usage.stat, { kind: "check" });
      return message;
    })
  );
}

// Manual correction from the sheet's uses field.
export async function setMilestoneUses(actor, id, remaining) {
  if (!actor?.isOwner) return;
  const combat = actorCombat(actor);
  const record = milestoneRecords(actor)[id] ?? {};
  const next = correctMilestone(actor.system, id, remaining, record, combat);
  return actor.update({ [flagPath(id)]: next });
}

// Singularity, declared in the attack dialog. Returns the update to apply once the
// attack is rolled, or throws if it can't be declared.
export function singularityPlan(actor) {
  const combat = actorCombat(actor);
  const record = milestoneRecords(actor).singularity ?? {};
  return { next: spendMilestone(actor.system, "singularity", record, combat), previous: record };
}

export function singularityReady(actor) {
  const usage = milestoneUsage(actor.system, "singularity", milestoneRecords(actor).singularity, actorCombat(actor));
  return usage.unlocked ? { ready: usage.ready, text: usageText(usage) } : null;
}

export const singularityUpdate = next => ({ [flagPath("singularity")]: next });

// Indomitable's stabilization roll below 0 Health: d20 + VIT modifier against DC 12.
export async function rollStabilize(actor) {
  if (!actor?.isOwner) return;
  const messageMode = game.settings.get("core", "messageMode");
  const roll = await new foundry.dice.Roll("1d20 + @mod", { mod: actor.system.stats.vit.mod }).evaluate({
    allowInteractive: messageMode !== "blind"
  });
  const success = roll.total >= 12;
  if (success) await selfStabilize(actor);
  return roll.toMessage(
    {
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content:
        '<div class="worlds-beyond wb-ability-card wb-milestone-card"><h3>Indomitable: stabilize</h3>' +
        `<p class="wb-dialog-meta">d20 ${formatModifier(actor.system.stats.vit.mod)} vs DC 12</p>` +
        (await roll.render()) +
        `<p class="wb-result">${success ? "Success: you stop bleeding and remain unconscious." : "Failure."}</p></div>`
    },
    { messageMode }
  );
}

// Long rest: clears every milestone's spent uses.
export const milestoneRestUpdates = actor => (actor.getFlag?.(SYSTEM_ID, FLAG) ? { [`flags.${SYSTEM_ID}.-=${FLAG}`]: null } : {});

// Once-per-round and once-per-combat trackers depend on the combat, so redraw open
// sheets of its characters when a round or combat starts or ends.
export function registerMilestoneActions() {
  const refresh = combat => {
    for (const combatant of combat.combatants ?? []) {
      const sheet = combatant.actor?.sheet;
      if (combatant.actor?.type === "character" && sheet?.rendered) sheet.render();
    }
  };
  Hooks.on("updateCombat", (combat, changes) => {
    if ("round" in changes) refresh(combat);
  });
  Hooks.on("deleteCombat", refresh);
}
