import { blockDice } from "./equipment-core.mjs";
import { inCombat } from "./attack-actions.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { checkMode } from "./rolls.mjs";
import { dodgeContext } from "./defenses.mjs";
import { rollCard } from "./roll-actions.mjs";

const SYSTEM_ID = "worlds-beyond";
const template = (name, data) => foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/${name}.hbs`, data);

export function decorateReactionMessage(message, html) {
  if (!message.isContentVisible || message.getFlag?.(SYSTEM_ID, "reaction")?.kind !== "block") return;
  html.classList.add(SYSTEM_ID, "wb-chat-message");
}

export async function promptBlock(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const dice = blockDice({ level: actor.system.level, items: actor.items });
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: "Block" }, ok: { label: "Roll Block" }, rejectClose: false,
    content: await template("block-dialog", {
      formula: `${dice.formula} + @mod`, modifier: actor.system.stats.str.mod,
      reactions: actor.system.reactions.value, spendReaction: inCombat(actor)
    })
  });
  if (!choices) return;
  return rollBlock(actor, choices);
}

export async function rollBlock(actor, { formula, spendReaction = false } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    if (spendReaction && !(actor.system.reactions.value >= 1)) {
      throw new Error("No reactions left. Correct the pool or untick Spend 1 reaction to roll without spending.");
    }
    const dice = blockDice({ level: actor.system.level, items: actor.items });
    const expression = String(formula ?? `${dice.formula} + @mod`).trim();
    if (!expression || !foundry.dice.Roll.validate(expression)) throw new Error("Enter a valid Block formula, such as 2d10 + @mod.");
    const modifier = actor.system.stats.str.mod;
    const roll = await new foundry.dice.Roll(expression, { mod: modifier }).evaluate({ allowInteractive: messageMode !== "blind" });
    const content = await template("block-card", {
      spent: !!spendReaction, rollHTML: await roll.render()
    });
    if (spendReaction) await change(
      () => actor.update({ "system.reactions.value": actor.system.reactions.value - 1 }),
      () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1 })
    );
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content, rolls: [roll], flags: { [SYSTEM_ID]: { reaction: { kind: "block", actorUuid: actor.uuid, spent: !!spendReaction } } }
    }, { messageMode });
  }));
}

export async function promptDodge(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: "Dodge" }, ok: { label: "Roll Dodge" }, rejectClose: false,
    content: await template("dodge-dialog", {
      modifier: actor.system.stats.agl.mod, heavyArmor: !!actor.system.equipment?.heavyDisadvantage,
      reactions: actor.system.reactions.value, spendReaction: inCombat(actor)
    })
  });
  if (!choices) return;
  return rollDodge(actor, choices);
}

export async function rollDodge(actor, { against = "attack", target = null, natural20 = false, mode, spendReaction = false } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const defense = dodgeContext({ against, target, natural20 });
    const heavyArmor = !!actor.system.equipment?.heavyDisadvantage;
    mode ??= heavyArmor ? "disadvantage" : "normal";
    const plan = checkMode(mode);
    if (spendReaction && !(actor.system.reactions.value >= 1)) {
      throw new Error("No reactions left. Correct the pool or untick Spend 1 reaction to roll without spending.");
    }
    const roll = await new foundry.dice.Roll(plan.formula, { mod: actor.system.stats.agl.mod }).evaluate({ allowInteractive: messageMode !== "blind" });
    const context = {
      kind: defense.area ? "save" : "check", label: defense.area ? "Dodge · area save" : "Dodge", mode, actorUuid: actor.uuid,
      defense: { ...defense, spent: !!spendReaction, heavyArmor }
    };
    const content = await rollCard(roll, context);
    if (spendReaction) await change(
      () => actor.update({ "system.reactions.value": actor.system.reactions.value - 1 }),
      () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1 })
    );
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }), content, rolls: [roll],
      flags: { [SYSTEM_ID]: { check: context } }
    }, { messageMode });
  }));
}
