// Foundry-free defense rules. Ported from the website's defenseResult and
// checked against Notion Defenses. Health changes remain manual in this step.
export function dodgeContext({ against = "attack", target = null, natural20 = false } = {}) {
  if (!["attack", "area"].includes(against)) throw new Error("Choose an attack or an area attack save.");
  const area = against === "area";
  if (!area && natural20) throw new Error("An attack that rolled a natural 20 cannot be Dodged. Use Block or Parry, or correct the incoming attack.");
  const blank = target == null || String(target).trim() === "";
  const value = blank ? null : Number(target);
  if (value !== null && !Number.isFinite(value)) throw new Error("Enter a numeric attack total or save DC, or leave it blank to compare manually.");
  return { type: "dodge", area, target: value };
}

export function dodgeOutcome({ area = false, target = null } = {}, total, forcedSuccess = false) {
  if (!forcedSuccess && (target === null || !Number.isFinite(total))) return { resolved: false, success: false, damageMultiplier: null };
  const success = !!forcedSuccess || (area ? total >= target : total > target);
  return { resolved: true, success, damageMultiplier: success ? (area ? 0.5 : 0) : 1 };
}
