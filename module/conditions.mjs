import { applyTurnHealthLoss, undoTurnDamage } from "./turn-damage.mjs";
// Status conditions in Foundry: Notion's statuses in the token HUD, Bleeding and Burning
// damage at the start of the creature's turn, and the actions that end them.
// Rules live in conditions-core.mjs.
import {
  CONDITIONS,
  condition,
  mergeStatusEffects,
  TICKS,
  tickFormula,
  endActionCost,
  SHAKE_IT_OFF_DC,
  shakeItOffSuccess
} from "./conditions-core.mjs";
import { newerRecoveryTurn } from "./recovery-core.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { inCombat, planApPayment, payAp } from "./combat-support.mjs";
import { immuneTo } from "./strike-core.mjs";
import { actorResistantTo, allowStatusApplication } from "./petrified.mjs";
import { requireActionCapacity } from "./condition-actions.mjs";
import { defaultCheckMode, actorConditionRoll, conditionRollText, conditionControls, bindConditionCheck } from "./condition-rolls.mjs";
import { checkMode } from "./rolls.mjs";
import { rollCard } from "./roll-actions.mjs";
import { removeConditionEffects } from "./condition-removal.mjs";
import { wholeNumber } from "./number-display.mjs";

const SCOPE = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function registerConditions() {
  // Called from the system's init hook.
  CONFIG.statusEffects = mergeStatusEffects(CONFIG.statusEffects ?? []);
  registerSettings();
  Hooks.on("combatTurnChange", (combat, previous, current) =>
    tickTurn(combat, previous, current).catch(error => ui.notifications.error(`Status damage: ${error.message}`))
  );
  // Native batch operations share options; keep each actor's healing snapshot separate.
  Hooks.on("preUpdateActor", prepareBleedingHealing);
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    endBleedingAfterHealing(actor, changes, options, userId).catch(error => ui.notifications.error(error.message));
  });
  Hooks.on("renderChatMessageHTML", decorateConditionCard);
}

