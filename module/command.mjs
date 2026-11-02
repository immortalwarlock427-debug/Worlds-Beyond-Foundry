import { commandAmount, apTotal } from "./ap.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { payAp, inCombat, commandReady } from "./combat-support.mjs";
import { wholeNumber } from "./number-display.mjs";
const SCOPE = "worlds-beyond";
const mountedCommands = new Set();
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function commandCandidates(actor) {
  const candidates = new Map();
  for (const combat of game.combats ?? []) for (const entry of combat.combatants) {
    if (entry.visible === false) continue;
    if (entry.actor?.type === "character" && entry.actor.uuid !== actor.uuid) candidates.set(entry.actor.uuid, entry.actor);
  }
  for (const entry of game.actors ?? []) if (entry.type === "character" && entry.uuid !== actor.uuid && (entry.isOwner || entry.visible)) candidates.set(entry.uuid, entry);
  return Array.from(candidates.values());
}
export async function promptCommand(actor) {
  if (!actor.isOwner) return;
  const choices = commandCandidates(actor);
  if (!choices.length) throw new Error("Add an ally to the world or encounter first.");
  const amount = commandAmount(actor.system.stats.cha.mod);
  const content = `<div class="wb-check-options"><p>Spend 5 of your own AP · Give ${amount} Command AP.</p><label>Ally<select name="ally">${choices.map((ally, index) => `<option value="${index}">${escapeHTML(ally.name)}</option>`).join("")}</select></label><details class="wb-disclosure wb-help"><summary>Command rules</summary><p>Fixed 5 AP. Grants 2 + CHA modifier, up to 5. Does not stack; the ally keeps the higher remaining grant and spends it on their turn. The active GM applies cross-owner grants; without one, the ally can accept from chat.</p></details></div>`;
  const form = await foundry.applications.api.DialogV2.input({ classes: [SCOPE, "wb-roll-dialog"], position: { width: 380 }, window: { title: "Command" }, content, ok: { label: "Give Command AP" }, rejectClose: false });
  if (!form) return;
  const ally = choices[Number(form.ally ?? 0)];
  if (!ally) throw new Error("Choose an ally.");
  return commandAlly(actor, ally);
}

export async function commandAlly(actor, ally) {
  if (!actor.isOwner || actor.type !== "character" || ally?.type !== "character" || actor.uuid === ally.uuid) return;
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    if (!actor.isOwner) return;
    if ((await foundry.utils.fromUuid(ally.uuid))?.type !== "character") throw new Error("That ally no longer exists. Reopen Command.");
    const amount = commandAmount(actor.system.stats.cha.mod);
    if (!(amount > 0)) throw new Error("Your current CHA grants no Command AP. Correct the score if needed.");
    await payAp(actor, 5, change, { allowCommand: false });
    const message = await createActionMessage({ speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content: `<div class="worlds-beyond wb-command-card"><h3>Command</h3><p>${escapeHTML(actor.name)} spent 5 AP to offer ${wholeNumber(amount)} Command AP to ${escapeHTML(ally.name)}.</p><p>Use on the ally's turn · Keeps the higher grant.</p></div>`,
      flags: { [SCOPE]: { command: { targetUuid: ally.uuid, amount } } }
    }, { messageMode: game.settings.get("core", "messageMode") });
    // Delivery failures do not refund a successfully posted offer: the recipient
    // or GM can retry it without charging the commander a second time.
    if (ally.isOwner || game.user?.isActiveGM) try { await applyCommandGrant(ally, amount, message.uuid ?? message.id); }
    catch (error) { ui.notifications.warn(`Command posted; apply it from chat: ${error.message}`); }
    return message;
  }));
}

export async function receiveCommand(message) {
  const data = message.getFlag(SCOPE, "command");
  if (!data) throw new Error("This card has no Command offer. Use Command again from the sender's sheet.");
  const amount = Number(data.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 5) throw new Error("This card has an invalid Command amount. Use Command again from the sender's sheet.");
  const actor = await foundry.utils.fromUuid(data.targetUuid);
  if (!actor || actor.type !== "character") throw new Error("This Command's recipient no longer exists. Choose the ally again.");
  if (!actor.isOwner && !game.user?.isActiveGM) return;
  return applyCommandGrant(actor, amount, message.uuid ?? message.id);
}

export async function applyCommandGrant(actor, amount, receipt) {
  if (!actor.isOwner && !game.user?.isActiveGM) return;
  if (!receipt || !Number.isInteger(amount) || amount < 1 || amount > 5) throw new Error("Command needs a valid amount and delivery receipt.");
  return queuedAction(actor.uuid, async () => {
    const flags = actor.getFlag(SCOPE, "commandClaims");
    const claimed = Array.isArray(flags) ? flags : [];
    if (claimed.includes(receipt)) return actor;
    const value = Math.max(actor.system.command?.value ?? 0, amount);
    const fresh = !inCombat(actor) || !commandReady(actor);
    const received = [...claimed, receipt];
    await actor.update({ "system.command.value": value, "system.command.fresh": fresh, [`flags.${SCOPE}.commandClaims`]: received });
    if (actor.system.command?.value !== value || !actor.getFlag(SCOPE, "commandClaims")?.includes(receipt)) throw new Error("Command delivery was cancelled or not retained. Retry from chat.");
    actor.render?.(false);
    refreshCommandControls(actor);
    ui.notifications.info?.(`${actor.name}: ${wholeNumber(apTotal(actor.system))} AP total, including ${wholeNumber(value)} Command AP.`);
    return actor;
  });
}

export function refreshCommandControls(actor) {
  for (const entry of mountedCommands) {
    const button = entry.button.deref();
    if (!button) { mountedCommands.delete(entry); continue; }
    if (actor?.uuid !== entry.actorUuid) continue;
    const claims = actor.getFlag(SCOPE, "commandClaims");
    const claimed = Array.isArray(claims) && claims.includes(entry.receipt);
    button.textContent = claimed ? "Command received" : "Receive Command AP"; button.disabled = claimed;
  }
}

export function decorateCommand(message, html) {
  if (!message.isContentVisible) return;
  const data = message.getFlag?.(SCOPE, "command"), content = html.querySelector(".wb-command-card");
  if (!data || !content || content.querySelector(".wb-command-receive")) return;
  const actor = foundry.utils.fromUuidSync(data.targetUuid);
  if (!actor?.isOwner) return;
  const button = document.createElement("button"); button.type = "button"; button.className = "wb-command-receive";
  const claims = actor.getFlag(SCOPE, "commandClaims");
  const claimed = Array.isArray(claims) && claims.includes(message.uuid ?? message.id);
  button.textContent = claimed ? "Command received" : "Receive Command AP"; button.disabled = claimed;
  mountedCommands.add({ button: new WeakRef(button), actorUuid: actor.uuid, receipt: message.uuid ?? message.id });
  button.addEventListener("click", async () => { button.disabled = true; try { const result = await receiveCommand(message); if (!result) throw new Error("Only this ally's owner or the active GM can receive Command AP."); refreshCommandControls(result); } catch (error) { button.disabled = false; ui.notifications.error(error.message); } });
  content.append(button);
}
