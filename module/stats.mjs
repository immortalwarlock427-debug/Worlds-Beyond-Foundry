// Stat definitions and modifier math, kept free of Foundry globals so they can be tested on their own.

export const STATS = [
  { key: "str", abbr: "STR", label: "Strength", group: "physical", milestones: ["Titan's Might", "Overwhelming Force"] },
  { key: "dex", abbr: "DEX", label: "Dexterity", group: "physical", milestones: ["Parry", "Singularity"] },
  { key: "vit", abbr: "VIT", label: "Vitality", group: "physical", milestones: ["Indomitable", "Adamantine Body"] },
  { key: "agl", abbr: "AGL", label: "Agility", group: "physical", milestones: ["Surge", "Flicker"] },
  { key: "int", abbr: "INT", label: "Intelligence", group: "mental", milestones: ["Stratagem", "Absolute Comprehension"] },
  { key: "wis", abbr: "WIS", label: "Wisdom", group: "mental", milestones: ["Sixth Sense", "Eyes of Truth"] },
  { key: "cha", abbr: "CHA", label: "Charisma", group: "mental", milestones: ["Commanding Presence", "Unassailable Self"] },
  { key: "fth", abbr: "FTH", label: "Faith", group: "mental", milestones: ["Defy Fate", "Miracle"] }
];

export const MILESTONE_SCORES = [21, 28];

// Strength and Dexterity: (score - 12) / 2, rounded down.
// Every other stat moves 1 per 3 points away from 12 (13-15 is +1, 9-11 is -1).
export function statModifier(key, score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  if (key === "str" || key === "dex") return Math.floor((s - 12) / 2);
  return s >= 12 ? Math.ceil((s - 12) / 3) : -Math.ceil((12 - s) / 3);
}

export function milestonesReached(score) {
  return MILESTONE_SCORES.filter(m => Number(score) >= m).length;
}

export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
}
