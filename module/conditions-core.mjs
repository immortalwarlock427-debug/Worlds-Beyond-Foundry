// Foundry-free status conditions from Notion → Game Systems → Status Effects Explained
// (checked 2026-11-09). Ids reuse Foundry's core status ids where one exists, so statuses
// already on tokens keep working.
import { damageMultiplier, actionApCost } from "./attacks.mjs";

export const CONDITIONS = Object.freeze([
  {
    id: "bleeding",
    name: "Bleeding",
    img: "icons/svg/blood.svg",
    description:
      "At the start of its turn, it takes 1d4 damage, plus 1d4 for each of levels 5, 10, 15 and 20 reached by the creature that caused it. Armor Rating doesn't reduce it. Any healing or a successful Shake It Off (DC 12) ends it. Bleeding doesn't stack."
  },
  {
    id: "blind",
    name: "Blinded",
    img: "icons/svg/blind.svg",
    description:
      "Fails all ability checks that require sight. Has disadvantage on attack rolls and Dodges, and attack rolls against it have advantage."
  },
  {
    id: "burning",
    name: "Burning",
    img: "icons/svg/fire.svg",
    description:
      "At the start of its turn, it takes 1d6 fire damage, plus 1d6 for each of levels 5, 10, 15 and 20 reached by the creature that set it alight. Armor Rating doesn't reduce it. It ends when the creature spends 5 AP to put out the flames or enters water."
  },
  {
    id: "charmed",
    name: "Charmed",
    img: "icons/svg/heal.svg",
    description:
      "Can't attack the charmer or target it with harmful effects. The charmer has advantage on rolls to interact with the charmed creature."
  },
  { id: "deaf", name: "Deafened", img: "icons/svg/deaf.svg", description: "Fails all ability checks that require hearing." },
  {
    id: "fear",
    name: "Frightened",
    img: "icons/svg/terror.svg",
    description:
      "Has disadvantage on attack rolls and ability checks while the source of its fear is in its line of sight, and can't willingly move closer to it."
  },
  {
    id: "grappled",
    name: "Grappled",
    img: "icons/svg/padlock.svg",
    description: "Can't move. Escaping costs 5 AP and a Strength or Dexterity check against 12 + the grappler's Strength modifier."
  },
  { id: "incapacitated", name: "Incapacitated", img: "icons/svg/cancel.svg", description: "Can't spend AP or take reactions." },
  {
    id: "invisible",
    name: "Invisible",
    img: "icons/svg/invisible.svg",
    description:
      "Can't be seen without magic or a special sense. Attack rolls against it have disadvantage, and its attack rolls have advantage."
  },
  {
    id: "paralysis",
    name: "Paralyzed",
    img: "icons/svg/paralysis.svg",
    description: "Incapacitated. Attack rolls against it have advantage, and any attack that hits it from within 5ft is a critical hit."
  },
  {
    id: "petrified",
    name: "Petrified",
    img: "icons/svg/statue.svg",
    description:
      "It and all non-magical objects it's wearing are turned to stone. It's incapacitated, resistant to all damage and immune to new status effects."
  },
  { id: "poison", name: "Poisoned", img: "icons/svg/poison.svg", description: "Has disadvantage on attack rolls and ability checks." },
  {
    id: "prone",
    name: "Prone",
    img: "icons/svg/falling.svg",
    description:
      "Moving costs twice as much AP, and standing up costs 5 AP. Has disadvantage on attack rolls. Melee attack rolls against it have advantage, and ranged attack rolls against it have disadvantage."
  },
  {
    id: "restrain",
    name: "Restrained",
    img: "icons/svg/net.svg",
    description: "Can't move. Has disadvantage on attack rolls and Dodges, and attack rolls against it have advantage."
  },
  { id: "stun", name: "Stunned", img: "icons/svg/daze.svg", description: "Incapacitated, and attack rolls against it have advantage." },
  {
    id: "unconscious",
    name: "Unconscious",
    img: "icons/svg/unconscious.svg",
    description:
      "Incapacitated and prone, and drops whatever it's holding. Attack rolls against it have advantage. It wakes when its Health rises to 1 or more. If something other than damage knocked it out, taking damage also wakes it."
  }
]);

export const condition = id => CONDITIONS.find(entry => entry.id === id) ?? null;

// Notion's statuses first, under Notion's names and rules; every other status Foundry or a
// module offers stays available after them.
export function mergeStatusEffects(existing = []) {
  const byId = new Map(existing.map(entry => [entry.id, entry]));
  const ours = CONDITIONS.map(entry => ({ ...(byId.get(entry.id) ?? {}), ...entry }));
  return [...ours, ...existing.filter(entry => !condition(entry.id))];
}

// Damage at the start of the affected creature's turn. The die count grows with the level
// of the creature that caused it, like weapon damage (1 die, +1 at levels 5, 10, 15, 20).
export const TICKS = Object.freeze({
  bleeding: { die: 4, damageType: "", label: "Bleeding" },
  burning: { die: 6, damageType: "Fire", label: "Burning" }
});

export function tickFormula(id, sourceLevel = 1) {
  const tick = TICKS[id];
  if (!tick) return "";
  return `${damageMultiplier(sourceLevel)}d${tick.die}`;
}

// Bleeding: Shake It Off is a Quick action (5 AP) lowered by VIT, a recovery action.
// Burning: putting out the flames costs 5 AP.
export function endActionCost(id, vitModifier = 0) {
  if (id === "bleeding") return actionApCost(5, vitModifier);
  if (id === "burning") return 5;
  return null;
}

export const SHAKE_IT_OFF_DC = 12;

export const shakeItOffSuccess = (total, success = false) => success === true || (Number.isFinite(total) && total >= SHAKE_IT_OFF_DC);
