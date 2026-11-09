// Notion → Game Systems → Status Effects Explained. Pure roll projections only.
// Movement, spending restrictions, resistance and source-target relationships are
// separate mechanics, not inferred from these dice defaults.
export function conditionRollPlan({
  kind = "attack",
  source = [],
  target = [],
  delivery = "melee",
  distance = null,
  fearInSight = true,
  requiresSight = false,
  requiresHearing = false
} = {}) {
  const own = new Set(source),
    other = new Set(target);
  const advantages = [],
    disadvantages = [],
    failures = [];
  if (kind === "attack") {
    for (const [id, label] of [
      ["blind", "Blinded"],
      ["poison", "Poisoned"],
      ["restrain", "Restrained"]
    ])
      if (own.has(id)) disadvantages.push(label);
    if (own.has("prone") || own.has("unconscious")) disadvantages.push("Prone");
    if (own.has("fear") && fearInSight) disadvantages.push("Frightened: source in sight");
    if (own.has("invisible")) advantages.push("Invisible attacker");
    for (const [id, label] of [
      ["blind", "Blinded"],
      ["restrain", "Restrained"],
      ["paralysis", "Paralyzed"],
      ["stun", "Stunned"],
      ["unconscious", "Unconscious"]
    ])
      if (other.has(id)) advantages.push(`${label} target`);
    if (other.has("invisible")) disadvantages.push("Invisible target");
    if (other.has("prone") || other.has("unconscious"))
      (delivery === "melee" ? advantages : disadvantages).push(`Prone target: ${delivery === "melee" ? "melee" : "ranged"}`);
  }
  if (kind === "check") {
    if (own.has("poison")) disadvantages.push("Poisoned");
    if (own.has("fear") && fearInSight) disadvantages.push("Frightened: source in sight");
    if (own.has("blind") && requiresSight) failures.push("Blinded: this check requires sight");
    if (own.has("deaf") && requiresHearing) failures.push("Deafened: this check requires hearing");
  }
  if (kind === "dodge") {
    if (own.has("blind")) disadvantages.push("Blinded");
    if (own.has("restrain")) disadvantages.push("Restrained");
  }
  return {
    advantages,
    disadvantages,
    failures,
    closeCritical: kind === "attack" && other.has("paralysis") && Number.isFinite(distance) && distance >= 0 && distance <= 5
  };
}

// Provisional cancellation policy: at least one of each defaults to Normal,
// irrespective of how many sources. All reasons and dice remain visible/editable.
export function suggestedMode(plan, extraDisadvantages = []) {
  const advantage = plan.advantages.length > 0;
  const disadvantage = plan.disadvantages.length > 0 || extraDisadvantages.length > 0;
  return advantage === disadvantage ? "normal" : advantage ? "advantage" : "disadvantage";
}

export function conditionRollText(plan) {
  return [
    plan.advantages.length && `Advantage: ${plan.advantages.join("; ")}`,
    plan.disadvantages.length && `Disadvantage: ${plan.disadvantages.join("; ")}`,
    plan.advantages.length && plan.disadvantages.length && "Both apply: Normal by default",
    plan.closeCritical && "Paralyzed within 5 ft: a hit is critical"
  ]
    .filter(Boolean)
    .join(" · ");
}
