import { applyTurnHealthLoss, undoTurnDamage } from "./turn-damage.mjs";
// Death and Dying in Foundry: Death's Mercy on automated damage, Unconscious at 0 Health,
// Bleeding Out at the start of the turn, stabilizing, Trauma and death.
// Rules live in death-core.mjs.
import {
  BLEED_OUT,
  STABILIZE_DC,
  STABILIZE_AP,
  stabilizeSuccess,
  deathThreshold,
  isDead,
  mercyDamage,
  healthTransition,
  dyingSummary
} from "./death-core.mjs";
import { applyCondition, removeCondition } from "./conditions.mjs";
import { newerRecoveryTurn } from "./recovery-core.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { inCombat, planApPayment, payAp } from "./combat-support.mjs";
import { wholeNumber } from "./number-display.mjs";
import { exhaustionAutomated } from "./exhaustion.mjs";
import { exhaustionLevel } from "./exhaustion-core.mjs";
import { unconsciousAutomated, wakeUnconscious } from "./unconscious.mjs";
import { defaultCheckMode, actorConditionRoll, conditionRollText, conditionControls, bindConditionCheck } from "./condition-rolls.mjs";
import { checkMode } from "./rolls.mjs";
import { rollCard } from "./roll-actions.mjs";

const SCOPE = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const deathAutomated = () => {
  try {
    return game.settings.get(SCOPE, "automateDeath") !== false;
  } catch {
    return true;
  }
};

// Called from the system's init hook.
export function registerDeath() {
  game.settings.register(SCOPE, "automateDeath", {
    name: "Automate death and dying",
    hint: "Death's Mercy caps automated hits, characters fall Unconscious at 0 Health, lose 4 Health each turn until stabilized, gain Trauma when they recover and die at their Death Threshold. Off: track it by hand.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    // Native Actor.updateDocuments shares options across the batch. Never let
    // another character's Health become this actor's knockout/recovery baseline.
    options.worldsBeyondDeathHealth = (options.worldsBeyondDeathHealth ?? []).filter(entry => entry.actorUuid !== actor.uuid);
    if (actor.type !== "character") return;
    const next = foundry.utils.getProperty(changes, "system.health.damage");
    if (next == null || !Number.isFinite(Number(next)) || !Number.isFinite(actor.system.health.value)) return;
    options.worldsBeyondDeathHealth.push({ actorUuid: actor.uuid, health: actor.system.health.value });
    // Death's Mercy only shapes damage the system applies (attacks, ticks); sheet edits stay as typed.
    if (!options.worldsBeyondDamage || !deathAutomated()) return;
    const mercy = mercyDamage({
      max: actor.system.health.max,
      previousDamage: actor.system.health.damage,
      nextDamage: Number(next),
      threshold: deathThreshold(actor.system)
    });
    if (mercy.capped) {
      foundry.utils.setProperty(changes, "system.health.damage", mercy.damage);
      options.worldsBeyondMercy = true;
    }
  });
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || actor.type !== "character") return;
    if (foundry.utils.getProperty(changes, "system.health.damage") == null) return;
    const before = options.worldsBeyondDeathHealth?.find(entry => entry.actorUuid === actor.uuid);
    if (!before) return;
    if (!deathAutomated() && !exhaustionAutomated() && !unconsciousAutomated()) return;
    // Keep syncDying's single-actor input local; do not mutate the shared options.
    return syncDying(actor, { ...options, worldsBeyondHealthBefore: before.health }, changes).catch(error =>
      ui.notifications.error(`Death and dying: ${error.message}`)
    );
  });
  Hooks.on("combatTurnChange", (combat, previous, current) =>
    bleedOutTurn(combat, previous, current).catch(error => ui.notifications.error(`Bleeding out: ${error.message}`))
  );
  Hooks.on("createChatMessage", message => {
    const data = message.getFlag?.(SCOPE, "stabilize");
    if (!game.user.isActiveGM || !data?.success || data.applied) return;
    applyStabilized(message).catch(error => ui.notifications.error(error.message));
  });
  Hooks.on("renderChatMessageHTML", decorateBleedOut);
}

