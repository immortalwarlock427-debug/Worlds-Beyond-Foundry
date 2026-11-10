import { queuedAction, reversibleAction } from "./action-support.mjs";
import { damagedHealth } from "./strike-core.mjs";

const SCOPE = "worlds-beyond";

// Call while holding the actor's action queue. Native pre-update hooks can
// reduce a hit (Death's Mercy), so receipts must use the retained Health delta.
export async function applyTurnHealthLoss(actor, requested) {
  if (!(requested > 0)) return 0;
  const before = actor.system.health.damage;
  const saved = await actor.update({ "system.health.damage": damagedHealth(before, requested) }, { worldsBeyondDamage: true });
  if (!saved) throw new Error("The Health update was cancelled; no damage card was posted.");
  return Math.max(0, actor.system.health.damage - before);
}

export async function undoTurnDamage(message, field, { floor = -Infinity } = {}) {
  if (!game.user.isGM) return;
  return queuedAction(`turnDamage:${message.id}`, async () => {
    const receipt = message.getFlag(SCOPE, field);
    if (!receipt || receipt.applied === false || receipt.undone || !(receipt.amount > 0)) return;
    const actor = await foundry.utils.fromUuid(receipt.actorUuid);
    if (!actor) throw new Error("That character no longer exists. Correct Health on its sheet.");
    return queuedAction(actor.uuid, () =>
      reversibleAction(async change => {
        const data = message.getFlag(SCOPE, field);
        if (!data || data.undone || data.applied === false || data.actorUuid !== actor.uuid || !(data.amount > 0)) return;
        const before = actor.system.health.damage;
        await change(
          () => actor.update({ "system.health.damage": Math.max(floor, before - data.amount) }, { worldsBeyondCorrection: true }),
          () => actor.update({ "system.health.damage": before }, { worldsBeyondCorrection: true })
        );
        if (!(await message.setFlag(SCOPE, field, { ...data, undone: true })))
          throw new Error("The damage receipt was not saved; Undo was cancelled.");
        return message;
      })
    );
  });
}
