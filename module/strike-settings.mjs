// World settings for automatic attack resolution. Both default on; the GM can turn
// either off and fall back to the attack card's manual buttons.
const SCOPE = "worlds-beyond";

export function registerStrikeSettings() {
  game.settings.register(SCOPE, "autoResolveAttacks", {
    name: "Automatic attack resolution",
    hint: "Attacks and targeted abilities ask the target to Dodge, Parry, save or Block, then work out the damage. Off: use the attack card's manual buttons.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SCOPE, "autoApplyDamage", {
    name: "Apply damage automatically",
    hint: "Lower the target's Health when an attack resolves. The GM can undo it from the result card. Off: the result card offers an Apply button instead.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

const setting = key => {
  try {
    return game.settings.get(SCOPE, key) !== false;
  } catch {
    return true;
  }
};

// Automation needs a connected GM: only the GM's client can change every combatant's Health.
export const strikeAutomation = () => setting("autoResolveAttacks") && !!game.users?.activeGM;
export const autoApplyDamage = () => setting("autoApplyDamage");