// After a Health change: Unconscious at 0 or below, waking and Trauma on recovery, death at the threshold.
export async function syncDying(actor, options, changes) {
  const before = Number(options.worldsBeyondHealthBefore);
  const after = actor.system.health.value;
  const turn = healthTransition(before, after);
  await wakeUnconscious(actor, options);
  const updates = {};
  if (exhaustionAutomated() && !options.worldsBeyondDeathSync) {
    if (turn.knockedOut && !options.worldsBeyondCorrection)
      updates["system.exhaustion"] = Math.min(10, exhaustionLevel(actor.system.exhaustion) + 1);
    if (after >= 1 && exhaustionLevel(actor.system.exhaustion) === 10) updates["system.exhaustion"] = 9;
  }
  if (!deathAutomated()) {
    if (Object.keys(updates).length) await actor.update(updates, { worldsBeyondDeathSync: true });
    return;
  }
  if (turn.recovered) {
    // An explicit Trauma edit in the same update (a long rest) wins.
    // Undoing a damage result isn't a recovery.
    if (!foundry.utils.hasProperty(changes, "system.dying.trauma") && !options.worldsBeyondCorrection)
      updates["system.dying.trauma"] = (actor.system.dying?.trauma ?? 0) + 1;
    if (actor.system.dying?.stabilized) updates["system.dying.stabilized"] = false;
    if (actor.statuses?.has("unconscious")) await removeCondition(actor, "unconscious");
  }
  if (after <= 0 && !actor.statuses?.has("unconscious")) await applyCondition(actor, "unconscious");
  if (Object.keys(updates).length) await actor.update(updates, { worldsBeyondDeathSync: true });
  if (isDead(after, deathThreshold(actor.system)) && !actor.statuses?.has("dead")) await markDead(actor);
}

async function markDead(actor) {
  await actor.toggleStatusEffect("dead", { active: true, overlay: true });
  for (const combat of game.combats ?? [])
    for (const combatant of combat.combatants)
      if (combatant.actor?.uuid === actor.uuid && !combatant.defeated && combatant.canUserModify?.(game.user, "update"))
        await combatant.update({ defeated: true });
}

/* -------------------------------------------- */
/*  Bleeding Out                                */
/* -------------------------------------------- */

async function bleedOutTurn(combat, previous, current) {
  if (!game.user.isActiveGM || !deathAutomated() || !combat.started || current?.round < 1) return;
  if (previous && !newerRecoveryTurn(previous, current)) return;
  const actor = combat.combatant?.actor;
  if (actor?.type !== "character" || !dyingSummary(actor.system).bleedingOut || actor.statuses?.has("dead")) return;
  return bleedOut(actor);
}

export async function bleedOut(actor) {
  return queuedAction(actor.uuid, async () => {
    // Recovery or stabilization may have completed while this tick was queued.
    if (!dyingSummary(actor.system).bleedingOut || actor.statuses?.has("dead")) return null;
    const lost = await applyTurnHealthLoss(actor, BLEED_OUT);
    const summary = dyingSummary(actor.system);
    const status = summary.dead
      ? `${escapeHTML(actor.name)} dies.`
      : `${escapeHTML(actor.name)} is at ${wholeNumber(summary.health)} Health and dies at ${wholeNumber(summary.diesAt)}.`;
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content:
        `<div class="worlds-beyond wb-attack-card wb-dying-card"><h3>Bleeding out</h3>` +
        `<p class="wb-result">${escapeHTML(actor.name)} loses ${wholeNumber(lost)} Health.</p><p>${status}</p>` +
        `<p>Armor Rating and resistance don't reduce it. Another creature can spend ${STABILIZE_AP} AP to stabilize them: d20 + their INT modifier against DC ${STABILIZE_DC}.</p></div>`,
      flags: { [SCOPE]: { bleedOut: { actorUuid: actor.uuid, amount: lost, undone: false } } }
    });
  });
}

/* -------------------------------------------- */
/*  Stabilizing and treatment                   */
/* -------------------------------------------- */

