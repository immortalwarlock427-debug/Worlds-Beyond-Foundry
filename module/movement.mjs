// Movement AP on the map. In a started combat, a character's own turn charges AP for
// the movement Foundry measures (heavy armor and difficult-terrain Regions included).
// Rules math is in movement-core.mjs. Opt-outs: three world settings, the sheet's
// Movement / AP and Square cost overrides, and the GM's Displace movement, which is free.
import { apAvailable, apSpendPlan } from "./ap.mjs";
import { queuedAction } from "./action-support.mjs";
import { collisionBlock } from "./positioning.mjs";
import { confirmProvoking } from "./opportunity.mjs";
import { wholeNumber } from "./number-display.mjs";
import { actorConditionMovement, conditionMovementBlock } from "./condition-movement.mjs";
import { frightenedMovementBlock } from "./frightened.mjs";
import { requireActionCapacity } from "./condition-actions.mjs";
import {
  SURGE_AP,
  squareFactor,
  turnLedger,
  ledgerTotals,
  movementCost,
  receiptFor,
  refundMovements,
  costLabel
} from "./movement-core.mjs";

const SCOPE = "worlds-beyond";
const FLAG = "movement";

const SETTINGS = {
  movementCostsAp: {
    name: "Movement costs AP",
    hint:
      "In combat, moving a character's token on its own turn spends AP at its Movement / AP rate. " +
      "Unused feet carry over for the rest of the turn; undoing a move refunds it. Moves off-turn and the GM's Displace moves stay free."
  },
  heavyArmorSquares: {
    name: "Heavy armor slows movement",
    hint:
      "Heavy armor makes each 5 ft square cost 10 ft of movement (20 ft in difficult terrain). " +
      "A character's Square cost override still applies."
  },
  surgeFreeMovement: {
    name: "Surge gives free movement AP",
    hint: "Characters with Agility 21 get 2 AP each turn that only pay for movement, used before their own AP."
  }
};

export function movementSetting(key) {
  try {
    return game.settings.get(SCOPE, key) !== false;
  } catch {
    return true;
  }
}

function registerSettings() {
  for (const [key, data] of Object.entries(SETTINGS))
    game.settings.register(SCOPE, key, {
      ...data,
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      // Square costs live on prepared actor data, so re-prepare when the rule is switched.
      onChange: key === "heavyArmorSquares" ? () => refreshActors() : undefined
    });
}

function refreshActors() {
  for (const actor of game.actors ?? []) if (actor.type === "character") actor.reset();
  for (const token of canvas?.tokens?.placeables ?? []) if (!token.document.actorLink) token.actor?.reset();
  for (const app of foundry.applications.instances?.values?.() ?? []) if (app.document?.type === "character") app.render();
}

// The token's own turn in a started combat, or null when movement is free. Searches
// the combats directly: TokenDocument#combatant reads the combat tracker, which is
// briefly empty while it re-renders after an actor change (seen live on 14.365).
function currentTurn(tokenDocument) {
  const sceneId = tokenDocument?.parent?.id;
  for (const combat of game.combats ?? []) {
    const current = combat.started ? combat.combatant : null;
    if (current?.tokenId === tokenDocument.id && current.sceneId === sceneId) return `${combat.id}:${combat.round}:${combat.turn}`;
  }
  return null;
}

const surgeMax = actor => (movementSetting("surgeFreeMovement") && (actor.system.stats?.agl?.milestones ?? 0) >= 1 ? SURGE_AP : 0);

// What moving this token `feet` would cost right now, or null if it's free.
export function movementQuote(tokenDocument, feet) {
  if (!movementSetting("movementCostsAp") || !Number.isFinite(feet)) return null;
  const actor = tokenDocument?.actor;
  if (actor?.type !== "character") return null;
  const key = currentTurn(tokenDocument);
  if (!key) return null;
  const ledger = turnLedger(actor.getFlag(SCOPE, FLAG), key);
  const { bank, surgeLeft } = ledgerTotals(ledger, surgeMax(actor));
  const available = apAvailable(actor.system, true);
  const quote = {
    actor,
    ledger,
    available,
    ...movementCost({
      feet,
      rate: actor.system.core?.movement,
      bank,
      surgeLeft,
      available,
      multiplier: actorConditionMovement(actor).multiplier
    })
  };
  const mobility = actorConditionMovement(actor);
  if (feet > 0 && mobility.blocked.length) {
    quote.affordable = false;
    quote.reason = `${mobility.blocked.join(" / ")} prevents movement`;
  }
  // Surge is movement-only AP too. Feet already bought earlier remain banked;
  // undo, Displace and movements outside this charging path stay corrections.
  try {
    requireActionCapacity(actor, { ap: quote.ap + quote.surge });
  } catch (error) {
    quote.affordable = false;
    quote.reason = error.message;
  }
  return quote;
}