function registerSettings() {
  game.settings.register(SCOPE, "automateConditions", {
    name: "Automate Bleeding and Burning",
    hint: "Bleeding and Burning deal their damage at the start of the creature's turn, weapons with Bleed start Bleeding on a damaging hit, and healing ends Bleeding. Off: track them by hand.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

export const conditionsAutomated = () => {
  try {
    return game.settings.get(SCOPE, "automateConditions") !== false;
  } catch {
    return true;
  }
};

function prepareBleedingHealing(actor, changes, options) {
  const previous = options.worldsBeyondBleedingHealing ?? [];
  options.worldsBeyondBleedingHealing = previous.filter(entry => entry.actorUuid !== actor.uuid);
  if (actor.type !== "character" || options.worldsBeyondCorrection || !conditionsAutomated()) return;
  const next = foundry.utils.getProperty(changes, "system.health.damage");
  const health = actor.system?.health;
  if (next == null || !Number.isFinite(Number(next)) || !(Number(next) < health?.damage) || !Number.isFinite(health?.value)) return;
  const effectIds = conditionEffects(actor, "bleeding").map(effect => effect.id);
  if (effectIds.length)
    options.worldsBeyondBleedingHealing.push({ actorUuid: actor.uuid, health: health.value, damage: health.damage, effectIds });
}

async function endBleedingAfterHealing(actor, changes, options, userId) {
  if (userId !== game.user.id || actor.type !== "character" || options.worldsBeyondCorrection || !conditionsAutomated()) return;
  if (foundry.utils.getProperty(changes, "system.health.damage") == null) return;
  const before = options.worldsBeyondBleedingHealing?.find(entry => entry.actorUuid === actor.uuid);
  if (!before || !(actor.system.health.value > before.health) || !(actor.system.health.damage < before.damage)) return;
  const effectIds = [...before.effectIds];
  return queuedAction(actor.uuid, () => {
    if (!conditionsAutomated()) return;
    return removeCondition(actor, "bleeding", { effectIds });
  });
}

export const conditionEffects = (actor, id) =>
  Array.from(actor.effects ?? []).filter(
    effect => effect.statuses?.has(id) && !effect.disabled && !effect.isSuppressed && !effect.duration?.expired && effect.active !== false
  );

// Start a condition. `sourceLevel` is the level of the creature that caused it (Bleeding and
// Burning scale with it). Bleeding doesn't stack, so an existing one is left alone.
export async function applyCondition(actor, id, { sourceLevel = null, sourceName = "" } = {}) {
  if (!actor || !condition(id) || actor.statuses?.has(id)) return null;
  if (!allowStatusApplication(actor, [id])) return null;
  const effect = await foundry.documents.ActiveEffect.implementation.fromStatusEffect(id);
  const data = effect.toObject();
  foundry.utils.setProperty(data, `flags.${SCOPE}.condition`, {
    sourceLevel: sourceLevel ?? null,
    sourceName: sourceName || ""
  });
  return foundry.documents.ActiveEffect.implementation.create(data, { parent: actor, keepId: true });
}

export async function removeCondition(actor, id, { effectIds = null } = {}) {
  const effects = conditionEffects(actor, id).filter(effect => !effectIds || effectIds.includes(effect.id));
  // One ActiveEffect can carry several conditions. Waking or healing must not
  // delete unrelated Poisoned/Blinded/etc. from that same source.
  for (const effect of effects.filter(effect => effect.statuses.size > 1)) {
    await effect.update({ statuses: [...effect.statuses].filter(status => status !== id) });
    if (effect.statuses.has(id)) throw new Error(`Could not end ${id}; correct it on Status.`);
  }
  const ids = effects.filter(effect => effect.statuses.size === 1 && effect.statuses.has(id)).map(effect => effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  if (ids.some(id => actor.effects?.get?.(id))) throw new Error(`Could not end ${id}; correct it on Status.`);
}

// The level used for a tick: the causing creature's, else the affected creature's own.
export function sourceOf(actor, id) {
  const effect = conditionEffects(actor, id)[0];
  const flag = effect?.flags?.[SCOPE]?.condition ?? {};
  const level = Number(flag.sourceLevel);
  return Number.isFinite(level) && level >= 1
    ? { level, name: flag.sourceName || "", known: true }
    : { level: Number(actor.system?.level) || 1, name: "", known: false };
}

/* -------------------------------------------- */
/*  Start of turn                               */
/* -------------------------------------------- */

async function tickTurn(combat, previous, current) {
  if (!game.user.isActiveGM || !conditionsAutomated() || !combat.started || current?.round < 1) return;
  if (previous && !newerRecoveryTurn(previous, current)) return;
  const actor = combat.combatant?.actor;
  if (actor?.type !== "character") return;
  for (const id of Object.keys(TICKS)) if (actor.statuses?.has(id)) await tick(actor, id, combat);
}

export async function tick(actor, id, combat) {
  return queuedAction(actor.uuid, async () => {
    const info = TICKS[id];
    const source = sourceOf(actor, id);
    const formula = tickFormula(id, source.level);
    const roll = await new foundry.dice.Roll(formula).evaluate();
    const rolled = Math.max(0, Math.floor(roll.total));
    const immune = info.damageType && immuneTo(actor.system.immunities, info.damageType);
    const resistant = !immune && actorResistantTo(actor, info.damageType);
    const requested = immune ? 0 : resistant ? Math.floor(rolled / 2) : rolled;
    const amount = await applyTurnHealthLoss(actor, requested);
    const applied = amount > 0;
    const notes = [
      `${formula} for a level ${wholeNumber(source.level)} source${source.name ? ` (${escapeHTML(source.name)})` : source.known ? "" : " (its own level; none was recorded)"}.`,
      "Armor Rating doesn't reduce it.",
      amount !== requested ? `Health loss adjusted from ${wholeNumber(requested)} to ${wholeNumber(amount)}.` : "",
      immune
        ? `Immune to ${info.damageType}.`
        : resistant
          ? `${info.damageType ? `Resistant to ${info.damageType}` : "Resistant to this damage"}: halved.`
          : ""
    ].filter(Boolean);
    const content =
      `<div class="worlds-beyond wb-attack-card wb-condition-card"><h3>${escapeHTML(info.label)}</h3>` +
      `<p class="wb-result">${escapeHTML(actor.name)} takes ${wholeNumber(amount)}${info.damageType ? ` ${info.damageType.toLowerCase()}` : ""} damage.</p>` +
      notes.map(line => `<p>${line}</p>`).join("") +
      (await roll.render()) +
      "</div>";
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content,
      rolls: [roll],
      flags: {
        [SCOPE]: { conditionTick: { actorUuid: actor.uuid, id, amount, rolled, requested, applied, undone: false, combatId: combat.id } }
      }
    });
  });
}

/* -------------------------------------------- */
/*  Ending Bleeding and Burning                 */
/* -------------------------------------------- */

// Bleeding: Shake It Off rolls d20 + VIT modifier against DC 12. Burning: put out the flames.
// Both cost AP in combat, like every action.
export async function resolveBleedingCheck(actor, context, roll, change) {
  const attempt = context.endBleeding;
  if (!attempt || context.actorUuid !== actor.uuid || !shakeItOffSuccess(roll?.total, context.success)) return 0;
  const effects = conditionEffects(actor, "bleeding").filter(effect => attempt.effectIds.includes(effect.id));
  return change
    ? removeConditionEffects(actor, effects, "bleeding", change)
    : reversibleAction(tx => removeConditionEffects(actor, effects, "bleeding", tx));
}

export async function promptEndConditionAction(actor, id) {
  if (!actor?.isOwner || actor.type !== "character" || !actor.statuses?.has(id)) return;
  if (id !== "bleeding") return endConditionAction(actor, id);
  const mode = defaultCheckMode(actor, "check");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SCOPE, "wb-roll-dialog"],
    position: { width: 380 },
    window: { title: "Shake It Off" },
    ok: { label: "Try recovery" },
    rejectClose: false,
    content: await foundry.applications.handlebars.renderTemplate(`systems/${SCOPE}/templates/shake-it-off-dialog.hbs`, {
      cost: inCombat(actor) ? endActionCost(id, actor.system.stats?.vit?.mod ?? 0) : 0,
      dc: SHAKE_IT_OFF_DC,
      conditions: conditionControls(actor),
      conditionText: conditionRollText(actorConditionRoll(actor, "check")),
      normal: mode === "normal",
      advantage: mode === "advantage",
      disadvantage: mode === "disadvantage"
    }),
    render: (event, dialog) => bindConditionCheck(dialog, actor, "vit")
  });
  return choices ? endConditionAction(actor, id, choices) : null;
}

