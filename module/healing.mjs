// Healing abilities: the caster's client rolls once and posts a card; the active GM's
// client changes each target's Health, since players can't edit other characters.
import { queuedAction } from "./action-support.mjs";
import { healingFor, undoHealing, healingLine } from "./healing-core.mjs";
import { autoApplyDamage, strikeAutomation } from "./strike-settings.mjs";

const SYSTEM_ID = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const healData = message => message?.getFlag?.(SYSTEM_ID, "heal") ?? null;

export function registerHealing() {
  Hooks.on("createChatMessage", message => {
    const data = healData(message);
    if (!game.user.isActiveGM || data?.status !== "pending" || !strikeAutomation() || !autoApplyDamage()) return;
    changeHealing(message, "apply").catch(error => ui.notifications.error(`Healing: ${error.message}`));
  });
  Hooks.on("renderChatMessageHTML", decorateHealing);
}

// GM: apply the card's healing to every target, or undo it.
export async function changeHealing(message, operation) {
  if (!game.user.isGM) return;
  return queuedAction(`heal:${message.id}`, async () => {
    const data = healData(message);
    if (!data) return;
    if (operation === "apply" && data.status !== "applied") {
      const results = [];
      for (const target of data.targets ?? []) {
        const actor = target.actorUuid ? await foundry.utils.fromUuid(target.actorUuid) : null;
        if (!actor?.system?.health) {
          results.push({ ...target, restored: 0, missing: true });
          continue;
        }
        const plan = healingFor(actor.system, data.amount);
        if (plan.restored > 0) await actor.update({ "system.health.damage": plan.next });
        results.push({ ...target, restored: plan.restored });
      }
      return message.setFlag(SYSTEM_ID, "heal", { ...data, status: "applied", results });
    }
    if (operation === "undo" && data.status === "applied") {
      for (const result of data.results ?? []) {
        if (!(result.restored > 0)) continue;
        const actor = await foundry.utils.fromUuid(result.actorUuid);
        if (actor?.system?.health) await actor.update({ "system.health.damage": undoHealing(actor.system.health.damage, result.restored) });
      }
      return message.setFlag(SYSTEM_ID, "heal", { ...data, status: "undone" });
    }
  });
}

export function decorateHealing(message, html) {
  const data = healData(message);
  const card = html.querySelector?.(".wb-heal-card");
  if (!data || !card || card.querySelector(".wb-heal-results")) return;
  const list = document.createElement("ul");
  list.className = "wb-heal-results";
  const lines =
    data.status === "applied"
      ? (data.results ?? []).map(result =>
          result.missing ? `${escapeHTML(result.name)} is no longer on the map.` : escapeHTML(healingLine(result.name, result.restored))
        )
      : (data.targets ?? []).map(
          target => `${escapeHTML(target.name)}: ${data.status === "undone" ? "healing undone" : "waiting for the GM"}.`
        );
  list.innerHTML = lines.map(line => `<li>${line}</li>`).join("");
  card.append(list);
  if (!game.user.isGM) return;
  const applied = data.status === "applied";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wb-heal-health";
  button.textContent = applied ? "Undo healing" : "Apply healing";
  button.addEventListener("click", async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      await changeHealing(message, applied ? "undo" : "apply");
    } catch (error) {
      ui.notifications.error(error.message);
      button.disabled = false;
    }
  });
  card.append(button);
}