// The character who helps: the user's selected token other than the dying one, else their assigned character.
export function helperFor(target) {
  const controlled = (canvas?.tokens?.controlled ?? []).map(token => token.actor).find(actor => actor && actor.uuid !== target.uuid);
  const assigned = game.user.character?.uuid !== target.uuid ? game.user.character : null;
  const helper = controlled ?? assigned;
  return helper?.isOwner && helper.type === "character" ? helper : null;
}

// Another creature spends 5 AP: d20 + their INT modifier against DC 12. On a success the
// dying character stops bleeding out and stays unconscious until healed.
function requireDown(target) {
  if (!dyingSummary(target.system).down) throw new Error(`${target.name} isn't at 0 Health or below.`);
}

async function retainStabilized(target, change) {
  const previous = target.system.dying?.stabilized ?? false;
  if (previous === true) return true;
  await change(
    () => target.update({ "system.dying.stabilized": true }),
    async () => {
      const saved = await target.update({ "system.dying.stabilized": previous }, { worldsBeyondCorrection: true });
      return saved && target.system.dying.stabilized === previous;
    }
  );
  if (target.system.dying.stabilized !== true) throw new Error("Stabilization was not retained. Correct it on the target's sheet.");
  return true;
}

export async function promptStabilize(target, helper = helperFor(target)) {
  if (!target || target.type !== "character") return;
  if (!helper) throw new Error(`Select the token of the character who stabilizes ${target.name}.`);
  requireDown(target);
  const mode = defaultCheckMode(helper, "check");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SCOPE, "wb-roll-dialog"],
    position: { width: 380 },
    window: { title: `Stabilize ${target.name}` },
    ok: { label: "Try stabilization" },
    rejectClose: false,
    content: await foundry.applications.handlebars.renderTemplate(`systems/${SCOPE}/templates/stabilize-dialog.hbs`, {
      targetName: target.name,
      dc: STABILIZE_DC,
      ap: inCombat(helper) ? STABILIZE_AP : 0,
      conditions: conditionControls(helper),
      conditionText: conditionRollText(actorConditionRoll(helper, "check")),
      normal: mode === "normal",
      advantage: mode === "advantage",
      disadvantage: mode === "disadvantage"
    }),
    render: (event, dialog) => bindConditionCheck(dialog, helper, "int")
  });
  return choices ? stabilize(target, helper, choices) : null;
}

export async function stabilize(target, helper = helperFor(target), { mode, fearInSight } = {}) {
  if (!target || target.type !== "character") return;
  if (!helper) throw new Error(`Select the token of the character who stabilizes ${target.name}.`);
  return queuedAction(`stabilizeTarget:${target.uuid}`, () =>
    queuedAction(helper.uuid, () =>
      reversibleAction(async change => {
        requireDown(target);
        const ap = inCombat(helper) ? STABILIZE_AP : 0;
        if (ap) planApPayment(helper, ap);
        const mod = helper.system.stats?.int?.mod ?? 0;
        const messageMode = game.settings.get("core", "messageMode");
        mode ??= defaultCheckMode(helper, "check", { fearInSight });
        const roll = await new foundry.dice.Roll(checkMode(mode).formula, { mod }).evaluate({ allowInteractive: messageMode !== "blind" });
        const success = stabilizeSuccess(roll.total);
        requireDown(target);
        if (ap) await payAp(helper, ap, change);
        const applied = success && target.isOwner ? await retainStabilized(target, change) : false;
        const context = {
          kind: "check",
          label: `Stabilize ${target.name}`,
          actorUuid: helper.uuid,
          mode,
          conditionText: conditionRollText(actorConditionRoll(helper, "check", { fearInSight })),
          stabilizeCheck: { targetUuid: target.uuid, targetName: target.name, dc: STABILIZE_DC, ap, applied }
        };
        return createActionMessage(
          {
            speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor: helper }),
            content: await rollCard(roll, context),
            rolls: [roll],
            flags: { [SCOPE]: { check: context, stabilize: { targetUuid: target.uuid, success, applied } } }
          },
          { messageMode }
        );
      })
    )
  );
}

