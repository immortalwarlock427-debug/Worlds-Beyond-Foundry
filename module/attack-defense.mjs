// Incoming attack association. Resource changes still use the defender's action queue.
import { incomingWeaponAttack } from "./defenses.mjs";
import { queuedAction } from "./action-support.mjs";

const SYSTEM_ID = "worlds-beyond";
const KINDS = ["block", "dodge", "parry"];
const label = kind => kind[0].toUpperCase() + kind.slice(1);

export function linkedDefense(actor, source, kind) {
  if (!source) return null;
  const message = game.messages.get(source.messageId);
  if (!KINDS.includes(kind) || !message?.isContentVisible) throw new Error("The incoming attack is no longer available to you.");
  const incoming = incomingWeaponAttack(message.getFlag(SYSTEM_ID, "attack"), message.rolls, source.handIndex);
  if (!incoming) throw new Error("That attack has no usable hit roll. Use the sheet for a manual defense.");
  const key = `${message.id}_${source.handIndex}`;
  // Whisper authors can see their own non-blind roll even when not listed as a recipient.
  const whisper = [...message.whisper];
  if (whisper.length && !message.blind && message.author?.id && !whisper.includes(message.author.id)) whisper.push(message.author.id);
  return {
    source: { messageId: message.id, handIndex: source.handIndex }, incoming, key,
    used: !!actor.getFlag?.(SYSTEM_ID, "defenseUses")?.[key]?.[kind],
    audience: { whisper, blind: message.blind }
  };
}

export function requireUnusedDefense(link, kind, spend) {
  if (spend && link?.used) throw new Error(`${label(kind)} was already used against this attack. Reset its linked use for a correction, or untick spending for practice.`);
}

export async function markLinkedDefense(actor, link, kind, change) {
  if (!link) return;
  if (!actor.isOwner) throw new Error("You no longer own this defender.");
  requireUnusedDefense(linkedDefense(actor, link.source, kind), kind, true);
  await change(
    () => actor.update({ [`flags.${SYSTEM_ID}.defenseUses.${link.key}.${kind}`]: true }),
    () => actor.update({ [`flags.${SYSTEM_ID}.defenseUses.${link.key}.-=${kind}`]: null })
  );
}

export function linkedResetButtons(actor, source, kind) {
  const link = linkedDefense(actor, source, kind);
  if (!link?.used) return [];
  return [{ action: "resetLinked", label: `Reset linked ${label(kind)} use`, callback: async () => {
    await queuedAction(actor.uuid, async () => {
      if (!actor.isOwner) return;
      const current = linkedDefense(actor, source, kind);
      const result = await actor.update({ [`flags.${SYSTEM_ID}.defenseUses.${current.key}.-=${kind}`]: null });
      if (!result) throw new Error("The linked use was not reset. Try again.");
    });
    return null;
  } }];
}

export function defenseActors(incoming) {
  const candidates = [
    incoming.targetActorUuid && foundry.utils.fromUuidSync(incoming.targetActorUuid),
    ...(globalThis.canvas?.tokens?.controlled ?? []).map(token => token.actor),
    game.user.character, ...(game.actors?.contents ?? [])
  ];
  const seen = new Set();
  return candidates.filter(actor => {
    if (!actor?.isOwner || actor.type !== "character" || seen.has(actor.uuid)) return false;
    seen.add(actor.uuid); return true;
  });
}

export async function promptAttackDefense(message, index, kind) {
  const source = { messageId: message.id, handIndex: index };
  const link = linkedDefense({}, source, kind);
  const actors = defenseActors(link.incoming);
  if (!actors.length) throw new Error("Select an owned character token or assign a character before defending.");
  let actor = actors[0];
  if (actors.length > 1) {
    const choice = await foundry.applications.api.DialogV2.input({
      classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
      window: { title: `${label(kind)} · choose defender` }, ok: { label: "Continue" }, rejectClose: false,
      content: await foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/defender-dialog.hbs`, {
        incoming: link.incoming, actors: actors.map(candidate => ({ uuid: candidate.uuid, name: candidate.name, token: !!candidate.isToken }))
      })
    });
    if (!choice) return;
    actor = actors.find(candidate => candidate.uuid === choice.actorUuid);
  }
  if (!actor?.isOwner) return;
  if (kind === "dodge" && link.incoming.targetActorUuid && link.incoming.targetActorUuid !== actor.uuid) {
    throw new Error("Dodge protects only the attack's target. Choose that character, or use Block or Parry to protect an ally. Use the sheet for a targeting correction.");
  }
  const { promptBlock, promptDodge, promptParry } = await import("./reaction-actions.mjs");
  return ({ block: promptBlock, dodge: promptDodge, parry: promptParry })[kind](actor, source);
}

export function decorateAttackDefenses(message, html) {
  if (!message.isContentVisible) return;
  const data = message.getFlag?.(SYSTEM_ID, "attack");
  const card = html.querySelector(".wb-attack-card");
  if (!data || !card || card.querySelector(".wb-defense-actions")) return;
  const count = Array.isArray(data.hands) ? data.hands.length : 1;
  for (let index = 0; index < count; index++) {
    const incoming = incomingWeaponAttack(data, message.rolls, index);
    if (!incoming || !defenseActors(incoming).length) continue;
    const group = document.createElement("div");
    group.className = "wb-defense-actions";
    group.setAttribute("aria-label", "Defend against this attack");
    for (const kind of KINDS) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label(kind);
      button.disabled = kind === "dodge" && incoming.natural20;
      button.title = button.disabled ? "Natural 20 attacks cannot be Dodged" : `${label(kind)} against this attack`;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await promptAttackDefense(message, index, kind); }
        catch (error) { ui.notifications.error(error.message); }
        finally { button.disabled = kind === "dodge" && incoming.natural20; }
      });
      group.append(button);
    }
    (card.querySelector(`.wb-attack-hand[data-hand="${index}"]`) ?? card).append(group);
  }
}
