// Weapon attack dialogs and chat cards. Rules math lives in attacks.mjs.
import { STATS, formatModifier } from "./stats.mjs";
import { checkMode, describeD20Roll } from "./rolls.mjs";
import { SIGNATURE_TEXT } from "./catalog.mjs";
import { queuedAction, reversibleAction, createActionMessage } from "./action-support.mjs";
import { fitDialogDisclosures } from "./dialog-layout.mjs";
import {
  attackStatChoices, attackModes, attackApCost, attackDisadvantages, critThreshold,
  attackOutcome, damagePlan, effectiveArmor, dualWieldPartners, shotsLeft, finalDamage, actionApCost, RELOAD_AP
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

// Actions cost AP during a started combat the actor is part of. Outside combat they're free.
export function inCombat(actor) {
  return !!game.combats?.some(combat => combat.started && combat.combatants.some(c => c.actor?.uuid === actor.uuid));
}

function requireLoaded(weapon) {
  if (shotsLeft(weapon) === 0) throw new Error(`${weapon.name} needs reloading first.`);
}

// Older attack cards stored one weapon at the top level.
function attackHands(data) {
  if (Array.isArray(data.hands)) return data.hands;
  return [{ hand: "main", itemId: data.itemId, stat: data.stat, mod: data.mod, grip: data.grip, hit: data.hit, critical: data.critical, damageRolled: data.damageRolled }];
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
  const partners = dualWieldPartners(weapon, actor.items);
  const shots = shotsLeft(weapon);
  const content = await foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/attack-dialog.hbs`, {
    reasons, target, apLeft: actor.system.ap.value, spendAp: inCombat(actor),
    partners: partners.map(item => ({ id: item.id, name: item.name })),
    shots, loading: weapon.system.loading,
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
    window: { title: `${weapon.name} attack` }, content, ok: { label: "Attack" }, rejectClose: false,
    render: (event, dialog) => { bindAttackDialog(dialog.element, actor, weapon); fitDialogDisclosures(dialog); }
  });
  if (!form) return;
  return rollAttack(actor, weapon, { ...form, mode: form.mode ?? modes[0], stat: form.stat ?? best }, target);
}

// Keep the listed disadvantage reasons and the pre-selected dice in step with the
// dialog's choices. The player can still pick any dice after a change.
export function bindAttackDialog(element, actor, weapon) {
  const form = element?.querySelector("form") ?? element;
  const field = name => form?.querySelector(`[name="${name}"]`);
  const text = form?.querySelector(".wb-attack-reasons");
  if (!form || !text) return;
  let previous = null;
  const update = () => {
    const reasons = attackDisadvantages({
      weapon, scores: scores(actor), mode: field("mode")?.value ?? attackModes(weapon)[0],
      longRange: !!field("longRange")?.checked, mounted: !!field("mounted")?.checked,
      heavyArmor: !!actor.system.equipment?.heavyDisadvantage
    });
    text.hidden = !reasons.length;
    text.textContent = reasons.length ? `Disadvantage: ${reasons.join("; ")}.` : "";
    const disadvantage = reasons.length > 0;
    if (disadvantage !== previous) {
      const radio = form.querySelector(`[name="rollMode"][value="${disadvantage ? "disadvantage" : "normal"}"]`);
      if (radio) radio.checked = true;
      previous = disadvantage;
    }
  };
  for (const name of ["mode", "longRange", "mounted"]) field(name)?.addEventListener("change", update);
  update();
}

export async function rollAttack(actor, weapon, options, target = currentTarget()) {
  if (!actor.isOwner || weapon?.type !== "weapon") return;
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const mode = options.mode ?? "melee";
    const offWeapon = options.hands ? actor.items.get(options.hands) : null;
    const weapons = [weapon, ...(offWeapon && dualWieldPartners(weapon, actor.items).includes(offWeapon) ? [offWeapon] : [])];
    const hands = weapons.map((item, index) => {
      const allowed = attackStatChoices(item, mode);
      const stat = allowed.includes(options.stat) ? options.stat : allowed[0];
      return { item, hand: index ? "off" : "main", stat, mod: actor.system.stats[stat].mod };
    });
    for (const { item } of hands) requireLoaded(item);
    // Attacking with both weapons costs the same AP as one attack.
    const cost = attackApCost(hands[0].mod);
    if (options.spendAp && !(actor.system.ap.value >= cost)) {
      throw new Error(`Not enough AP: this attack costs ${cost} and you have ${actor.system.ap.value}. Untick Spend AP to roll anyway.`);
    }
    const rollMode = options.rollMode ?? "normal";
    const sections = [];
    const rolls = [];
    for (const hand of hands) {
      const reasons = attackDisadvantages({
        weapon: hand.item, scores: scores(actor), mode, longRange: !!options.longRange,
        mounted: !!options.mounted, heavyArmor: !!actor.system.equipment?.heavyDisadvantage
      });
      const roll = await new foundry.dice.Roll(checkMode(rollMode).formula, { mod: hand.mod }).evaluate({ allowInteractive: messageMode !== "blind" });
      const natural = roll.dice[0]?.total;
      Object.assign(hand, attackOutcome({ natural, total: roll.total, evasion: target?.evasion ?? null, threshold: critThreshold(hand.item) }));
      const breakdown = describeD20Roll(roll, rollMode);
      const result = hand.hit === null
        ? (hand.critical === "if it hits" ? `Natural ${natural}: a critical hit if it hits.` : "Compare with the target's Natural Evasion.")
        : hand.hit ? (hand.critical ? `Critical hit on ${escapeHTML(target.name)}!` : `Hits ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`)
          : `Misses ${escapeHTML(target.name)} (Natural Evasion ${target.evasion}).`;
      const lines = [
        `${hands.length > 1 ? (hand.hand === "main" ? "Main hand · " : "Off hand · ") : ""}${MODE_LABELS[mode]} attack with ${statLabel(hand.stat)} (${formatModifier(hand.mod)}) · ${checkMode(rollMode).label}`,
        result,
        reasons.length ? `Disadvantage applies: ${reasons.join("; ")}.${rollMode === "disadvantage" ? "" : " This roll did not use it."}` : ""
      ].filter(Boolean);
      sections.push(`<section class="wb-attack-hand" data-hand="${sections.length}">${hands.length > 1 ? `<h4>${escapeHTML(hand.item.name)}</h4>` : ""}`
        + lines.map(line => `<p>${line}</p>`).join("") + await roll.render()
        + (breakdown ? `<p class="wb-dice-results">${breakdown.diceText}</p>` : "") + "</section>");
      rolls.push(roll);
    }
    if (options.spendAp) await change(
      () => actor.update({ "system.ap.value": actor.system.ap.value - cost }),
      () => actor.update({ "system.ap.value": actor.system.ap.value + cost })
    );
    for (const { item } of hands) {
      const shots = shotsLeft(item);
      if (shots !== null) await change(
        () => item.update({ "system.shots": shots - 1 }),
        () => item.update({ "system.shots": shotsLeft(item) + 1 })
      );
    }
    const footer = [
      options.spendAp ? `${cost} AP spent.` : "",
      ...hands.filter(({ item }) => shotsLeft(item) !== null).map(({ item }) => `${escapeHTML(item.name)}: ${shotsLeft(item)} of ${item.system.loading} shots left.`)
    ].filter(Boolean);
    const content = `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(hands.map(({ item }) => item.name).join(" + "))}</h3>`
      + sections.join("") + footer.map(line => `<p>${line}</p>`).join("")
      + (hands.length > 1 ? '<details class="wb-disclosure wb-help"><summary>Two-weapon rules</summary><p>One attack’s AP for both weapons. The off-hand hit deals half damage, rounded down, with no modifier.</p></details>' : "") + "</div>";
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content, rolls,
      flags: { [SYSTEM_ID]: { attack: {
        actorUuid: actor.uuid, target, mounted: !!options.mounted, mountedFeet: Number(options.mountedFeet) || 0,
        hands: hands.map(({ item, hand, stat, mod, hit, critical }) => ({
          hand, itemId: item.id, name: item.name, stat, mod, grip: hand === "main" ? options.grip ?? "one" : "one",
          hit, critical, damageRolled: false
        }))
      } } }
    }, { messageMode });
  }));
}

export async function reloadWeapon(actor, itemId) {
  const messageMode = game.settings.get("core", "messageMode");
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    const weapon = actor.items.get(itemId);
    if (!actor.isOwner || weapon?.type !== "weapon" || !(weapon.system.loading > 0)) return;
    const combat = inCombat(actor);
    const cost = actionApCost(RELOAD_AP, actor.system.stats.dex.mod);
    if (combat && !(actor.system.ap.value >= cost)) throw new Error(`Not enough AP to reload: it costs ${cost} and you have ${actor.system.ap.value}.`);
    if (combat) await change(
      () => actor.update({ "system.ap.value": actor.system.ap.value - cost }),
      () => actor.update({ "system.ap.value": actor.system.ap.value + cost })
    );
    const previous = weapon.system.shots;
    await change(() => weapon.update({ "system.shots": null }), () => weapon.update({ "system.shots": previous }));
    return createActionMessage({
      speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
      content: `<div class="worlds-beyond wb-attack-card"><p>${escapeHTML(weapon.name)} reloaded (${weapon.system.loading} shots)${combat ? ` · ${cost} AP spent` : ""}.</p></div>`
    }, { messageMode });
  }));
}

export async function rollDamage(message, index, critical) {
  if (!message.isContentVisible) return;
  return queuedAction(`${message.uuid ?? message.id}:damage`, () => reversibleAction(async change => {
    const data = structuredClone(message.getFlag(SYSTEM_ID, "attack") ?? null);
    const hands = data ? attackHands(data) : [];
    const hand = hands[index];
    const actor = data && await foundry.utils.fromUuid(data.actorUuid);
    const weapon = actor?.items.get(hand?.itemId);
    if (!actor?.isOwner || !hand || hand.damageRolled) return;
    if (!weapon) throw new Error(`${hand.name ?? "That weapon"} is no longer on this character.`);
    const offhand = hand.hand === "off";
    const plan = damagePlan({
      weapon, level: actor.system.level, modifier: hand.mod, grip: hand.grip, critical, offhand,
      mounted: !offhand && data.mounted, mountedFeet: data.mountedFeet
    });
    if (!plan.formula) throw new Error(`${weapon.name} has no damage to roll.`);
    if (!plan.valid || !foundry.dice.Roll.validate(plan.formula)) throw new Error(`Couldn't read ${weapon.name}'s damage "${plan.listed}". Use dice like 1d8 or 2d6.`);
    const updated = hands.map((entry, i) => i === index ? { ...entry, damageRolled: true } : entry);
    const roll = await new foundry.dice.Roll(plan.formula).evaluate({ allowInteractive: !message.blind });
    const total = finalDamage(roll.total, { offhand });
    const lines = [
      `${total} ${escapeHTML(weapon.system.damageType)} damage${plan.critical ? " (critical: maximum damage plus a second roll)" : ""}${offhand ? ` (half of ${Math.max(0, roll.total)})` : ""}.`,
      `${escapeHTML(plan.listed)} rolled ${plan.times}× for level ${actor.system.level}${offhand ? "" : `, ${plan.statBonus >= 0 ? "+" : "−"}${Math.abs(plan.statBonus)} from ${statLabel(hand.stat)}`}${plan.mountBonus ? `, +${plan.mountBonus} from the charge` : ""}.`,
      ...plan.notes
    ];
    const target = data.target;
    if (target?.armor != null) {
      const armor = effectiveArmor(target.armor, { twoHanded: plan.twoHanded, puncture: !!weapon.system.signature?.puncture });
      let after = Math.max(0, total - armor);
      const overwhelming = (actor.system.stats.str.effective ?? actor.system.stats.str.value) >= 28;
      if (overwhelming) after = Math.max(after, Math.floor(total / 2));
      lines.push(`Against ${escapeHTML(target.name)}: ${armor} of their ${target.armor} Armor Rating counts, leaving ${after} before Resistance and Block.${overwhelming ? " Overwhelming Force keeps it at half or more." : ""}`);
    }
    for (const [key, on] of Object.entries(weapon.system.signature ?? {})) {
      if (on && key !== "puncture" && SIGNATURE_TEXT[key]) lines.push(escapeHTML(SIGNATURE_TEXT[key]));
    }
    const content = `<div class="worlds-beyond wb-attack-card"><h3>${escapeHTML(weapon.name)} damage</h3>`
      + `<p class="wb-result">${lines[0]}</p>` + await roll.render()
      + '<details class="wb-disclosure wb-help"><summary>Damage breakdown</summary>'
      + lines.slice(1).map(line => `<p>${line}</p>`).join("") + "</details></div>";
    await change(() => message.setFlag(SYSTEM_ID, "attack", { ...data, hands: updated }), () => message.setFlag(SYSTEM_ID, "attack", data));
    return createActionMessage({
      speaker: message.speaker, content, rolls: [roll], whisper: [...message.whisper], blind: message.blind
    });
  }));
}

// Foundry shows advantage as "2d20kh1"; show the same plain wording as check cards.
export function d20Mode(formula) {
  return /kh/i.test(formula) ? "advantage" : /kl/i.test(formula) ? "disadvantage" : "normal";
}

function plainD20Formulas(message, card) {
  const sections = card.querySelectorAll(".wb-attack-hand");
  (sections.length ? Array.from(sections) : [card]).forEach((section, index) => {
    const roll = message.rolls?.[index];
    if (!roll?.dice?.some(die => die.faces === 20)) return;
    const breakdown = describeD20Roll(roll, d20Mode(roll.formula));
    if (!breakdown) return;
    const formula = section.querySelector(".dice-formula");
    if (formula) formula.textContent = breakdown.equation;
    for (const label of section.querySelectorAll(".dice-tooltip .part-formula")) label.textContent = breakdown.diceLabel;
  });
}

export function decorateAttackMessage(message, html) {
  if (!message.isContentVisible) return;
  const data = message.getFlag?.(SYSTEM_ID, "attack");
  const card = html.querySelector(".wb-attack-card");
  if (!data || !card) return;
  if (message.isContentVisible) plainD20Formulas(message, card);
  if (card.querySelector(".wb-damage-action")) return;
  const actor = foundry.utils.fromUuidSync(data.actorUuid);
  if (!actor?.isOwner) return;
  const hands = attackHands(data);
  hands.forEach((hand, index) => {
    if (hand.hit === false) return;
    const prefix = hands.length > 1 ? `${hand.hand === "off" ? "Off-hand" : "Main-hand"} ` : "";
    const buttons = hand.critical === true ? [[`Roll ${prefix}critical damage`, true]]
      : hand.critical === "if it hits" ? [[`Roll ${prefix}damage`, false], [`Roll ${prefix}critical damage`, true]]
        : [[`Roll ${prefix}damage`, false]];
    const group = card.querySelector(`.wb-attack-hand[data-hand="${index}"]`) ?? card;
    for (const [label, critical] of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wb-damage-action";
      button.dataset.hand = index;
      button.disabled = !!hand.damageRolled;
      button.textContent = hand.damageRolled ? "Damage rolled" : label;
      button.addEventListener("click", async () => {
        const siblings = card.querySelectorAll(`.wb-damage-action[data-hand="${index}"]`);
        for (const other of siblings) other.disabled = true;
        try { await rollDamage(message, index, critical); }
        catch (error) {
          for (const other of siblings) other.disabled = false;
          ui.notifications.error(error.message);
        }
      });
      group.append(button);
    }
  });
}
