import { actionCapacity, incapacitationSources } from "./condition-actions-core.mjs";

const SCOPE = "worlds-beyond";
export function incapacitationAutomated() {
  try {
    return globalThis.game?.settings?.get(SCOPE, "automateIncapacitation") !== false;
  } catch {
    return true;
  }
}

export function actorIncapacitation(actor) {
  return incapacitationSources(incapacitationAutomated() ? (actor?.statuses ?? []) : []);
}

export function requireActionCapacity(actor, options = {}) {
  const plan = actionCapacity(incapacitationAutomated() ? (actor?.statuses ?? []) : [], options);
  if (plan.blocked)
    throw new Error(
      `${plan.sources.join(" / ")}: can't spend AP or take reactions. Nothing was spent. For a ruling, turn off Automate incapacitation in world settings.`
    );
}

export function registerConditionActions() {
  game.settings.register(SCOPE, "automateIncapacitation", {
    name: "Automate incapacitation",
    hint: "Incapacitated, Paralyzed, Petrified, Stunned and Unconscious prevent AP spending and reactions. Manual tracker corrections and practice rolls stay available. Independent of status roll effects and exhaustion.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
