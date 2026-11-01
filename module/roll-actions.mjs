import { STATS } from "./stats.mjs";
import { checkMode, wonderAction, describeD20Roll } from "./rolls.mjs";
import { dodgeOutcome, parryOutcome } from "./defenses.mjs";
import { fitDialogDisclosures } from "./dialog-layout.mjs";

const SYSTEM_ID = "worlds-beyond";
const actorOperations = new Map();
const renderTemplate = (name, context) => foundry.applications.handlebars.renderTemplate(
  `systems/${SYSTEM_ID}/templates/${name}.hbs`, context
);

export async function promptStatCheck(actor, statKey) {
  const stat = STATS.find(stat => stat.key === statKey);
  if (!stat) return;
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"],
    position: { width: 360 },
    window: { title: `${stat.label} roll` },
    content: await renderTemplate("check-dialog", { label: stat.label, heavyArmor: statKey === "agl" && !!actor.system.equipment?.heavyDisadvantage }),
    ok: { label: "Roll" },
    render: (event, dialog) => fitDialogDisclosures(dialog),
    rejectClose: false
  });
  if (!choices) return;
  return rollStatCheck(actor, statKey, choices);
}

export async function rollStatCheck(actor, statKey, { kind = "check", mode = "normal" } = {}) {
  const stat = STATS.find(stat => stat.key === statKey);
  if (!stat || !["check", "save"].includes(kind)) throw new Error("Choose a stat check or saving throw.");
  const plan = checkMode(mode);
  const label = `${stat.label} ${kind === "save" ? "saving throw" : "check"}`;
  const messageMode = game.settings.get("core", "messageMode");
  const roll = new foundry.dice.Roll(plan.formula, { mod: actor.system.stats[statKey].mod });
  await roll.evaluate({ allowInteractive: messageMode !== "blind" });
  const context = { kind, label, mode, actorUuid: actor.uuid };
  const content = await rollCard(roll, context);
  return roll.toMessage({
    speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
    content,
    flags: { [SYSTEM_ID]: { check: context } }
  }, { messageMode });
}

export async function rollCard(roll, context, { note = "", success = false } = {}) {
  const defense = context.defense?.type === "dodge" ? {
    ...context.defense, ...dodgeOutcome(context.defense, roll.total, success),
    hasTarget: context.defense.target !== null, reroll: !!context.previousMessageId,
    overriddenDisadvantage: context.defense.heavyArmor && context.mode !== "disadvantage"
  } : context.defense?.type === "parry" ? {
    ...context.defense, ...parryOutcome(context.defense, roll.total, success),
    parry: true, hasTarget: context.defense.target !== null, reroll: !!context.previousMessageId
  } : null;
  return renderTemplate("roll-card", {
    label: context.label,
    modeLabel: context.mode ? checkMode(context.mode).label : "Initiative",
    note, success, defense,
    rollHTML: await roll.render()
  });
}

export function rollContext(message) {
  return message.getFlag(SYSTEM_ID, "check") ?? message.rolls?.[0]?.options?.[SYSTEM_ID];
}

function speakerActor(message) {
  // Resolves the scene token first, including unlinked/synthetic actors.
  return foundry.documents.ChatMessage.implementation.getSpeakerActor(message.speaker);
}

function wonderUsed(actor, message) {
  if (actor.getFlag(SYSTEM_ID, "wonderUsed")?.[message.id]) return true;
  // Also recognize rerolls posted before per-result tracking was added.
  return game.messages.contents.some(candidate => {
    const context = rollContext(candidate);
    return context?.actorUuid === actor.uuid && context.previousMessageId === message.id;
  });
}

function requireWonder(actor, message) {
  if (wonderUsed(actor, message)) throw new Error("Wonder was already used on this result. Use its new result instead.");
  if (!(actor.system.wonder.value >= 1)) throw new Error("No Wonder uses left. Take a long rest or correct the pool on your sheet.");
}

// Serialize local clicks for the same actor so rapid use/refill actions cannot lose a spend.
function actorOperation(actor, operation) {
  const previous = actorOperations.get(actor.uuid) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  actorOperations.set(actor.uuid, current);
  return current.finally(() => {
    if (actorOperations.get(actor.uuid) === current) actorOperations.delete(actor.uuid);
  });
}

export async function longRest(actor) {
  if (!actor.isOwner) return;
  return actorOperation(actor, () => actor.update({
    "system.health.damage": 0,
    "system.ap.value": null,
    "system.reactions.value": null,
    "system.wonder.value": null
  }));
}

