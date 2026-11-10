import { conditionMovement, grappleEscapeDc, escapedGrapple } from "./condition-movement-core.mjs";
import { actorExhaustion } from "./exhaustion.mjs";
import { conditionEffects } from "./conditions.mjs";
import { inCombat, planApPayment, payAp } from "./combat-support.mjs";
import { requireActionCapacity } from "./condition-actions.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { defaultCheckMode, actorConditionRoll, conditionRollText, conditionControls, bindConditionCheck } from "./condition-rolls.mjs";
import { checkMode } from "./rolls.mjs";
import { rollCard } from "./roll-actions.mjs";

const SCOPE = "worlds-beyond";
function setting(key, fallback) {
  try {
    return game.settings.get(SCOPE, key) ?? fallback;
  } catch {
    return fallback;
  }
}
export const conditionMovementAutomated = () => setting("automateConditionMovement", true) !== false;
export function actorConditionMovement(actor) {
  return conditionMovement(conditionMovementAutomated() ? (actor?.statuses ?? []) : [], {
    exhaustionMultiplier: actorExhaustion(actor).movementMultiplier,
    stackProne: setting("proneStacksWithExhaustion", false) === true
  });
}

// Ordinary translations are blocked, including off-turn/out-of-combat moves and
// banked feet. Displace/teleport, undo, paste and form operations remain corrections.
export function conditionMovementBlock(token, movement, operation = {}) {
  if (operation.isUndo || operation.isPaste || operation.worldsBeyondFormLoadout || token.actor?.type !== "character") return null;
  const paths = [...(movement.passed?.waypoints ?? []), ...(movement.pending?.waypoints ?? [])];
  const actions = globalThis.CONFIG?.Token?.movement?.actions ?? {};
  let previous = movement.origin ?? token,
    ordinary = false;
  for (const point of paths) {
    const action = point.action ?? token.movementAction;
    const translated = ["x", "y", "elevation"].some(key => point[key] != null && point[key] !== previous[key]);
    if (translated && action !== "displace" && !actions[action]?.teleport) ordinary = true;
    previous = { ...previous, ...point };
  }
  if (!ordinary) return null;
  const labels = actorConditionMovement(token.actor).blocked;
  return labels.length
    ? `${token.actor.name}: ${labels.join(" / ")} prevents movement. End the condition, use GM Displace, or turn off Automate condition movement for a ruling.`
    : null;
}

export function registerConditionMovement() {
  game.settings.register(SCOPE, "automateConditionMovement", {
    name: "Automate condition movement",
    hint: "Prone doubles movement AP; Grappled and Restrained stop ordinary movement. Displace, teleport, undo and manual condition corrections stay available.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SCOPE, "proneStacksWithExhaustion", {
    name: "Multiply Prone and exhaustion movement penalties",
    hint: "Off: use the larger multiplier (×2). On: multiply Prone ×2 by exhaustion ×2 (×4). Notion does not yet specify their combination.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}

async function removeEffects(actor, effects, statusId, change) {
  if (!effects.length) return 0;
  const single = effects.filter(effect => effect.statuses.size === 1);
  // A native effect can contain several statuses: keep its other conditions.
  for (const effect of effects.filter(effect => effect.statuses.size > 1)) {
    const statuses = [...effect.statuses];
    await change(
      () => effect.update({ statuses: statuses.filter(id => id !== statusId) }),
      () => effect.update({ statuses }, { worldsBeyondCorrection: true })
    );
    if (effect.statuses.has(statusId)) throw new Error("The condition was not removed. Correct it on the Status tab.");
  }
  const snapshots = single.map(effect => effect.toObject());
  const ids = single.map(effect => effect.id);
  if (!ids.length) return effects.length;
  // Register compensation before a possibly partial native batch deletion.
  await change(
    () => Promise.resolve(true),
    async () => {
      const missing = snapshots.filter(effect => !actor.effects.get(effect._id));
      if (!missing.length) return true;
      await actor.createEmbeddedDocuments("ActiveEffect", missing, { keepId: true, worldsBeyondCorrection: true });
      return ids.every(id => actor.effects.get(id));
    }
  );
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  if (ids.some(id => actor.effects.get(id))) throw new Error("The condition was not removed. Correct it on the Status tab.");
  return effects.length;
}

export async function standUp(actor, { assisted = false } = {}) {
  if (!actor?.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!actor.statuses?.has("prone")) throw new Error("This character is no longer Prone.");
      if (actorExhaustion(actor).forcedProne && !assisted)
        throw new Error("At exhaustion 9 or higher, standing requires assistance. Confirm assistance or use End for a manual correction.");
      // Standing is a deliberate action, even outside an encounter.
      requireActionCapacity(actor, { ap: 5 });
      const effects = conditionEffects(actor, "prone");
      if (!effects.length) throw new Error("Prone comes from another source. End it at its source or correct the status manually.");
      const ap = inCombat(actor) ? 5 : 0;
      if (ap) await payAp(actor, ap, change);
      requireActionCapacity(actor, { ap: 5 });
      await removeEffects(actor, effects, "prone", change);
      return createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content: `<div class="worlds-beyond wb-ability-card"><h3>Stand up</h3><p>Prone ended${assisted ? " · assisted" : ""}${ap ? " · 5 AP spent" : " · outside combat"}.</p></div>`,
          flags: { [SCOPE]: { sheetActivity: { actorUuid: actor.uuid, label: "Stand up" } } }
        },
        { messageMode: game.settings.get("core", "messageMode") }
      );
    })
  );
}

