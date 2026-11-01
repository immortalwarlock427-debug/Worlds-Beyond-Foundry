import { blockDice } from "./equipment-core.mjs";
import { inCombat } from "./attack-actions.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { checkMode } from "./rolls.mjs";
import { dodgeContext, parryContext, parryReadiness } from "./defenses.mjs";
import { rollCard } from "./roll-actions.mjs";
import { fitDialogDisclosures } from "./dialog-layout.mjs";
import { linkedDefense, requireUnusedDefense, markLinkedDefense, linkedResetButtons } from "./attack-defense.mjs";

const SYSTEM_ID = "worlds-beyond";
const template = (name, data) => foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/${name}.hbs`, data);

export function decorateReactionMessage(message, html) {
  if (!message.isContentVisible || message.getFlag?.(SYSTEM_ID, "reaction")?.kind !== "block") return;
  html.classList.add(SYSTEM_ID, "wb-chat-message");
}

export async function promptBlock(actor, source) {
  if (!actor.isOwner || actor.type !== "character") return;
  const dice = blockDice({ level: actor.system.level, items: actor.items });
  const link = linkedDefense(actor, source, "block");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: "Block" }, ok: { label: "Roll Block" }, rejectClose: false,
    render: (event, dialog) => fitDialogDisclosures(dialog),
    buttons: linkedResetButtons(actor, source, "block"),
    content: await template("block-dialog", {
      formula: `${dice.formula} + @mod`, modifier: actor.system.stats.str.mod,
      reactions: actor.system.reactions.value, spendReaction: inCombat(actor) && !link?.used,
      ...(link ? { incoming: link.incoming, linkedUsed: link.used, ally: !!link.incoming.targetActorUuid && link.incoming.targetActorUuid !== actor.uuid } : {})
    })
  });
  if (!choices) return;
  return rollBlock(actor, { ...choices, source });
}

export async function rollBlock(actor, { formula, spendReaction = false, source, ally = false } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const link = linkedDefense(actor, source, "block");
    requireUnusedDefense(link, "block", spendReaction);
    if (spendReaction && !(actor.system.reactions.value >= 1)) {
      throw new Error("No reactions left. Correct the pool or untick Spend 1 reaction to roll without spending.");
    }
    const dice = blockDice({ level: actor.system.level, items: actor.items });
    const expression = String(formula ?? `${dice.formula} + @mod`).trim();
    if (!expression || !foundry.dice.Roll.validate(expression)) throw new Error("Enter a valid Block formula, such as 2d10 + @mod.");
    const modifier = actor.system.stats.str.mod;
    const roll = await new foundry.dice.Roll(expression, { mod: modifier }).evaluate({ allowInteractive: link ? !link.audience.blind : messageMode !== "blind" });
    const content = await template("block-card", {
      spent: !!spendReaction, rollHTML: await roll.render(), ...(link ? { incoming: link.incoming, ally: !!ally } : {})
    });
    if (spendReaction) await change(
      () => actor.update({ "system.reactions.value": actor.system.reactions.value - 1 }),
      () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1 })
    );
    if (spendReaction) await markLinkedDefense(actor, link, "block", change);
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content, rolls: [roll], ...(link?.audience ?? {}),
      flags: { [SYSTEM_ID]: { reaction: { kind: "block", actorUuid: actor.uuid, spent: !!spendReaction,
        ...(link ? { incoming: { ...link.incoming, source: link.source }, ally: !!ally } : {}) } } }
    }, link ? undefined : { messageMode });
  }));
}

export async function promptDodge(actor, source) {
  if (!actor.isOwner || actor.type !== "character") return;
  const link = linkedDefense(actor, source, "dodge");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: "Dodge" }, ok: { label: "Roll Dodge" }, rejectClose: false,
    render: (event, dialog) => fitDialogDisclosures(dialog),
    buttons: linkedResetButtons(actor, source, "dodge"),
    content: await template("dodge-dialog", {
      modifier: actor.system.stats.agl.mod, heavyArmor: !!actor.system.equipment?.heavyDisadvantage,
      reactions: actor.system.reactions.value, spendReaction: inCombat(actor) && !link?.used,
      ...(link ? { incoming: link.incoming, linkedUsed: link.used } : {})
    })
  });
  if (!choices) return;
  return rollDodge(actor, { ...choices, source });
}

export async function rollDodge(actor, { against = "attack", target = null, natural20 = false, mode, spendReaction = false, source } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const link = linkedDefense(actor, source, "dodge");
    requireUnusedDefense(link, "dodge", spendReaction);
    const defense = dodgeContext({ against, target, natural20 });
    const heavyArmor = !!actor.system.equipment?.heavyDisadvantage;
    mode ??= heavyArmor ? "disadvantage" : "normal";
    const plan = checkMode(mode);
    if (spendReaction && !(actor.system.reactions.value >= 1)) {
      throw new Error("No reactions left. Correct the pool or untick Spend 1 reaction to roll without spending.");
    }
    const roll = await new foundry.dice.Roll(plan.formula, { mod: actor.system.stats.agl.mod }).evaluate({ allowInteractive: link ? !link.audience.blind : messageMode !== "blind" });
    const context = {
      kind: defense.area ? "save" : "check", label: defense.area ? "Dodge · area save" : "Dodge", mode, actorUuid: actor.uuid,
      defense: { ...defense, spent: !!spendReaction, heavyArmor,
        ...(link ? { incoming: { ...link.incoming, source: link.source } } : {}) }
    };
    const content = await rollCard(roll, context);
    if (spendReaction) await change(
      () => actor.update({ "system.reactions.value": actor.system.reactions.value - 1 }),
      () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1 })
    );
    if (spendReaction) await markLinkedDefense(actor, link, "dodge", change);
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }), content, rolls: [roll],
      flags: { [SYSTEM_ID]: { check: context } }, ...(link?.audience ?? {})
    }, link ? undefined : { messageMode });
  }));
}

// Prefer the viewed combat when an actor belongs to more than one encounter.
function parryCombat(actor) {
  const contains = combat => combat?.started && Number.isFinite(combat.round)
    && combat.combatants.some(combatant => combatant.actor?.uuid === actor.uuid);
  if (contains(globalThis.game?.combat)) return game.combat;
  return Array.from(globalThis.game?.combats?.values?.() ?? []).find(contains) ?? null;
}

export function parryState(actor) {
  const combat = parryCombat(actor);
  return {
    ...parryReadiness({ dexterity: actor.system.stats.dex?.effective ?? actor.system.stats.dex?.value, items: actor.items ?? [] }),
    combatId: combat?.id ?? null, round: combat?.round ?? null,
    used: !!combat && actor.getFlag?.(SYSTEM_ID, "parryUses")?.[combat.id] === combat.round
  };
}

export async function resetParryUse(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, async () => {
    const state = parryState(actor);
    if (!state.used) return;
    const result = await actor.update({ [`flags.${SYSTEM_ID}.parryUses.-=${state.combatId}`]: null });
    if (!result) throw new Error("Parry use was not reset. Try again or correct it on the actor.");
    return result;
  });
}

export async function promptParry(actor, source) {
  if (!actor.isOwner || actor.type !== "character") return;
  const state = parryState(actor);
  const link = linkedDefense(actor, source, "parry");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: "Parry" }, ok: { label: "Roll Parry" }, rejectClose: false,
    render: (event, dialog) => fitDialogDisclosures(dialog),
    buttons: [...(state.used ? [{ action: "reset", label: "Reset Parry use", callback: async () => { await resetParryUse(actor); return null; } }] : []), ...linkedResetButtons(actor, source, "parry")],
    content: await template("parry-dialog", {
      ...state, modifier: actor.system.stats.dex.mod, reactions: actor.system.reactions.value,
      spendReaction: !!state.combatId && !state.used && state.unlocked && state.armed && !link?.used,
      ...(link ? { incoming: link.incoming, linkedUsed: link.used, ally: !!link.incoming.targetActorUuid && link.incoming.targetActorUuid !== actor.uuid } : {})
    })
  });
  if (!choices) return;
  return rollParry(actor, { ...choices, source });
}

export async function rollParry(actor, { target = null, ally = false, overwhelmingForce = false, mode = "normal", spendReaction = false, source } = {}) {
  if (!actor.isOwner || actor.type !== "character") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const link = linkedDefense(actor, source, "parry");
    requireUnusedDefense(link, "parry", spendReaction);
    const defense = parryContext({ target, ally, overwhelmingForce });
    const state = parryState(actor);
    const plan = checkMode(mode);
    if (spendReaction && state.used) throw new Error("Parry was already used this round. Reset Parry use for a correction, or untick spending for a practice roll.");
    if (spendReaction && !(actor.system.reactions.value >= 1)) throw new Error("No reactions left. Correct the pool or untick Spend 1 reaction to roll without spending.");
    const roll = await new foundry.dice.Roll(plan.formula, { mod: actor.system.stats.dex.mod }).evaluate({ allowInteractive: link ? !link.audience.blind : messageMode !== "blind" });
    const context = {
      kind: "check", label: ally ? "Parry for an ally" : "Parry", mode, actorUuid: actor.uuid,
      defense: { ...defense, spent: !!spendReaction, round: state.round, combatId: state.combatId, unlocked: state.unlocked, armed: state.armed,
        ...(link ? { incoming: { ...link.incoming, source: link.source } } : {}) }
    };
    const content = await rollCard(roll, context);
    if (spendReaction) {
      const key = `flags.${SYSTEM_ID}.parryUses.${state.combatId}`;
      const previous = state.combatId ? actor.getFlag?.(SYSTEM_ID, "parryUses")?.[state.combatId] : undefined;
      await change(
        () => actor.update({ "system.reactions.value": actor.system.reactions.value - 1, ...(state.combatId ? { [key]: state.round } : {}) }),
        () => actor.update({ "system.reactions.value": actor.system.reactions.value + 1,
          ...(state.combatId ? (previous === undefined ? { [`flags.${SYSTEM_ID}.parryUses.-=${state.combatId}`]: null } : { [key]: previous }) : {}) })
      );
    }
    if (spendReaction) await markLinkedDefense(actor, link, "parry", change);
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }), content, rolls: [roll],
      flags: { [SYSTEM_ID]: { check: context } }, ...(link?.audience ?? {})
    }, link ? undefined : { messageMode });
  }));
}
