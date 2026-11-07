// Positioning on the map: the token HUD's Ally/Enemy toggle, token collision and
// attack distances. Rules live in positioning-core.mjs. Opt-outs: the world settings
// below and the GM's Displace movement, which ignores collision.
import { movementBlock, blockMessage } from "./positioning-core.mjs";
import { opposed, spacesBetween } from "./opportunity-core.mjs";

const SYSTEM_ID = "worlds-beyond";
const FRIENDLY = 1,
  HOSTILE = -1;

const SETTINGS = {
  tokenCollision: {
    name: "Tokens block movement",
    hint:
      "Enemies block movement. Allies and downed creatures can be moved through, but no token can end its move in another's space. " +
      "The GM's Displace movement ignores this."
  },
  checkAttackRange: {
    name: "Check attack range",
    hint:
      "Before an attack, compare the distance to the target with the weapon's reach or range. " +
      "Out of range asks before attacking; past normal range selects disadvantage."
  },
  warnBeforeProvoking: {
    name: "Warn before provoking opportunity attacks",
    hint: "Ask the mover to confirm a move that leaves an enemy's reach while that enemy can make an opportunity attack."
  }
};

export function positioningSetting(key) {
  try {
    return game.settings.get(SYSTEM_ID, key) !== false;
  } catch {
    return true;
  }
}

export function registerPositioning() {
  for (const [key, data] of Object.entries(SETTINGS))
    game.settings.register(SYSTEM_ID, key, { ...data, scope: "world", config: true, type: Boolean, default: true });
  Hooks.on("renderTokenHUD", addSideToggle);
}

/* -------------------------------------------- */
/*  Ally / Enemy toggle                          */
/* -------------------------------------------- */

// Sides use Foundry's token disposition: Friendly (green) and Hostile (red) are
// enemies of each other; Neutral is nobody's enemy.
export const isEnemy = disposition => disposition === HOSTILE || disposition === -2;

function addSideToggle(hud, html) {
  const token = hud.document;
  const column = (html instanceof HTMLElement ? html : html?.[0])?.querySelector(".col.left");
  if (!token?.isOwner || !column || column.querySelector('[data-action="wbSide"]')) return;
  const enemy = isEnemy(token.disposition);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `control-icon${enemy ? " active" : ""}`;
  button.dataset.action = "wbSide";
  button.dataset.tooltip = enemy
    ? "Enemy (red): fights green tokens. Click to make an ally."
    : "Ally (green): fights red tokens. Click to make an enemy.";
  button.innerHTML = `<i class="fa-solid ${enemy ? "fa-skull-crossbones" : "fa-handshake"}" inert></i>`;
  button.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await token.update({ disposition: enemy ? FRIENDLY : HOSTILE });
    hud.render();
  });
  column.append(button);
}

/* -------------------------------------------- */
/*  Footprints and collision                     */
/* -------------------------------------------- */

// A token's footprint in grid spaces at a position (x, y, width, height).
export function footprint(scene, position) {
  const offset = scene.grid.getOffset({ x: position.x + 1, y: position.y + 1 });
  return {
    i: offset.j,
    j: offset.i,
    w: Math.max(1, Math.round(position.width ?? 1)),
    h: Math.max(1, Math.round(position.height ?? 1))
  };
}

const downed = actor => actor?.type === "character" && Number(actor.system.health?.value) <= 0;

// The reason a move is blocked, or null. Hidden tokens never block, so they aren't revealed.
export function collisionBlock(token, waypoints) {
  const scene = token.parent;
  if (!positioningSetting("tokenCollision") || !scene || scene.grid.isHexagonal || !waypoints?.length) return null;
  const actions = CONFIG.Token.movement?.actions ?? {};
  const moved = waypoints.filter(waypoint => (waypoint.action ?? token.movementAction) !== "displace");
  if (moved.length !== waypoints.length) return null;
  const teleport = waypoints.some(waypoint => actions[waypoint.action]?.teleport);
  const sized = position => ({ ...position, width: position.width ?? token.width, height: position.height ?? token.height });
  const path = (teleport ? [waypoints.at(-1)] : waypoints).map(position => footprint(scene, sized(position)));
  const elevation = waypoints.at(-1).elevation ?? token.elevation;
  const others = scene.tokens
    .filter(other => other.id !== token.id && !other.hidden && (other.elevation ?? 0) === (elevation ?? 0))
    .map(other => ({
      name: other.name,
      footprint: footprint(scene, other),
      enemy: opposed(token.disposition, other.disposition),
      downed: downed(other.actor)
    }));
  const block = movementBlock(path, others);
  return block && blockMessage(block);
}

/* -------------------------------------------- */
/*  Attack distance                              */
/* -------------------------------------------- */

// Feet between the attacker's token and the target's token on the same scene, or null.
export function attackDistance(actor, target) {
  if (!target?.tokenUuid) return null;
  const targetToken = foundry.utils?.fromUuidSync?.(target.tokenUuid);
  const scene = targetToken?.parent;
  if (!scene || scene.grid.isHexagonal) return null;
  const own =
    actor.token?.parent === scene ? actor.token : actor.getActiveTokens?.(false, true).find(token => token.parent === scene);
  if (!own) return null;
  return spacesBetween(footprint(scene, own), footprint(scene, targetToken)) * (scene.grid.distance || 5);
}
