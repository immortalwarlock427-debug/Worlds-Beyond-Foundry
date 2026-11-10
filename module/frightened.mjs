import { conditionSource } from "./condition-sources-core.mjs";
import { resolveConditionSource } from "./condition-sources.mjs";
import { approachesFear, fearSightDefault } from "./frightened-core.mjs";

const SCOPE = "worlds-beyond";
export function frightenedAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateFrightened") !== false;
  } catch {
    return true;
  }
}
const sameScene = (a, b) => !!a?.parent?.id && a.parent.id === b?.parent?.id;
const tokenDocument = token => token?.document ?? token;
const sceneTokens = scene => Array.from(scene?.tokens?.values?.() ?? scene?.tokens ?? []);
const activeFears = actor =>
  Array.from(actor?.effects?.values?.() ?? actor?.effects ?? []).filter(
    effect => effect.statuses?.has("fear") && !effect.disabled && !effect.isSuppressed && !effect.duration?.expired
  );

export function fearObserver(actor) {
  const scene = globalThis.canvas?.scene;
  if (!scene) return null;
  if (actor?.token && tokenDocument(actor.token).parent?.id === scene.id) return tokenDocument(actor.token);
  const own = sceneTokens(scene).filter(token => token.actor?.uuid === actor?.uuid);
  const controlled = (canvas.tokens?.controlled ?? []).map(tokenDocument).filter(token => own.includes(token));
  return controlled.length === 1 ? controlled[0] : own.length === 1 ? own[0] : null;
}

// Actor links must resolve to exactly one linked copy on this scene. Token
// links retain their exact synthetic actor; missing/ambiguous links stay manual.
export function fearSourceToken(effect, observer) {
  const saved = conditionSource(effect, "fear");
  const resolved = saved && resolveConditionSource(saved.uuid);
  if (!resolved) return null;
  if (resolved.document.documentName === "Token") return sameScene(observer, resolved.document) ? resolved.document : null;
  const copies = sceneTokens(observer?.parent).filter(token => token.actor?.uuid === resolved.actor.uuid);
  return copies.length === 1 ? copies[0] : null;
}

export function fearLineOfSight(observer, source) {
  if (!sameScene(observer, source) || observer.hidden || source.hidden || !observer.object?.testCollision) return null;
  if (observer.actor?.statuses?.has("blind") || source.actor?.statuses?.has("invisible")) return null;
  if (observer.parent.id !== globalThis.canvas?.scene?.id) return null;
  if (observer.level !== source.level || (observer.elevation ?? 0) !== (source.elevation ?? 0)) return null;
  if (observer.parent.levels && !observer.parent.levels.has(observer.level)) return null;
  try {
    const points = source.getVisibilityTestPoints?.();
    if (!points?.length) return null;
    let unknown = false;
    for (const point of points) {
      const collision = observer.object.testCollision(point, { type: "sight", mode: "any" });
      if (collision === false) return true;
      if (collision !== true) unknown = true;
    }
    return unknown ? null : false;
  } catch {
    return null;
  }
}

export function frightenedInSight(actor) {
  if (!frightenedAutomated() || !actor?.statuses?.has("fear")) return true;
  const observer = fearObserver(actor);
  if (!observer) return true;
  return fearSightDefault(
    activeFears(actor).map(effect => {
      const source = fearSourceToken(effect, observer);
      return source ? fearLineOfSight(observer, source) : null;
    })
  );
}

const rect = (token, point = token) => ({
  x: point.x / token.parent.grid.size,
  y: point.y / token.parent.grid.size,
  w: Math.max(1, token.width ?? 1),
  h: Math.max(1, token.height ?? 1)
});

export function frightenedMovementBlock(token, movement, operation = {}) {
  if (!frightenedAutomated() || token.actor?.type !== "character" || !token.actor.statuses?.has("fear")) return null;
  if (operation.isUndo || operation.isPaste || operation.worldsBeyondFormLoadout || operation.worldsBeyondCorrection) return null;
  const scene = token.parent;
  // Do not infer planar distances across floors, elevation changes, hexes or
  // gridless scenes. These remain manual rulings rather than false rejections.
  if (!scene?.grid?.isSquare || !(scene.grid.size > 0)) return null;
  const sources = activeFears(token.actor)
    .map(effect => fearSourceToken(effect, token))
    .filter(
      source =>
        source &&
        source.id !== token.id &&
        !source.hidden &&
        source.level === token.level &&
        (source.elevation ?? 0) === (token.elevation ?? 0)
    );
  if (!sources.length) return null;
  const actions = globalThis.CONFIG?.Token?.movement?.actions ?? {};
  let previous = { x: token.x, y: token.y, elevation: token.elevation ?? 0, level: token.level, ...movement.origin };
  for (const waypoint of [...(movement.passed?.waypoints ?? []), ...(movement.pending?.waypoints ?? [])]) {
    const next = { ...previous, ...waypoint };
    const action = waypoint.action ?? token.movementAction;
    const translated = next.x !== previous.x || next.y !== previous.y;
    if (
      translated &&
      action !== "displace" &&
      next.elevation === previous.elevation &&
      next.elevation === (token.elevation ?? 0) &&
      next.level === token.level
    ) {
      for (const source of sources)
        if (approachesFear(rect(token, previous), rect(token, next), rect(source), { teleport: !!actions[action]?.teleport }))
          return `${token.actor.name}: Frightened prevents willingly moving closer to its linked source. Use GM Displace for forced movement or turn off Automate linked Frightened rules for a ruling.`;
    }
    previous = next;
  }
  return null;
}

export function registerFrightened() {
  game.settings.register(SCOPE, "automateFrightened", {
    name: "Automate linked Frightened rules",
    hint: "Linked fear sources set attack/check sight defaults using sight walls, and stop willing square-grid movement closer before spending AP. Fear in sight stays editable; Displace, undo and form corrections bypass movement checks. Unresolved sources/geometry stay manual.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
