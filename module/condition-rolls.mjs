import { conditionRollPlan, suggestedMode, conditionRollText } from "./condition-rolls-core.mjs";
import { exhaustionMode } from "./exhaustion.mjs";
import { frightenedInSight } from "./frightened.mjs";
import { charmInteractionAdvantage } from "./charmed.mjs";
export { suggestedMode, conditionRollText } from "./condition-rolls-core.mjs";

const SCOPE = "worlds-beyond";
export function conditionRollsAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateConditionRolls") !== false;
  } catch {
    return true;
  }
}
export const statusIds = actor => Array.from(actor?.statuses ?? []);
export function targetStatuses(target) {
  const actor = target?.actorUuid ? globalThis.foundry?.utils?.fromUuidSync?.(target.actorUuid) : null;
  return actor ? statusIds(actor) : (target?.statuses ?? []);
}
export function actorConditionRoll(actor, kind, options = {}) {
  return conditionRollPlan({
    ...options,
    charmedInteraction: conditionRollsAutomated() && kind === "check" && charmInteractionAdvantage(actor, options),
    fearInSight:
      options.fearInSight ?? ((kind === "check" || kind === "attack") && actor?.statuses?.has("fear") ? frightenedInSight(actor) : true),
    kind,
    source: conditionRollsAutomated() ? statusIds(actor) : [],
    target: conditionRollsAutomated() ? (options.target ?? []) : []
  });
}
export function defaultCheckMode(actor, kind, { heavyArmor = false, ...options } = {}) {
  const plan = actorConditionRoll(actor, kind, options);
  return suggestedMode(plan, heavyArmor || exhaustionMode(actor, kind) === "disadvantage" ? ["Disadvantage"] : []);
}
export const conditionControls = actor => ({
  fear: conditionRollsAutomated() && actor?.statuses?.has("fear"),
  fearInSight: actor?.statuses?.has("fear") ? frightenedInSight(actor) : true,
  blind: conditionRollsAutomated() && actor?.statuses?.has("blind"),
  deaf: conditionRollsAutomated() && actor?.statuses?.has("deaf")
});

// Keep defaults/reasons in step with situational controls; changing a radio by
// hand remains authoritative until the player changes a situational control.
export function bindConditionCheck(dialog, actor, statKey) {
  const form = dialog.element;
  const update = () => {
    const kind = form.querySelector('[name="kind"]')?.value ?? "check";
    const interactionControls = form.querySelector("[data-wb-interaction]");
    if (interactionControls) interactionControls.hidden = kind !== "check";
    const interaction = !!form.querySelector('[name="interaction"]')?.checked;
    const interactionTarget = form.querySelector('[name="interactionTarget"]')?.value ?? "";
    for (const name of ["fearInSight", "requiresSight", "requiresHearing"]) {
      const label = form.querySelector(`[name="${name}"]`)?.closest("label");
      if (label) label.hidden = kind !== "check";
    }
    const plan = actorConditionRoll(actor, kind, {
      interaction,
      interactionTarget,
      fearInSight: form.querySelector('[name="fearInSight"]')?.checked,
      requiresSight: !!form.querySelector('[name="requiresSight"]')?.checked,
      requiresHearing: !!form.querySelector('[name="requiresHearing"]')?.checked
    });
    const mode = defaultCheckMode(actor, kind, {
      interaction,
      interactionTarget,
      heavyArmor: kind === "save" && statKey === "agl" && actor.system.equipment?.heavyDisadvantage,
      fearInSight: form.querySelector('[name="fearInSight"]')?.checked
    });
    const radio = form.querySelector(`[name="mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    const text = form.querySelector(".wb-condition-reasons");
    if (text) {
      text.textContent = [...plan.failures, conditionRollText(plan)].filter(Boolean).join(" · ");
      text.hidden = !text.textContent;
    }
  };
  for (const name of ["kind", "fearInSight", "requiresSight", "requiresHearing", "interaction", "interactionTarget"])
    form.querySelector(`[name="${name}"]`)?.addEventListener("change", update);
  update();
}

export function registerConditionRolls() {
  game.settings.register(SCOPE, "automateConditionRolls", {
    name: "Automate status roll effects",
    hint: "Statuses select attack/check/Dodge dice and close Paralyzed criticals. Roll choices and situational checkboxes remain editable. Does not control Bleeding/Burning or exhaustion.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
