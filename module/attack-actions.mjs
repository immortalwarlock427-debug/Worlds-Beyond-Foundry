// Weapon attack dialogs and chat cards. Rules math lives in attacks.mjs.
import { STATS, formatModifier } from "./stats.mjs";
import { checkMode, describeD20Roll } from "./rolls.mjs";
import { SIGNATURE_TEXT } from "./catalog.mjs";
import {
  attackStatChoices, attackModes, attackApCost, attackDisadvantages, critThreshold,
  attackOutcome, damagePlan, effectiveArmor
} from "./attacks.mjs";

const SYSTEM_ID = "worlds-beyond";
const MODE_LABELS = { melee: "Melee", thrown: "Thrown (uses DEX)", ranged: "Ranged" };
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const statLabel = key => STATS.find(stat => stat.key === key)?.label ?? key;

function currentTarget() {
  const token = game.user.targets?.first?.() ?? Array.from(game.user.targets ?? [])[0];
  const actor = token?.actor;
  if (!actor) return null;
  return { name: token.name ?? actor.name, evasion: actor.system?.core?.evasion ?? null, armor: actor.system?.core?.armorRating ?? null };
}

function scores(actor) {
  return Object.fromEntries(STATS.map(({ key }) => [key, actor.system.stats[key].effective ?? actor.system.stats[key].value]));
}

