// Opportunity attack prompts. The active GM's client watches token moves; when a
// creature leaves an armed enemy's reach (or enters a Bulwark weapon's reach), the
// enemy's owner is asked whether to attack. Rules live in opportunity-core.mjs.
// Opt-outs: the world setting, "Let them go" on each prompt, and the attack dialog's
// Spend a reaction checkbox.
import { opposed, threateningWeapons, opportunityWeapons, immuneToOpportunity } from "./opportunity-core.mjs";
import { answeringUser } from "./strike.mjs";
import { promptAttack, targetFromToken } from "./attack-actions.mjs";
import { wholeNumber } from "./number-display.mjs";
import { footprint, positioningSetting } from "./positioning.mjs";

const SYSTEM_ID = "worlds-beyond";
const SOCKET = `system.${SYSTEM_ID}`;
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const openPrompts = new Set();

function enabled() {
  try {
    return game.settings.get(SYSTEM_ID, "offerOpportunityAttacks") !== false;
  } catch {
    return true;
  }
}

export function registerOpportunityAttacks() {
  game.settings.register(SYSTEM_ID, "offerOpportunityAttacks", {
    name: "Offer opportunity attacks",
    hint:
      "In combat, when a creature leaves an armed enemy's reach (or moves into a Bulwark weapon's reach), " +
      "that enemy's owner is asked whether to attack. It uses a reaction and no AP. " +
      "Teleports, Displace moves and undone moves don't provoke.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.once("ready", () =>
    game.socket.on(SOCKET, payload => {
      if (payload?.type === "opportunityPrompt" && payload.userId === game.user.id)
        showOpportunityPrompt(payload).catch(error => ui.notifications.error(error.message));
    })
  );
  Hooks.on("moveToken", (token, movement, operation) => {
    if (!game.user.isActiveGM || !enabled()) return;
    try {
      checkMove(token, movement, operation);
    } catch (error) {
      ui.notifications.error(`Opportunity attacks: ${error.message}`);
    }
  });
}

// Every enemy combatant who could make an opportunity attack against this path, as
// { attacker, actor, offer }. `path` lists positions, starting where the mover began.
export function provokers(token, path, { visibleOnly = false } = {}) {
  const scene = token.parent;
  if (!scene || scene.grid.isHexagonal || token.hidden || path.length < 2) return [];
  if (token.actor?.type === "character" && immuneToOpportunity(token.actor.system.stats?.agl?.effective)) return [];
  const sized = position => ({ ...position, width: position.width ?? token.width, height: position.height ?? token.height });
  const footprints = path.map(position => footprint(scene, sized(position)));
  const gridFeet = scene.grid.distance || 5;
  const found = [];
  for (const combat of game.combats ?? []) {
    if (!combat.started) continue;
    for (const combatant of combat.combatants) {
      if (combatant.sceneId !== scene.id) continue;
      const attacker = combatant.token;
      const actor = combatant.actor;
      if (!attacker || attacker.id === token.id || attacker.hidden || combatant.isDefeated) continue;
      if (visibleOnly && attacker.object && !attacker.object.visible) continue; // Don't warn about unseen enemies.
      if (actor?.type !== "character" || !(actor.system.reactions?.value >= 1)) continue;
      if (!opposed(attacker.disposition, token.disposition)) continue;
      const weapons = threateningWeapons(actor.items);
      const offer = opportunityWeapons({ attacker: footprint(scene, attacker), path: footprints, weapons, gridFeet });
      if (offer && !found.some(entry => entry.attacker.id === attacker.id)) found.push({ attacker, actor, offer });
    }
  }
  return found;
}

const teleporting = waypoints => waypoints.some(waypoint => CONFIG.Token.movement?.actions?.[waypoint.action]?.teleport);

function checkMove(token, movement, operation) {
  if (operation?.isUndo || movement.method === "undo") return;
  const waypoints = movement.passed?.waypoints ?? [];
  if (!waypoints.length || teleporting(waypoints)) return;
  for (const { attacker, actor, offer } of provokers(token, [movement.origin, ...waypoints])) {
    const user = answeringUser(actor);
    const payload = {
      type: "opportunityPrompt",
      userId: user.id,
      attackerTokenUuid: attacker.uuid,
      moverTokenUuid: token.uuid,
      kind: offer.kind,
      weaponIds: offer.weapons.map(weapon => weapon.id),
      movementId: movement.id
    };
    if (user.isSelf) showOpportunityPrompt(payload).catch(error => ui.notifications.error(error.message));
    else game.socket.emit(SOCKET, payload);
  }
}

// Before a move leaves an enemy's reach, ask the mover to confirm. Returns false to cancel.
const confirmed = new Set();
export async function confirmProvoking(token, movement) {
  if (!enabled() || !positioningSetting("warnBeforeProvoking") || confirmed.has(movement.id)) return true;
  const waypoints = [...(movement.passed?.waypoints ?? []), ...(movement.pending?.waypoints ?? [])];
  if (!waypoints.length || teleporting(waypoints)) return true;
  const path = [movement.origin, ...waypoints];
  const leaving = provokers(token, path, { visibleOnly: true }).filter(entry => entry.offer.kind === "leave");
  if (!leaving.length) return true;
  const names = leaving.map(entry => escapeHTML(entry.attacker.name)).join(", ");
  const ok = await foundry.applications.api.DialogV2.confirm({
    classes: [SYSTEM_ID, "wb-roll-dialog"],
    window: { title: `${token.name}: provoke an opportunity attack?` },
    content:
      `<div class="worlds-beyond"><p class="wb-result">This move leaves ${names}'s reach.</p>` +
      `<p>${leaving.length > 1 ? "Each" : "They"} can spend a reaction to attack ${escapeHTML(token.name)} as it goes. ` +
      "Move anyway?</p></div>",
    yes: { label: "Move anyway" },
    no: { label: "Stay", default: true },
    rejectClose: false
  });
  if (ok) {
    confirmed.add(movement.id);
    setTimeout(() => confirmed.delete(movement.id), 60_000);
  }
  return !!ok;
}

export async function showOpportunityPrompt({ attackerTokenUuid, moverTokenUuid, kind, weaponIds, movementId }) {
  const attacker = foundry.utils.fromUuidSync(attackerTokenUuid);
  const mover = foundry.utils.fromUuidSync(moverTokenUuid);
  const actor = attacker?.actor;
  if (!actor?.isOwner || !mover) return;
  const key = `${attackerTokenUuid}:${moverTokenUuid}:${movementId}:${kind}`;
  if (openPrompts.has(key)) return;
  openPrompts.add(key);
  try {
    const weapons = weaponIds.map(id => actor.items.get(id)).filter(Boolean);
    if (!weapons.length) return;
    const reactions = wholeNumber(actor.system.reactions?.value ?? 0);
    const what =
      kind === "enter" ? `is moving into ${escapeHTML(actor.name)}'s Bulwark reach` : `is leaving ${escapeHTML(actor.name)}'s reach`;
    const content =
      `<div class="worlds-beyond"><p class="wb-result">${escapeHTML(mover.name)} ${what}.</p>` +
      `<p>An opportunity attack uses a reaction and no AP. ${reactions} reaction${reactions === 1 ? "" : "s"} left.</p></div>`;
    const choice = await foundry.applications.api.DialogV2.wait({
      classes: [SYSTEM_ID, "wb-roll-dialog"],
      position: { width: 400 },
      window: { title: `${actor.name}: opportunity attack?` },
      content,
      rejectClose: false,
      buttons: [
        ...weapons.map((weapon, index) => ({ action: weapon.id, label: `Attack with ${weapon.name}`, default: index === 0 })),
        { action: "pass", label: "Let them go" }
      ]
    });
    if (!choice || choice === "pass") return;
    const target = targetFromToken(mover.object ?? { actor: mover.actor, name: mover.name, document: mover });
    return await promptAttack(actor, choice, target, { opportunity: kind });
  } finally {
    openPrompts.delete(key);
  }
}