// A player can't edit someone else's character, so the active GM applies the
// published success. A failed target/receipt write must not acknowledge it.
export async function applyStabilized(message) {
  if (!game.user.isActiveGM) return;
  return queuedAction(`stabilizeCard:${message.id}`, async () => {
    const receipt = message.getFlag(SCOPE, "stabilize");
    if (!receipt?.success || receipt.applied) return;
    const target = await foundry.utils.fromUuid(receipt.targetUuid);
    if (!target) throw new Error("The stabilization target no longer exists. Resolve this result manually.");
    return queuedAction(`stabilizeTarget:${target.uuid}`, () =>
      reversibleAction(async change => {
        const data = message.getFlag(SCOPE, "stabilize");
        if (!data?.success || data.applied || data.targetUuid !== target.uuid) return;
        requireDown(target);
        await retainStabilized(target, change);
        const saved = await message.setFlag(SCOPE, "stabilize", { ...data, applied: true });
        if (!saved || message.getFlag(SCOPE, "stabilize")?.applied !== true)
          throw new Error("The stabilization receipt was not retained. The target change was cancelled; retry or correct it manually.");
        return message;
      })
    );
  });
}

// Indomitable (VIT 21) lets the dying character stabilize themselves.
export async function selfStabilize(actor) {
  if (actor?.isOwner && dyingSummary(actor.system).down) await actor.update({ "system.dying.stabilized": true });
}

// With no healing available, 10 minutes of treatment after combat brings a stabilized character to 1 Health.
export async function treat(actor) {
  if (!actor?.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, async () => {
    if (!actor.isOwner || actor.type !== "character") return;
    const summary = dyingSummary(actor.system);
    if (!summary.down) throw new Error(`${actor.name} isn't at 0 Health or below.`);
    if (!summary.stabilized) throw new Error(`Stabilize ${actor.name} first.`);
    if (inCombat(actor)) throw new Error("Treatment takes 10 minutes after combat.");
    const saved = await actor.update({ "system.health.damage": actor.system.health.max - 1 });
    if (!saved) throw new Error("The Health update was cancelled; no treatment card was posted.");
    if (actor.system.health.value !== 1)
      throw new Error("Treatment did not restore 1 Health. Check Health on the sheet; no treatment card was posted.");
    try {
      return await createActionMessage({
        speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
        content: `<div class="worlds-beyond wb-ability-card wb-dying-card"><h3>Treatment</h3><p class="wb-result">After 10 minutes of treatment, ${escapeHTML(actor.name)} is back to 1 Health.</p></div>`,
        flags: { [SCOPE]: { sheetActivity: { actorUuid: actor.uuid, label: "Treatment" } } }
      });
    } catch (error) {
      // Healing runs native waking/Trauma hooks. A raw Health rollback would
      // not undo those consequences and could cause another knockout.
      throw new Error(`Treatment restored 1 Health, but its card was not posted. Check Health and Status on the sheet. ${error.message}`, {
        cause: error
      });
    }
  });
}

export function dyingContext(actor) {
  const summary = dyingSummary(actor.system);
  return {
    ...summary,
    show: summary.down || summary.trauma > 0,
    canTreat: summary.down && summary.stabilized && !inCombat(actor),
    automated: deathAutomated()
  };
}

function decorateBleedOut(message, html) {
  const data = message.getFlag?.(SCOPE, "bleedOut");
  const card = html.querySelector?.(".wb-dying-card");
  if (!data || !card || card.querySelector(".wb-condition-actions")) return;
  const target = foundry.utils.fromUuidSync(data.actorUuid);
  const row = document.createElement("div");
  row.className = "wb-condition-actions";
  const add = (label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async event => {
      event.preventDefault();
      button.disabled = true;
      try {
        await action();
      } catch (error) {
        ui.notifications.error(error.message);
        button.disabled = false;
      }
    });
    row.append(button);
  };
  if (target && dyingSummary(target.system).bleedingOut) add(`Stabilize (${STABILIZE_AP} AP)`, () => promptStabilize(target));
  if (game.user.isGM && !data.undone && data.amount > 0) add(`Undo ${wholeNumber(data.amount)}`, () => undoTurnDamage(message, "bleedOut"));
  if (row.childElementCount) card.append(row);
}