export async function endConditionAction(actor, id, { mode, fearInSight } = {}) {
  if (!actor?.isOwner || actor.type !== "character" || !TICKS[id]) return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!actor.statuses?.has(id)) throw new Error(`${actor.name} isn't ${TICKS[id].label} any more.`);
      const effects = conditionEffects(actor, id);
      if (!effects.length) throw new Error("End this condition at its source or correct it manually on Status.");
      const cost = endActionCost(id, actor.system.stats?.vit?.mod ?? 0);
      requireActionCapacity(actor, { ap: cost });
      const ap = inCombat(actor) ? cost : 0;
      if (ap) planApPayment(actor, ap);
      const messageMode = game.settings.get("core", "messageMode");
      let roll = null,
        context = null,
        content;
      if (id === "bleeding") {
        mode ??= defaultCheckMode(actor, "check", { fearInSight });
        roll = await new foundry.dice.Roll(checkMode(mode).formula, { mod: actor.system.stats.vit.mod }).evaluate({
          allowInteractive: messageMode !== "blind"
        });
        context = {
          kind: "check",
          label: "Shake It Off",
          actorUuid: actor.uuid,
          mode,
          conditionText: conditionRollText(actorConditionRoll(actor, "check", { fearInSight })),
          endBleeding: { dc: SHAKE_IT_OFF_DC, effectIds: effects.map(effect => effect.id), ap }
        };
        content = await rollCard(roll, context);
      } else {
        content = `<div class="worlds-beyond wb-ability-card wb-condition-card"><h3>Put out the flames</h3><p class="wb-result">The flames are out.</p><p class="wb-dialog-meta">${ap ? `${wholeNumber(ap)} AP spent` : "Outside combat"}</p></div>`;
      }
      requireActionCapacity(actor, { ap: cost });
      // Do not pay for an old roll if healing/another client already ended it.
      if (!conditionEffects(actor, id).some(effect => effects.includes(effect)))
        throw new Error("The condition changed while rolling. Nothing was spent; try again if needed.");
      if (ap) await payAp(actor, ap, change);
      if (context) await resolveBleedingCheck(actor, context, roll, change);
      else await removeConditionEffects(actor, effects, id, change);
      return createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content,
          rolls: roll ? [roll] : [],
          flags: {
            [SCOPE]: {
              ...(context ? { check: context } : {}),
              sheetActivity: { actorUuid: actor.uuid, label: id === "bleeding" ? "Shake It Off" : "Put out the flames" }
            }
          }
        },
        { messageMode }
      );
    })
  );
}

export const endActionLabel = id => (id === "bleeding" ? "Shake it off" : id === "burning" ? "Put out" : "");

/* -------------------------------------------- */
/*  Tick cards                                  */
/* -------------------------------------------- */

function decorateConditionCard(message, html) {
  const data = message.getFlag?.(SCOPE, "conditionTick");
  const card = html.querySelector?.(".wb-condition-card");
  if (!data || !card || card.querySelector(".wb-condition-actions")) return;
  const actor = foundry.utils.fromUuidSync(data.actorUuid);
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
  if (actor?.isOwner && actor.statuses?.has(data.id)) {
    const cost = endActionCost(data.id, actor.system.stats?.vit?.mod ?? 0);
    add(`${endActionLabel(data.id)} (${cost} AP)`, () => promptEndConditionAction(actor, data.id));
  }
  if (game.user.isGM && data.applied && !data.undone && data.amount > 0)
    add(`Undo ${wholeNumber(data.amount)} damage`, () => undoTurnDamage(message, "conditionTick", { floor: 0 }));
  if (row.childElementCount) card.append(row);
}

export { CONDITIONS };