async function payForMovement(tokenDocument, movement) {
  const whole = movementQuote(tokenDocument, movement.passed.cost + movement.pending.cost);
  if (!whole) return true;
  const { actor } = whole;
  if (!whole.affordable) {
    const feet = wholeNumber(whole.feet);
    ui.notifications.warn(
      whole.reason
        ? `${actor.name} ${whole.reason}.`
        : `${actor.name} needs ${whole.ap} AP to move ${feet} ft but has ${wholeNumber(whole.available)}. ` +
            "The GM can use Displace for a free move."
    );
    return false;
  }
  return queuedAction(actor.uuid, async () => {
    const cost = movementQuote(tokenDocument, movement.passed.cost);
    if (!cost || (!cost.feet && !cost.credit)) return true;
    if (!cost.affordable) {
      ui.notifications.warn(`${actor.name}: ${cost.reason || "not enough AP for movement"}.`);
      return false;
    }
    let plan;
    try {
      requireActionCapacity(actor, { ap: cost.ap + cost.surge });
      plan = apSpendPlan(actor.system, cost.ap, true);
    } catch (error) {
      ui.notifications.warn(`${actor.name}: ${error.message}`);
      return false;
    }
    const receipts = [...cost.ledger.receipts, receiptFor(movement.id, cost, plan)];
    const updates = { [`flags.${SCOPE}.${FLAG}`]: { key: cost.ledger.key, receipts } };
    if (plan.fromOwn) updates["system.ap.value"] = plan.own;
    if (plan.fromGiven) updates["system.command.value"] = plan.given;
    await actor.update(updates);
    return true;
  });
}

async function refundUndo(tokenDocument, previousIds) {
  const actor = tokenDocument.actor;
  const key = currentTurn(tokenDocument);
  if (actor?.type !== "character" || !key) return;
  const remaining = new Set(tokenDocument._source._movementHistory.map(waypoint => waypoint.movementId));
  const undone = [...new Set(previousIds)].filter(id => !remaining.has(id));
  if (!undone.length) return;
  await queuedAction(actor.uuid, async () => {
    const refund = refundMovements(turnLedger(actor.getFlag(SCOPE, FLAG), key), undone);
    if (!refund.count) return;
    const updates = { [`flags.${SCOPE}.${FLAG}`]: refund.ledger };
    if (refund.ap) updates["system.ap.value"] = actor.system.ap.value + refund.ap;
    if (refund.given) updates["system.command.value"] = (actor.system.command?.value ?? 0) + refund.given;
    await actor.update(updates);
  });
}

export function registerMovement() {
  registerSettings();

  const Document = CONFIG.Token.documentClass;
  CONFIG.Token.documentClass = class WorldsBeyondTokenDocument extends Document {
    #undoneFrom = null;

    async _preUpdateMovement(movement, operation) {
      if ((await super._preUpdateMovement(movement, operation)) === false) return false;
      if (operation.isUndo) {
        this.#undoneFrom = movement.history.recorded.waypoints.map(waypoint => waypoint.movementId);
        return;
      }
      // Form transformations find their own room (form-tokens.mjs) and cost no movement.
      if (operation.isPaste || operation.worldsBeyondFormLoadout) return;
      try {
        const immobile = conditionMovementBlock(this, movement, operation) || frightenedMovementBlock(this, movement, operation);
        if (immobile) {
          ui.notifications.warn(immobile);
          return false;
        }
        const blocked = collisionBlock(this, [...movement.passed.waypoints, ...movement.pending.waypoints]);
        if (blocked) {
          ui.notifications.warn(blocked);
          return false;
        }
        if (!(await confirmProvoking(this, movement))) return false;
        if ((await payForMovement(this, movement)) === false) return false;
      } catch (error) {
        ui.notifications.error(`Movement could not be checked: ${error.message}`);
        return false;
      }
    }

    _onUpdateMovement(movement, operation, user) {
      super._onUpdateMovement(movement, operation, user);
      if (!operation.isUndo || !user?.isSelf || !this.#undoneFrom) return;
      const previous = this.#undoneFrom;
      this.#undoneFrom = null;
      refundUndo(this, previous).catch(error => ui.notifications.error(`Movement AP could not be refunded: ${error.message}`));
    }
  };

  const Token = CONFIG.Token.objectClass;
  CONFIG.Token.objectClass = class WorldsBeyondMovingToken extends Token {
    _getMovementCostFunction(options) {
      const cost = super._getMovementCostFunction(options);
      const actor = this.document.actor;
      const factor = actor?.type === "character" ? squareFactor(actor.system.equipment?.squareCost) : 1;
      if (factor === 1) return cost;
      return (from, to, distance, segment) => (cost ? cost(from, to, distance, segment) : distance) * factor;
    }
  };

  const Ruler = CONFIG.Token.rulerClass;
  CONFIG.Token.rulerClass = class WorldsBeyondMovementRuler extends Ruler {
    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context?.cost || waypoint.stage !== "planned") return context;
      // Cost of the planned route only: measurements also count earlier movement.
      let start = waypoint;
      while (start.previous?.stage === "planned") start = start.previous;
      const base = (start.previous ?? start).measurement?.cost ?? 0;
      const quote = movementQuote(this.token.document, waypoint.measurement.cost - base);
      if (quote) context.cost.units = `${context.cost.units} · ${costLabel(quote, quote.available)}`;
      return context;
    }
  };
}