export async function resolveGrappleEscape(actor, context, roll, change) {
  const escape = context.escapeGrapple;
  if (!escape || context.actorUuid !== actor.uuid || !escapedGrapple(roll?.total, escape.dc, context.success)) return 0;
  // An old roll or Wonder reroll must never remove a new/different grapple.
  const effects = conditionEffects(actor, "grappled").filter(effect => escape.effectIds.includes(effect.id));
  return change ? removeEffects(actor, effects, "grappled", change) : reversibleAction(tx => removeEffects(actor, effects, "grappled", tx));
}

export async function escapeGrapple(actor, { stat = "str", grapplerStr, mode, fearInSight = true, effectId = "" } = {}) {
  if (!actor?.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, () =>
    reversibleAction(async change => {
      if (!["str", "dex"].includes(stat)) throw new Error("Escape using Strength or Dexterity.");
      const dc = grappleEscapeDc(grapplerStr);
      if (!actor.statuses?.has("grappled")) throw new Error("This character is no longer Grappled.");
      requireActionCapacity(actor, { ap: 5 });
      const all = conditionEffects(actor, "grappled");
      if (!effectId && all.length > 1) throw new Error("Several grapples are active. Choose the grapple's Escape button on Status.");
      const effects = effectId ? all.filter(effect => effect.id === effectId) : all;
      if (!effects.length) throw new Error("Grappled comes from another source. End it at its source or correct the status manually.");
      const ap = inCombat(actor) ? 5 : 0;
      if (ap) planApPayment(actor, ap);
      mode ??= defaultCheckMode(actor, "check", { fearInSight });
      const roll = await new foundry.dice.Roll(checkMode(mode).formula, { mod: actor.system.stats[stat].mod }).evaluate({
        allowInteractive: game.settings.get("core", "messageMode") !== "blind"
      });
      const context = {
        kind: "check",
        label: "Escape grapple",
        actorUuid: actor.uuid,
        mode,
        conditionText: conditionRollText(actorConditionRoll(actor, "check", { fearInSight })),
        escapeGrapple: { dc, stat, effectIds: effects.map(effect => effect.id), ap }
      };
      const content = await rollCard(roll, context);
      if (ap) await payAp(actor, ap, change);
      requireActionCapacity(actor, { ap: 5 });
      await resolveGrappleEscape(actor, context, roll, change);
      return createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content,
          rolls: [roll],
          flags: { [SCOPE]: { check: context, sheetActivity: { actorUuid: actor.uuid, label: "Escape grapple" } } }
        },
        { messageMode: game.settings.get("core", "messageMode") }
      );
    })
  );
}

export async function promptMobilityAction(actor, id, effectUuid = "") {
  if (id === "prone") {
    if (!actorExhaustion(actor).forcedProne) return standUp(actor);
    const yes = await foundry.applications.api.DialogV2.confirm({
      classes: [SCOPE, "wb-roll-dialog"],
      window: { title: "Stand with assistance?" },
      content: "<p>Exhaustion prevents standing unaided. Is someone helping this character stand?</p>",
      yes: { label: "Assisted stand" },
      rejectClose: false
    });
    return yes ? standUp(actor, { assisted: true }) : null;
  }
  if (id !== "grappled") return;
  const effectId = conditionEffects(actor, "grappled").find(effect => effect.uuid === effectUuid)?.id ?? "";
  const mode = defaultCheckMode(actor, "check");
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SCOPE, "wb-roll-dialog"],
    position: { width: 380 },
    window: { title: "Escape grapple" },
    ok: { label: "Try escape" },
    rejectClose: false,
    content: await foundry.applications.handlebars.renderTemplate(`systems/${SCOPE}/templates/escape-grapple-dialog.hbs`, {
      dexterity: actor.system.stats.dex.mod > actor.system.stats.str.mod,
      conditions: conditionControls(actor),
      conditionText: conditionRollText(actorConditionRoll(actor, "check")),
      normal: mode === "normal",
      advantage: mode === "advantage",
      disadvantage: mode === "disadvantage"
    }),
    render: (event, dialog) => bindConditionCheck(dialog, actor, "str")
  });
  return choices ? escapeGrapple(actor, { ...choices, effectId }) : null;
}
