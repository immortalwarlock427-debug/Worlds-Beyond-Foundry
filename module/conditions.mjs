// Status conditions in Foundry: Notion's statuses in the token HUD, Bleeding and Burning
// damage at the start of the creature's turn, and the actions that end them.
// Rules live in conditions-core.mjs.
import { CONDITIONS, condition, mergeStatusEffects, TICKS, tickFormula, endActionCost, SHAKE_IT_OFF_DC } from "./conditions-core.mjs";
import { newerRecoveryTurn } from "./recovery-core.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { inCombat, planApPayment, payAp } from "./combat-support.mjs";
import { resistantTo, immuneTo, damagedHealth } from "./strike-core.mjs";
import { formatModifier } from "./stats.mjs";
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
  // Any healing ends Bleeding. The client that heals removes it, since it owns the actor.
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    const next = foundry.utils.getProperty(changes, "system.health.damage");
    if (next == null || options.worldsBeyondCorrection) return;
    if (Number(next) < Number(actor.system?.health?.damage ?? 0)) options.worldsBeyondHealed = true;
  });
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || !options.worldsBeyondHealed || !actor.statuses?.has("bleeding")) return;
    removeCondition(actor, "bleeding").catch(error => ui.notifications.error(error.message));
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

const conditionEffects = (actor, id) => Array.from(actor.effects ?? []).filter(effect => effect.statuses?.has(id) && !effect.disabled);

// Start a condition. `sourceLevel` is the level of the creature that caused it (Bleeding and
// Burning scale with it). Bleeding doesn't stack, so an existing one is left alone.
export async function applyCondition(actor, id, { sourceLevel = null, sourceName = "" } = {}) {
  if (!actor || !condition(id) || actor.statuses?.has(id)) return null;
  const effect = await foundry.documents.ActiveEffect.implementation.fromStatusEffect(id);
  const data = effect.toObject();
  foundry.utils.setProperty(data, `flags.${SCOPE}.condition`, {
    sourceLevel: sourceLevel ?? null,
    sourceName: sourceName || ""
  });
  return foundry.documents.ActiveEffect.implementation.create(data, { parent: actor, keepId: true });
}

export async function removeCondition(actor, id) {
  const ids = conditionEffects(actor, id).map(effect => effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
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
  const info = TICKS[id];
  const source = sourceOf(actor, id);
  const formula = tickFormula(id, source.level);
  const roll = await new foundry.dice.Roll(formula).evaluate();
  const rolled = Math.max(0, Math.floor(roll.total));
  const immune = info.damageType && immuneTo(actor.system.immunities, info.damageType);
  const resistant = !immune && info.damageType && resistantTo(actor.system.resistances, info.damageType);
  const amount = immune ? 0 : resistant ? Math.floor(rolled / 2) : rolled;
  const previous = actor.system.health.damage;
  let applied = false;
  if (amount > 0)
    applied = !!(await actor.update({ "system.health.damage": damagedHealth(previous, amount) }, { worldsBeyondDamage: true }));
  const notes = [
    `${formula} for a level ${wholeNumber(source.level)} source${source.name ? ` (${escapeHTML(source.name)})` : source.known ? "" : " (its own level; none was recorded)"}.`,
    "Armor Rating doesn't reduce it.",
    immune ? `Immune to ${info.damageType}.` : resistant ? `Resistant to ${info.damageType}: halved.` : ""
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
    flags: { [SCOPE]: { conditionTick: { actorUuid: actor.uuid, id, amount, applied, undone: false, combatId: combat.id } } }
  });
}

/* -------------------------------------------- */
/*  Ending Bleeding and Burning                 */
/* -------------------------------------------- */

// Bleeding: Shake It Off rolls d20 + VIT modifier against DC 12. Burning: put out the flames.
// Both cost AP in combat, like every action.
export async function endConditionAction(actor, id) {
  if (!actor?.isOwner || !TICKS[id]) return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!actor.statuses?.has(id)) throw new Error(`${actor.name} isn't ${TICKS[id].label} any more.`);
      const vit = actor.system.stats?.vit?.mod ?? 0;
      const ap = inCombat(actor) ? endActionCost(id, vit) : 0;
      if (ap) planApPayment(actor, ap);
      const messageMode = game.settings.get("core", "messageMode");
      let roll = null,
        success = true;
      if (id === "bleeding") {
        roll = await new foundry.dice.Roll("1d20 + @mod", { mod: vit }).evaluate({ allowInteractive: messageMode !== "blind" });
        success = roll.total >= SHAKE_IT_OFF_DC;
      }
      if (ap) await payAp(actor, ap, change);
      if (success) await removeCondition(actor, id);
      const title = id === "bleeding" ? "Shake It Off" : "Put out the flames";
      const result =
        id === "bleeding"
          ? success
            ? "Success: the bleeding stops."
            : "Failure: still Bleeding."
          : "The flames are out.";
      return createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content:
            `<div class="worlds-beyond wb-ability-card wb-condition-card"><h3>${title}</h3>` +
            `<p class="wb-dialog-meta">${id === "bleeding" ? `d20 ${formatModifier(vit)} vs DC ${SHAKE_IT_OFF_DC}` : "Burning"}${ap ? ` · ${wholeNumber(ap)} AP spent` : ""}</p>` +
            (roll ? await roll.render() : "") +
            `<p class="wb-result">${result}</p></div>`,
          rolls: roll ? [roll] : [],
          flags: { [SCOPE]: { sheetActivity: { actorUuid: actor.uuid, label: title } } }
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

async function undoTick(message) {
  if (!game.user.isGM) return;
  return queuedAction(`conditionTick:${message.id}`, async () => {
    const data = message.getFlag(SCOPE, "conditionTick");
    if (!data?.applied || data.undone) return;
    const actor = await foundry.utils.fromUuid(data.actorUuid);
    if (!actor) throw new Error("That character no longer exists. Correct Health on its sheet.");
    await actor.update(
      { "system.health.damage": Math.max(0, actor.system.health.damage - data.amount) },
      { worldsBeyondCorrection: true }
    );
    await message.setFlag(SCOPE, "conditionTick", { ...data, undone: true });
  });
}

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
    add(`${endActionLabel(data.id)} (${cost} AP)`, () => endConditionAction(actor, data.id));
  }
  if (game.user.isGM && data.applied && !data.undone && data.amount > 0) add(`Undo ${wholeNumber(data.amount)} damage`, () => undoTick(message));
  if (row.childElementCount) card.append(row);
}

export { CONDITIONS };
