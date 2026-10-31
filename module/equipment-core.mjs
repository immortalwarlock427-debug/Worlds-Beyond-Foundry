// Foundry-free armor rules from Notion's Armor Types Information.
import { numberOr } from "./core-numbers.mjs";

export function wornEquipment({ items = [], agility = 12, strength = 12, penaltyOverride = null } = {}) {
  const armor = Array.from(items).filter(item => item.type === "armor" && item.system.equipped);
  const shields = Array.from(items).filter(item => item.type === "shield" && item.system.equipped);
  const rank = { light: 1, medium: 2, heavy: 3 };
  const type = armor.reduce((type, item) => (rank[item.system.armorType] ?? 0) > (rank[type] ?? 0) ? item.system.armorType : type, "none");
  // Arm guards give one AR contribution even when both arms have separate records.
  const arms = armor.filter(item => item.system.piece === "arms");
  const other = armor.filter(item => item.system.piece !== "arms");
  const sum = (list, field) => list.reduce((total, item) => total + numberOr(item.system[field], 0), 0);
  const armorAR = sum(other, "armorRating") + (arms.length ? Math.max(...arms.map(item => numberOr(item.system.armorRating, 0))) : 0);
  const shieldAR = sum(shields, "armorRating");
  const evasion = type === "light" ? sum(armor.filter(item => item.system.armorType === "light"), "evasionBonus") : 0;
  const automaticPenalty = type === "heavy" ? Math.min(3, Math.max(0, armorAR - 3)) : 0;
  const agilityPenalty = numberOr(penaltyOverride, automaticPenalty);
  return {
    type, armorAR, shieldAR, armor: armorAR + shieldAR, evasion,
    automaticPenalty, agilityPenalty, effectiveAgility: numberOr(agility, 12) - agilityPenalty,
    heavyDisadvantage: type === "heavy" && numberOr(strength, 12) < 21,
    squareCost: type === "heavy" ? 10 : 5, difficultSquareCost: type === "heavy" ? 20 : 10,
    blockDice: shields.map(item => String(item.system.blockDie ?? "1d6")),
    duplicatePieces: [...new Set(armor.map(item => item.system.piece))].filter(piece => piece !== "arms" && armor.filter(item => item.system.piece === piece).length > 1)
  };
}