export async function useWonder(message) {
  const actor = speakerActor(message);
  if (!message.isContentVisible || !actor?.isOwner || actor.type !== "character") return;
  return actorOperation(actor, async () => {
    const context = rollContext(message);
    const original = message.rolls?.[0];
    if (!context || context.actorUuid !== actor.uuid || context.success || !original?.dice.some(die => die.faces === 20)) return;
    const action = wonderAction(context.kind, actor.system.stats.fth.value);
    if (!action) return;
    requireWonder(actor, message);

    // Clone the original evaluated formula/data, not today's stat modifier or roll mode.
    const success = action === "success";
    const roll = success ? original : original.clone();
    if (!success) await roll.evaluate({ allowInteractive: !message.blind });
    const nextContext = { ...context, success, previousMessageId: message.id };
    const note = success
      ? "Defy Fate · 1 Wonder spent."
      : `Wonder · previous total ${original.total} · 1 use spent.`;
    const content = await rollCard(roll, nextContext, { note, success });
    // Prepare the dice and content before spending; no pool changes on a failed roll/render.
    requireWonder(actor, message);
    // Actor flags work even when this player's initiative message was posted by the GM.
    // Persist the consumed result and the spend together, before allowing another local click.
    const saved = await actor.update({
      "system.wonder.value": actor.system.wonder.value - 1,
      [`flags.${SYSTEM_ID}.wonderUsed.${message.id}`]: true
    });
    if (!saved) throw new Error("Wonder was not spent; no result was posted.");
    let result;
    try {
      // Copy the exact audience. Calling toMessage here could use a different current chat mode.
      result = await foundry.documents.ChatMessage.implementation.create({
        author: game.user.id, speaker: message.speaker,
        whisper: [...message.whisper], blind: message.blind,
        rolls: [roll], content,
        flags: { [SYSTEM_ID]: { check: nextContext } }
      });
      if (!result) throw new Error("The Wonder result was not posted.");
    } catch (error) {
      // Keep manual changes made in the meantime; refund only this use.
      const refunded = await actor.update({
        "system.wonder.value": actor.system.wonder.value + 1,
        [`flags.${SYSTEM_ID}.wonderUsed.-=${message.id}`]: null
      }).catch(() => null);
      if (!refunded) throw new Error("The result was not posted. Restore 1 Wonder use on the sheet and make a new roll; this result is still marked used.", { cause: error });
      throw error;
    }

    if (context.kind === "initiative") {
      const combat = game.combats.get(context.combatId);
      const combatant = combat?.combatants.get(context.combatantId);
      if (combatant?.actor?.uuid === actor.uuid) {
        try { await combat.setInitiative(combatant.id, roll.total); }
        catch { ui.notifications.warn(`Wonder rolled ${roll.total}. Update initiative in the combat tracker manually.`); }
      } else ui.notifications.warn(`Wonder rolled ${roll.total}. The original combatant no longer exists; apply it manually if needed.`);
    }
    return result;
  });
}

export function decorateRollMessage(message, html) {
  const context = rollContext(message);
  if (!context || !message.isContentVisible) return;
  const original = message.rolls?.[0];
  if (!original?.dice.some(die => die.faces === 20)) return;
  html.classList.add(SYSTEM_ID, "wb-chat-message");
  const breakdown = describeD20Roll(original, context.mode);
  const formula = html.querySelector(".dice-formula");
  if (breakdown && formula) {
    formula.textContent = breakdown.equation;
    let details = html.querySelector(".wb-dice-results");
    if (!details) {
      details = document.createElement("p");
      details.className = "wb-dice-results";
      formula.after(details);
    }
    details.textContent = breakdown.diceText;
    for (const label of html.querySelectorAll(".dice-tooltip .part-formula")) label.textContent = breakdown.diceLabel;
  }
  const actor = speakerActor(message);
  if (!actor?.isOwner || actor.type !== "character" || actor.uuid !== context.actorUuid || context.success
    || !wonderAction(context.kind, actor.system.stats.fth.value)) return;
  const content = html.querySelector(".message-content");
  if (!content || content.querySelector(".wb-wonder-action")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wb-wonder-action";
  button.dataset.messageId = message.id;
  button.title = "Spend 1 Wonder use. At FTH 21, declare a failed check/save successful; initiative still rerolls. Uses can be corrected on the sheet.";
  button.addEventListener("click", async () => {
    button.dataset.busy = "true";
    button.disabled = true;
    try { await useWonder(message); }
    catch (error) { ui.notifications.error(error.message); }
    finally {
      delete button.dataset.busy;
      refreshWonderControls();
    }
  });
  updateWonderButton(button, message);
  content.append(button);
}

function updateWonderButton(button, message) {
  const actor = speakerActor(message);
  const visible = message.isContentVisible && actor?.isOwner;
  button.hidden = !visible;
  if (!visible) return;
  const used = wonderUsed(actor, message);
  const empty = !(actor.system.wonder.value >= 1);
  button.disabled = used || empty || button.dataset.busy === "true";
  button.textContent = used ? "Wonder used" : empty ? "No Wonder uses left" : "Use Wonder";
}

// Refresh every mounted copy (chat, notifications and popouts) after spending/refilling.
export function refreshWonderControls() {
  for (const button of document.querySelectorAll(".wb-wonder-action[data-message-id]")) {
    const message = game.messages.get(button.dataset.messageId);
    if (message) updateWonderButton(button, message);
  }
}