export async function promptAttack(actor, itemId) {
  const weapon = actor.items.get(itemId);
  if (!actor.isOwner || weapon?.type !== "weapon") return;
  const modes = attackModes(weapon);
  const choices = [...new Set(modes.flatMap(mode => attackStatChoices(weapon, mode)))];
  const best = choices.reduce((a, b) => actor.system.stats[b].mod > actor.system.stats[a].mod ? b : a);
  const target = currentTarget();
  const reasons = attackDisadvantages({ weapon, scores: scores(actor), heavyArmor: !!actor.system.equipment?.heavyDisadvantage });
  const content = await foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/attack-dialog.hbs`, {
    reasons, target, apLeft: actor.system.ap.value,
    modes: modes.map(value => ({ value, label: MODE_LABELS[value] })),
    stats: choices.map(key => {
      const mod = actor.system.stats[key].mod;
      return { key, selected: key === best, label: `${statLabel(key)} (${formatModifier(mod)}) · ${attackApCost(mod)} AP` };
    }),
    versatile: !!weapon.system.properties.versatile, damage: weapon.system.damage, versatileDamage: weapon.system.versatileDamage,
    canRange: modes.some(mode => mode !== "melee"), mount: !!weapon.system.properties.mount
  });
  const form = await foundry.applications.api.DialogV2.input({
    classes: [SYSTEM_ID, "wb-roll-dialog"], position: { width: 380 },
    window: { title: `${weapon.name} attack` }, content, ok: { label: "Attack" }, rejectClose: false
  });
  if (!form) return;
  return rollAttack(actor, weapon, { ...form, mode: form.mode ?? modes[0], stat: form.stat ?? best }, target);
}

export async function rollAttack(actor, weapon, options, target = currentTarget()) {
  const mode = options.mode ?? "melee";
  const allowed = attackStatChoices(weapon, mode);
  const stat = allowed.includes(options.stat) ? options.stat : allowed[0];
  const mod = actor.system.stats[stat].mod;
  const cost = attackApCost(mod);
  if (options.spendAp && !(actor.system.ap.value >= cost)) {
    throw new Error(`Not enough AP: this attack costs ${cost} and you have ${actor.system.ap.value}. Untick Spend AP to roll anyway.`);
  }
  const reasons = attackDisadvantages({
    weapon, scores: scores(actor), mode, longRange: !!options.longRange, mounted: !!options.mounted,
    heavyArmor: !!actor.system.equipment?.heavyDisadvantage
  });
  const rollMode = options.rollMode ?? "normal";
  const roll = await new foundry.dice.Roll(checkMode(rollMode).formula, { mod }).evaluate();
  const natural = roll.dice[0]?.total;
  const outcome = attackOutcome({ natural, total: roll.total, evasion: target?.evasion ?? null, threshold: critThreshold(weapon) });
  if (options.spendAp) await actor.update({ "system.ap.value": actor.system.ap.value - cost });

  const breakdown = describeD20Roll(roll, rollMode);
  const result = outcome.hit === null
    ? (outcome.critical === "if it hits" ? `Natural ${natural}: a critical hit if it hits.` : "Compare with the target's Natural Evasion.")
    : outcome.hit ? (outcome.critical ? `Critical hit on ${escapeHTML(target.name)}!` : `Hits ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`)
      : `Misses ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`;
  const lines = [
    `${MODE_LABELS[mode]} attack with ${statLabel(stat)} (${formatModifier(mod)}) · ${checkMode(rollMode).label}`,
    breakdown ? `${breakdown.equation} · ${breakdown.diceText}` : `Total ${roll.total}`,
    result,
    reasons.length ? `Disadvantage applies: ${reasons.join("; ")}.${rollMode === "disadvantage" ? "" : " This roll did not use it."}` : "",
    options.spendAp ? `${cost} AP spent.` : ""
  ].filter(Boolean);
  const content = `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(weapon.name)}</h3>`
    + lines.map(line => `<p>${line}</p>`).join("") + await roll.render() + "</div>";
  return foundry.documents.ChatMessage.implementation.create({
    speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
    content, rolls: [roll],
    flags: { [SYSTEM_ID]: { attack: {
      actorUuid: actor.uuid, itemId: weapon.id, stat, mod, grip: options.grip ?? "one",
      mounted: !!options.mounted, mountedFeet: Number(options.mountedFeet) || 0,
      hit: outcome.hit, critical: outcome.critical, target, damageRolled: false
    } } }
  });
}

export async function rollDamage(message, critical) {
  const data = message.getFlag(SYSTEM_ID, "attack");
  const actor = data && await foundry.utils.fromUuid(data.actorUuid);
  const weapon = actor?.items.get(data.itemId);
  if (!actor?.isOwner || !weapon || data.damageRolled) return;
  const plan = damagePlan({ weapon, level: actor.system.level, modifier: data.mod, grip: data.grip, critical, mounted: data.mounted, mountedFeet: data.mountedFeet });
  if (!plan.formula) throw new Error(`${weapon.name} has no damage to roll.`);
  if (!plan.valid || !foundry.dice.Roll.validate(plan.formula)) throw new Error(`Couldn't read ${weapon.name}'s damage "${plan.listed}". Use dice like 1d8 or 2d6.`);
  await message.setFlag(SYSTEM_ID, "attack", { ...data, damageRolled: true });
  const roll = await new foundry.dice.Roll(plan.formula).evaluate();
  const total = Math.max(0, roll.total);
  const lines = [
    `${total} ${escapeHTML(weapon.system.damageType)} damage${plan.critical ? " (critical: maximum damage plus a second roll)" : ""}.`,
    `${escapeHTML(plan.listed)} rolled ${plan.times}× for level ${actor.system.level}, ${plan.statBonus >= 0 ? "+" : "−"}${Math.abs(plan.statBonus)} from ${statLabel(data.stat)}${plan.mountBonus ? `, +${plan.mountBonus} from the charge` : ""}.`,
    ...plan.notes
  ];
  const target = data.target;
  if (target?.armor != null) {
    const armor = effectiveArmor(target.armor, { twoHanded: plan.twoHanded, puncture: !!weapon.system.signature?.puncture });
    let after = Math.max(0, total - armor);
    const overwhelming = actor.system.stats.str.effective >= 28 || actor.system.stats.str.value >= 28;
    if (overwhelming) after = Math.max(after, Math.floor(total / 2));
    lines.push(`Against ${escapeHTML(target.name)}: ${armor} of their ${target.armor} Armor Rating counts, leaving ${after} before Resistance and Block.${overwhelming ? " Overwhelming Force keeps it at half or more." : ""}`);
  }
  for (const [key, on] of Object.entries(weapon.system.signature ?? {})) {
    if (on && key !== "puncture" && SIGNATURE_TEXT[key]) lines.push(escapeHTML(SIGNATURE_TEXT[key]));
  }
  const content = `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(weapon.name)} damage</h3>`
    + lines.map(line => `<p>${line}</p>`).join("") + await roll.render() + "</div>";
  return foundry.documents.ChatMessage.implementation.create({
    speaker: message.speaker, content, rolls: [roll], whisper: [...message.whisper], blind: message.blind
  });
}

export function decorateAttackMessage(message, html) {
  const data = message.getFlag?.(SYSTEM_ID, "attack");
  const card = html.querySelector(".wb-attack-card");
  if (!data || !card || data.hit === false || card.querySelector(".wb-damage-action")) return;
  const actor = foundry.utils.fromUuidSync(data.actorUuid);
  if (!actor?.isOwner) return;
  const buttons = data.critical === true ? [["Roll critical damage", true]]
    : data.critical === "if it hits" ? [["Roll damage", false], ["Roll critical damage", true]]
      : [["Roll damage", false]];
  for (const [label, critical] of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wb-damage-action";
    button.disabled = !!data.damageRolled;
    button.textContent = data.damageRolled ? "Damage rolled" : label;
    button.addEventListener("click", async () => {
      for (const other of card.querySelectorAll(".wb-damage-action")) other.disabled = true;
      try { await rollDamage(message, critical); }
      catch (error) {
        for (const other of card.querySelectorAll(".wb-damage-action")) other.disabled = false;
        ui.notifications.error(error.message);
      }
    });
    card.append(button);
  }
}
