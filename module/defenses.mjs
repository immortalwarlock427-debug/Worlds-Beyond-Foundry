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

export function parryReadiness({ dexterity = 12, items = [] } = {}) {
  return {
    unlocked: dexterity >= 21,
    armed: Array.from(items).some(item => ["weapon", "shield"].includes(item.type) && item.system?.equipped)
  };
}

export function parryContext({ target = null, ally = false, overwhelmingForce = false } = {}) {
  return { type: "parry", target: dodgeContext({ target }).target, ally: !!ally, overwhelmingForce: !!overwhelmingForce };
}

export function parryOutcome(context = {}, total, forcedSuccess = false) {
  const result = dodgeOutcome({ target: context.target ?? null }, total, forcedSuccess);
  if (result.success && context.overwhelmingForce) result.damageMultiplier = 0.5;
  return result;
}

// Each hand is a separate incoming attack. Critical range is not natural-20 status.
export function incomingWeaponAttack(data, rolls, index = 0) {
  if (!Number.isInteger(index) || index < 0) return null;
  const hands = Array.isArray(data?.hands) ? data.hands : data ? [data] : [];
  const hand = hands[index];
  if (!hand || hand.hit === false) return null;
  const roll = rolls?.[index];
  const total = hand.total ?? roll?.total;
  const natural = hand.natural ?? roll?.dice?.find(die => die.faces === 20)?.total;
  if (!Number.isFinite(total) || !Number.isFinite(natural)) return null;
  return {
    total, natural20: natural === 20, overwhelmingForce: !!data.overwhelmingForce,
    weaponName: hand.name ?? "Weapon attack", attackerName: data.attackerName ?? "Attack",
    targetName: data.target?.name ?? "", targetActorUuid: data.target?.actorUuid ?? null
  };
}
