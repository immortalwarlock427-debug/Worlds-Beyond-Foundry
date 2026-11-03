import { hitDicePool, restDiceCount, shortRestHealing } from "./rest-core.mjs";
import { queuedAction, createActionMessage } from "./action-support.mjs";
import { fitDialogDisclosures } from "./dialog-layout.mjs";
import { formatModifier } from "./stats.mjs";
import { wholeNumber } from "./number-display.mjs";

const SCOPE = "worlds-beyond";
const render = (name, context) => foundry.applications.handlebars.renderTemplate(`systems/${SCOPE}/templates/${name}.hbs`, context);
const fullHealth = actor => {
  if (actor.system.health.damage > 0) return false;
  ui.notifications.info("You are at full Health. No hit dice were spent.");
  return true;
};

export async function promptShortRest(actor) {
  if (!actor.isOwner || actor.type !== "character" || fullHealth(actor)) return;
  const pool = hitDicePool(actor.system);
  restDiceCount(actor.system);
  const choice = await foundry.applications.api.DialogV2.input({
    classes: [SCOPE, "wb-roll-dialog"],
    position: { width: 360 },
    window: { title: "Short rest" },
    content: await render("short-rest-dialog", {
      ...pool,
      die: actor.system.core.hitDie,
      modifier: formatModifier(actor.system.stats.vit.mod)
    }),
    ok: { label: "Roll & heal" },
    render: (_event, dialog) => fitDialogDisclosures(dialog),
    rejectClose: false
  });
  if (!choice) return;
  return shortRest(actor, choice.count);
}

export async function shortRest(actor, requested = 1) {
  if (!actor.isOwner || actor.type !== "character") return;
  return queuedAction(actor.uuid, async () => {
    if (!actor.isOwner || fullHealth(actor)) return;
    const count = restDiceCount(actor.system, requested);
    const die = actor.system.core.hitDie;
    const mod = actor.system.stats.vit.mod;
    const messageMode = game.settings.get("core", "messageMode");
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const roll = new foundry.dice.Roll(`(${die}) + @mod`, { mod });
      await roll.evaluate({ allowInteractive: messageMode !== "blind" });
      rolls.push(roll);
    }
    // Recheck after interactive dice: another client may have healed or rested.
    if (!actor.isOwner || fullHealth(actor)) return;
    const plan = shortRestHealing(
      actor.system,
      rolls.map(roll => roll.total)
    );
    const previous = {
      "system.hitDice.spent": actor.system.hitDice.spent,
      "system.health.damage": actor.system.health.damage
    };
    const maximum = actor.system.health.max;
    const content = await render("short-rest-card", {
      count,
      remaining: plan.remaining,
      max: plan.max,
      healed: wholeNumber(maximum - plan.damage) - wholeNumber(actor.system.health.value),
      health: wholeNumber(maximum - plan.damage),
      healthMax: wholeNumber(maximum),
      rows: rolls.map(roll => ({ dice: wholeNumber(roll.total - mod), modifier: formatModifier(mod), total: wholeNumber(roll.total) })),
      rollHTML: (await Promise.all(rolls.map(roll => roll.render()))).join("")
    });
    const changes = { "system.hitDice.spent": plan.spent, "system.health.damage": plan.damage };
    if (!actor.isOwner) return;
    if (
      actor.system.health.damage !== previous["system.health.damage"] ||
      actor.system.hitDice.spent !== previous["system.hitDice.spent"] ||
      actor.system.health.max !== maximum ||
      actor.system.level !== plan.max
    )
      throw new Error("Your Health or hit-die pool changed. Open Short rest again.");
    let saved = false,
      verified = false;
    try {
      saved = !!(await actor.update(changes));
      if (!saved) throw new Error("The short rest was cancelled. No healing result was posted.");
      verified = actor.system.hitDice.spent === plan.spent && actor.system.health.damage === plan.damage;
      if (!verified) throw new Error("Short-rest healing or hit-die spending was not retained.");
      return await createActionMessage(
        {
          speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
          content,
          rolls,
          flags: { [SCOPE]: { shortRest: { actorUuid: actor.uuid, count, healed: plan.healed } } }
        },
        { messageMode }
      );
    } catch (error) {
      if (!saved) throw error;
      const undo = verified
        ? {
            "system.hitDice.spent": Math.max(0, actor.system.hitDice.spent - count),
            "system.health.damage": actor.system.health.damage + plan.healed
          }
        : previous;
      const restored = await actor.update(undo).catch(() => null);
      if (
        !restored ||
        actor.system.hitDice.spent !== undo["system.hitDice.spent"] ||
        actor.system.health.damage !== undo["system.health.damage"]
      )
        throw new Error("Short rest failed. Correct Health and Hit dice spent on the sheet; recovery also failed.", { cause: error });
      throw error;
    }
  });
}
