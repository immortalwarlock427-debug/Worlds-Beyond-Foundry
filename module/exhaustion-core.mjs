// Foundry-free rules: Notion → Game Systems → Exhaustion Effects Explained.
export const exhaustionLevel = value => Math.max(0, Math.min(10, Math.floor(Number(value) || 0)));

export function exhaustionEffects(value = 0) {
  const level = exhaustionLevel(value);
  return {
    level,
    attackDie: level >= 5 ? "1d8" : level >= 1 ? "1d4" : "",
    apReduction: level >= 6 ? 4 : level >= 2 ? 2 : 0,
    checkDisadvantage: level >= 3,
    movementMultiplier: level >= 4 ? 2 : 1,
    defenseDisadvantage: level >= 7,
    halfHealth: level >= 8,
    forcedProne: level >= 9,
    collapse: level >= 10
  };
}

export function exhaustionSummary(value) {
  const e = exhaustionEffects(value);
  return (
    [
      e.attackDie && `−${e.attackDie} attacks`,
      e.apReduction && `−${e.apReduction} AP/turn`,
      e.checkDisadvantage && "checks at disadvantage",
      e.movementMultiplier > 1 && "movement costs ×2",
      e.defenseDisadvantage && "Dodge/saves at disadvantage",
      e.halfHealth && "half maximum Health",
      e.forcedProne && "Prone; cannot stand unaided",
      e.collapse && "0 Health; Unconscious and Bleeding Out"
    ]
      .filter(Boolean)
      .join(" · ") || "No exhaustion effects"
  );
}

// Preserve current Health when exhaustion changes the maximum; reaching level 8
// clips overflow, rather than accidentally hurting twice through damage storage.
export function exhaustionHealth({ health, maximum, collapse = false }) {
  return maximum - (collapse ? 0 : Math.min(health, maximum));
}
