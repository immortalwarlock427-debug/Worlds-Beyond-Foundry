// Automatic attack resolution. The active GM's client runs each exchange: it asks the
// target's owner what to do, rolls damage and changes Health. Rules live in strike-core.mjs.
import { STATS, formatModifier } from "./stats.mjs";
import { damagePlan, finalDamage } from "./attacks.mjs";
import { queuedAction, createActionMessage } from "./action-support.mjs";
import { inCombat } from "./combat-support.mjs";
import { wholeNumber } from "./number-display.mjs";
import { autoApplyDamage, registerStrikeSettings } from "./strike-settings.mjs";
import {
  strikeInfo,
  defenderState,
  avoidOptions,
  canBlock,
  avoidOutcome,
  resistantTo,
  strikeDamage,
  damagedHealth,
  abilityDamagePlan
} from "./strike-core.mjs";

const SYSTEM_ID = "worlds-beyond";
const SOCKET = `system.${SYSTEM_ID}`;
const KIND_LABELS = { dodge: "Dodge", parry: "Parry", save: "Save", block: "Block", take: "No defense" };
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const statLabel = key => STATS.find(stat => stat.key === key)?.label ?? key;
const openPrompts = new Set();

const attackData = message => message?.getFlag?.(SYSTEM_ID, "attack") ?? null;
const strikeState = message => message?.getFlag?.(SYSTEM_ID, "strike") ?? null;
// Area abilities give each hand its own target; weapon attacks share the card's target.
const targetOf = (data, index = 0) => data?.hands?.[index]?.target ?? data?.target ?? null;
const defenderOf = (data, index = 0) => {
  const uuid = targetOf(data, index)?.actorUuid;
  return uuid ? foundry.utils.fromUuidSync(uuid) : null;
};

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

export function registerStrikes() {
  registerStrikeSettings();
  Hooks.once("ready", () => game.socket.on(SOCKET, onSocket));
  Hooks.on("createChatMessage", message => {
    if (!game.user.isActiveGM || !attackData(message)?.automated || strikeState(message)) return;
    beginStrike(message).catch(error => ui.notifications.error(`Attack resolution: ${error.message}`));
  });
  Hooks.on("renderChatMessageHTML", decorateStrike);
  Hooks.on("renderChatMessageHTML", decorateStrikeResult);
}

function onSocket(payload) {
  if (payload?.type === "strikePrompt" && payload.userId === game.user.id) {
    showDefensePrompt(payload.messageId, payload.index, payload.snapshot).catch(error => ui.notifications.error(error.message));
  } else if (payload?.type === "strikeResult" && game.user.isActiveGM) {
    handleStrikeResult(payload, payload.userId).catch(error => ui.notifications.error(`Attack resolution: ${error.message}`));
  }
}

/* -------------------------------------------- */
/*  GM: running an exchange                     */
/* -------------------------------------------- */

// The owner who answers for the target: their assigned player, another owning player, or the GM.
export function answeringUser(actor) {
  const owners = game.users.filter(user => user.active && !user.isGM && actor.testUserPermission(user, "OWNER"));
  return owners.find(user => user.character?.id === actor.id) ?? owners[0] ?? game.users.activeGM ?? game.user;
}

function defenderSituation(actor) {
  return defenderState({
    inCombat: inCombat(actor),
    reactions: actor.system.reactions?.value,
    parry: parrySituation(actor),
    resistances: actor.system.resistances,
    armor: actor.system.core?.armorRating
  });
}

function parrySituation(actor) {
  const dex = actor.system.stats?.dex?.effective ?? actor.system.stats?.dex?.value ?? 12;
  const armed = actor.items.some(item => ["weapon", "shield"].includes(item.type) && item.system?.equipped);
  const combat = game.combats?.find(combat => combat.started && combat.combatants.some(c => c.actor?.uuid === actor.uuid));
  const used = !!combat && actor.getFlag(SYSTEM_ID, "parryUses")?.[combat.id] === combat.round;
  return { unlocked: dex >= 21, armed, used };
}

async function saveState(message, state) {
  const result = await message.setFlag(SYSTEM_ID, "strike", state);
  if (!result) throw new Error("The attack card could not be updated.");
}

export async function beginStrike(message) {
  return queuedAction(`strike:${message.id}`, async () => {
    if (!game.user.isActiveGM || strikeState(message)) return;
    const data = attackData(message);
    const exchanges = (data?.hands ?? []).map((hand, index) => {
      if (!defenderOf(data, index)) return { index, status: "manual", step: "done", note: "The target is no longer on the map." };
      if (hand.hit === false) return { index, status: "done", step: "done", outcome: "miss", used: [], log: [] };
      if (hand.hit == null) return { index, status: "manual", step: "done", note: "Compare the attack with the target's Natural Evasion." };
      return { index, status: "waiting", step: "avoid", used: [], log: [] };
    });
    await saveState(message, { exchanges });
    await advance(message);
  });
}

// Move every open exchange forward. Different targets are asked at the same time;
// one target's hands (two-weapon attacks) are asked one after another.
async function advance(message) {
  for (let guard = 0; guard < 100; guard++) {
    const state = strikeState(message);
    const data = attackData(message);
    const busy = new Set();
    let progressed = false;
    for (const ex of state?.exchanges ?? []) {
      if (ex.status !== "waiting") continue;
      const key = targetOf(data, ex.index)?.actorUuid ?? `hand${ex.index}`;
      if (busy.has(key)) continue;
      busy.add(key);
      if (ex.prompt) continue;
      await stepExchange(message, ex.index);
      progressed = true;
      break;
    }
    if (!progressed) return;
  }
}

// Settle a step with only one sensible choice, or ask the target's owner.
async function stepExchange(message, index) {
  const state = strikeState(message);
  const ex = state.exchanges[index];
  const data = attackData(message);
  const defender = defenderOf(data, index);
  const strike = strikeInfo(data, index);
  const situation = defenderSituation(defender);
  if (ex.step === "avoid" && avoidOptions(strike, situation, ex.used).length === 1) return takeDamage(message, index, 1, false);
  if (ex.step === "block" && !canBlock(situation, ex.used, ex.afterArmor, strike)) return finish(message, index, 0);
  const user = answeringUser(defender);
  const next = foundry.utils.deepClone(state);
  next.exchanges[index].prompt = { token: foundry.utils.randomID(), userId: user.id, step: ex.step };
  await saveState(message, next);
  if (user.id === game.user.id) void showDefensePrompt(message.id, index).catch(error => ui.notifications.error(error.message));
  // Send what the popup needs: a privately rolled attack card never reaches the player's client.
  else
    game.socket.emit(SOCKET, {
      type: "strikePrompt",
      userId: user.id,
      messageId: message.id,
      index,
      snapshot: { data, exchange: next.exchanges[index] }
    });
}

export async function handleStrikeResult({ messageId, index, token, choice, rollMessageId }, userId) {
  return queuedAction(`strike:${messageId}`, async () => {
    const message = game.messages.get(messageId);
    const state = strikeState(message);
    const ex = state?.exchanges?.[index];
    if (!ex || ex.status !== "waiting" || ex.prompt?.token !== token) return;
    const data = attackData(message);
    const defender = defenderOf(data, index);
    const user = game.users.get(userId);
    if (!defender || !user || !(user.isGM || defender.testUserPermission(user, "OWNER"))) return;
    const strike = strikeInfo(data, index);
    const roll = choice === "take" ? null : defenseTotal(await findMessage(rollMessageId), choice, defender, userId);
    const total = roll?.total ?? null;
    const next = foundry.utils.deepClone(state);
    const entry = next.exchanges[index];
    entry.prompt = null;
    if (ex.step === "block") {
      entry.used.push(...(choice === "block" ? ["block"] : []));
      entry.log.push({ kind: choice, total });
      await saveState(message, next);
      await finish(message, index, choice === "block" ? total : 0);
      return advance(message);
    }
    const outcome = avoidOutcome(strike, choice, total, !!roll?.forced);
    if (["dodge", "parry"].includes(choice)) entry.used.push(choice);
    entry.log.push({ kind: choice, total, success: outcome.success, ...(roll?.wonder ? { wonder: roll.wonder } : {}) });
    await saveState(message, next);
    if (choice === "dodge" && outcome.success && strike.check !== "area") await settle(message, index, "dodged");
    else if (choice === "parry" && outcome.success && !strike.overwhelming) await settle(message, index, "parried");
    else if (choice === "save" && outcome.negated) await settle(message, index, "resisted");
    else if (outcome.done || (choice === "parry" && outcome.success))
      await takeDamage(message, index, outcome.multiplier, choice === "parry" && outcome.success);
    return advance(message);
  });
}

// The defender's roll card can arrive a moment after their socket message.
async function findMessage(id) {
  for (let attempt = 0; attempt < 20 && id; attempt++) {
    const message = game.messages.get(id);
    if (message) return message;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

// Accept only the defender's own fresh roll of the chosen kind.
function defenseTotal(roll, choice, defender, userId) {
  const check = roll?.getFlag?.(SYSTEM_ID, "check");
  const reaction = roll?.getFlag?.(SYSTEM_ID, "reaction");
  const matches =
    choice === "dodge"
      ? check?.defense?.type === "dodge"
      : choice === "parry"
        ? check?.defense?.type === "parry"
        : choice === "save"
          ? check?.kind === "save"
          : choice === "block" && reaction?.kind === "block";
  const owner = (check?.actorUuid ?? reaction?.actorUuid) === defender.uuid;
  if (!roll || roll.author?.id !== userId || !matches || !owner)
    throw new Error("That defense roll doesn't match the attack. Respond again from the attack card.");
  const total = roll.rolls?.[0]?.total;
  if (!Number.isFinite(total)) throw new Error("That defense roll has no total. Respond again from the attack card.");
  // A Wonder result keeps the original's context; Defy Fate marks it a success.
  const wonder = check?.previousMessageId ? (check.success ? "Defy Fate" : "Wonder") : null;
  return { total, forced: !!check?.success, wonder };
}

// Roll damage on the GM's client, then offer Block if anything gets through Armor Rating.
async function takeDamage(message, index, multiplier, negated) {
  const data = attackData(message);
  // An area rolls its damage once for every target (Notion: one roll, each target defends).
  const shared = data.ability?.area ? strikeState(message).sharedDamage : null;
  const rolled = shared ?? (await rollStrikeDamage(data, index));
  const state = foundry.utils.deepClone(strikeState(message));
  const entry = state.exchanges[index];
  const defender = defenderOf(data, index);
  const roll = shared ? shared.roll : (rolled.roll?.toJSON() ?? null);
  if (data.ability?.area && !shared) state.sharedDamage = { total: rolled.total, roll, info: rolled.info };
  entry.damage = { ...rolled.info, rolled: rolled.total, roll, multiplier, negated, shared: !!shared };
  const preview = strikeDamage(mitigation(entry.damage, strikeInfo(data, index), defender, 0));
  entry.afterArmor = preview.afterArmor;
  entry.step = negated ? "done" : "block";
  await saveState(message, state);
  if (negated) return finish(message, index, 0);
}

function mitigation(damage, strike, defender, block) {
  return {
    rolled: damage.rolled,
    multiplier: damage.multiplier,
    negated: damage.negated,
    resistant: resistantTo(defender.system.resistances, damage.damageType || strike.damageType),
    armor: defender.system.core?.armorRating ?? 0,
    twoHanded: !!damage.twoHanded,
    puncture: !!damage.puncture,
    overwhelming: strike.overwhelming,
    block: finalDamage(block)
  };
}

export async function rollStrikeDamage(data, index) {
  const hand = data.hands[index];
  const attacker = await foundry.utils.fromUuid(data.actorUuid);
  if (!attacker) throw new Error("The attacker no longer exists.");
  let formula = "",
    info = {};
  if (data.ability) {
    const plan = abilityDamagePlan({ formula: data.ability.damage, modifier: hand.mod, critical: hand.critical === true });
    formula = plan.formula;
    info = {
      label: data.ability.name,
      damageType: data.ability.damageType ?? "",
      critical: plan.critical,
      twoHanded: false,
      puncture: false
    };
  } else {
    const weapon = attacker.items.get(hand.itemId);
    if (!weapon) throw new Error(`${hand.name ?? "That weapon"} is no longer on ${attacker.name}.`);
    const offhand = hand.hand === "off";
    const plan = damagePlan({
      weapon,
      level: attacker.system.level,
      modifier: hand.mod,
      grip: hand.grip,
      critical: hand.critical === true,
      offhand,
      mounted: !offhand && data.mounted,
      mountedFeet: data.mountedFeet
    });
    if (!plan.valid) throw new Error(`Couldn't read ${weapon.name}'s damage "${plan.listed}".`);
    formula = plan.formula;
    info = {
      label: weapon.name,
      damageType: weapon.system.damageType ?? "",
      critical: plan.critical,
      twoHanded: plan.twoHanded,
      puncture: !!weapon.system.signature?.puncture,
      notes: plan.notes
    };
  }
  if (!formula) return { total: 0, roll: null, info: { ...info, formula: "" } };
  if (!foundry.dice.Roll.validate(formula)) throw new Error(`Couldn't roll damage "${formula}".`);
  const roll = await new foundry.dice.Roll(formula).evaluate();
  return { total: finalDamage(roll.total), roll, info: { ...info, formula } };
}

async function settle(message, index, outcome) {
  const state = foundry.utils.deepClone(strikeState(message));
  Object.assign(state.exchanges[index], { status: "done", step: "done", outcome, prompt: null });
  await saveState(message, state);
  await postResult(message, index, { outcome, amount: 0 });
}

async function finish(message, index, block) {
  const data = attackData(message);
  const defender = defenderOf(data, index);
  const state = foundry.utils.deepClone(strikeState(message));
  const entry = state.exchanges[index];
  const breakdown = strikeDamage(mitigation(entry.damage, strikeInfo(data, index), defender, block));
  let applied = false,
    previous = null;
  if (breakdown.total > 0 && autoApplyDamage()) {
    previous = defender.system.health.damage;
    const result = await defender.update({ "system.health.damage": damagedHealth(previous, breakdown.total) });
    applied = !!result;
  }
  Object.assign(entry, { status: "done", step: "done", outcome: "hit", prompt: null, total: breakdown.total, applied });
  await saveState(message, state);
  await postResult(message, index, { outcome: "hit", amount: breakdown.total, breakdown, applied, previous });
}

/* -------------------------------------------- */
/*  Result cards                                */
/* -------------------------------------------- */

function resultAudience(message, defender) {
  if (!message.whisper?.length) return {};
  const owners = game.users.filter(user => defender?.testUserPermission(user, "OWNER")).map(user => user.id);
  return { whisper: [...new Set([...message.whisper, ...owners])], blind: message.blind };
}

function defenseLine(entry) {
  return (entry.log ?? [])
    .filter(step => step.kind !== "take")
    .map(step =>
      step.kind === "block"
        ? `Block ${wholeNumber(step.total)}.`
        : step.wonder === "Defy Fate"
          ? `${KIND_LABELS[step.kind]}: success with Defy Fate.`
          : `${KIND_LABELS[step.kind]} ${wholeNumber(step.total)}${step.wonder ? " after Wonder" : ""}: ${step.success ? "success" : "failed"}.`
    )
    .join(" ");
}

async function postResult(message, index, { outcome, amount, breakdown = null, applied = false, previous = null }) {
  const data = attackData(message);
  const defender = defenderOf(data, index);
  const entry = strikeState(message).exchanges[index];
  const strike = strikeInfo(data, index);
  const name = escapeHTML(targetOf(data, index)?.name ?? defender?.name ?? "The target");
  const headline = {
    dodged: `${name} dodges ${escapeHTML(strike.name)}.`,
    parried: `${name} parries ${escapeHTML(strike.name)}.`,
    resisted: `${name} resists ${escapeHTML(strike.name)}.`,
    hit:
      amount > 0
        ? `${name} takes ${wholeNumber(amount)} ${escapeHTML(entry.damage?.damageType || "")} damage.`.replace(/\s+damage/, " damage")
        : `${name} takes no damage.`
  }[outcome];
  const lines = [defenseLine(entry)];
  if (breakdown) {
    const parts = [`Rolled ${wholeNumber(breakdown.original)}`];
    if (breakdown.halved !== breakdown.original) parts.push(`halved to ${wholeNumber(breakdown.halved)}`);
    if (breakdown.afterResistance !== breakdown.halved) parts.push(`Resistance → ${wholeNumber(breakdown.afterResistance)}`);
    if (breakdown.armor) parts.push(`Armor Rating ${wholeNumber(breakdown.armor)} → ${wholeNumber(breakdown.afterArmor)}`);
    if (breakdown.block) parts.push(`Block ${wholeNumber(breakdown.block)} → ${wholeNumber(breakdown.afterBlock)}`);
    if (breakdown.total > breakdown.afterBlock) parts.push(`Overwhelming Force → ${wholeNumber(breakdown.total)}`);
    lines.push(`${parts.join(" · ")}.`);
    if (amount > 0 && !applied)
      lines.push(autoApplyDamage() ? "Health was not changed. Apply it from this card." : "Automatic damage is off.");
  }
  const roll = entry.damage?.roll ? foundry.dice.Roll.fromData(entry.damage.roll) : null;
  const content =
    `<div class="worlds-beyond wb-attack-card wb-strike-result"><h3>${escapeHTML(strike.name)} → ${name}</h3>` +
    `<p class="wb-result">${headline}</p>` +
    lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("") +
    (roll ? `<details class="wb-disclosure"><summary>Damage roll</summary>${await roll.render()}</details>` : "") +
    "</div>";
  return createActionMessage({
    speaker: message.speaker,
    content,
    rolls: roll && !entry.damage?.shared ? [roll] : [],
    ...resultAudience(message, defender),
    flags: {
      [SYSTEM_ID]: {
        strikeResult: {
          messageId: message.id,
          index,
          actorUuid: targetOf(data, index)?.actorUuid,
          amount,
          applied,
          previous,
          undone: false
        }
      }
    }
  });
}

// GM: apply a result that wasn't applied, or undo one that was.
export async function changeResultHealth(message, operation) {
  if (!game.user.isGM) return;
  return queuedAction(`strikeResult:${message.id}`, async () => {
    const result = message.getFlag(SYSTEM_ID, "strikeResult");
    const actor = result?.actorUuid ? await foundry.utils.fromUuid(result.actorUuid) : null;
    if (!actor) throw new Error("The target no longer exists. Correct Health on its sheet.");
    const amount = Math.max(0, Number(result.amount) || 0);
    const current = actor.system.health.damage;
    if (operation === "undo" && result.applied && !result.undone) {
      await actor.update({ "system.health.damage": current - amount });
      await message.setFlag(SYSTEM_ID, "strikeResult", { ...result, undone: true });
    } else if (operation === "apply" && (!result.applied || result.undone)) {
      await actor.update({ "system.health.damage": damagedHealth(current, amount) });
      await message.setFlag(SYSTEM_ID, "strikeResult", { ...result, applied: true, undone: false });
    }
  });
}

/* -------------------------------------------- */
/*  Defender popup                              */
/* -------------------------------------------- */

export async function showDefensePrompt(messageId, index, snapshot = null) {
  const message = game.messages.get(messageId);
  const data = snapshot?.data ?? attackData(message);
  const ex = snapshot?.exchange ?? strikeState(message)?.exchanges?.[index];
  const defender = defenderOf(data, index);
  if (!ex?.prompt || ex.status !== "waiting" || !defender?.isOwner) return;
  const key = `${messageId}:${index}:${ex.prompt.token}`;
  if (openPrompts.has(key)) return;
  openPrompts.add(key);
  try {
    const strike = strikeInfo(data, index);
    const situation = defenderSituation(defender);
    const block = ex.step === "block";
    const options = block
      ? [
          ...(canBlock(situation, ex.used, ex.afterArmor, strike)
            ? [{ kind: "block", label: `Block (${defender.system.block?.formula ?? "1d4"} + STR)` }]
            : []),
          { kind: "take", label: `Take ${wholeNumber(ex.afterArmor)}` }
        ]
      : avoidOptions(strike, situation, ex.used);
    const content = promptContent({ strike, ex, defender, situation, block, options });
    const choice = await foundry.applications.api.DialogV2.wait({
      classes: [SYSTEM_ID, "wb-roll-dialog", "wb-defense-prompt"],
      position: { width: 420 },
      window: { title: `${defender.name}: ${block ? "Block?" : "Incoming attack"}` },
      content,
      rejectClose: false,
      buttons: options.map((option, i) => ({
        action: option.kind,
        label: option.label,
        default: i === 0,
        callback: (event, button) => ({
          kind: option.kind,
          mode: button.form?.elements.mode?.value || "auto",
          stat: button.form?.elements.stat?.value || option.stat || ""
        })
      }))
    });
    if (!choice) return;
    const rollMessage = await offerWonder(defender, strike, choice.kind, await rollDefense(defender, strike, choice));
    const payload = {
      type: "strikeResult",
      messageId,
      index,
      token: ex.prompt.token,
      choice: choice.kind,
      rollMessageId: rollMessage?.id ?? null,
      userId: game.user.id
    };
    if (game.user.isActiveGM) await handleStrikeResult(payload, game.user.id);
    else game.socket.emit(SOCKET, payload);
  } finally {
    openPrompts.delete(key);
  }
}

function promptContent({ strike, ex, defender, situation, block, options }) {
  const reactions = Number.isFinite(situation.reactionsLeft)
    ? `${wholeNumber(situation.reactionsLeft)} reaction${situation.reactionsLeft === 1 ? "" : "s"} left.`
    : "";
  const lines = [];
  if (block) {
    lines.push(`<p class="wb-result">${wholeNumber(ex.afterArmor)} damage gets past your Armor Rating.</p>`);
    if (strike.overwhelming) lines.push("<p>Overwhelming Force: at least half the rolled damage still lands.</p>");
  } else if (strike.check === "save") {
    lines.push(
      `<p class="wb-result">${escapeHTML(strike.attackerName)} uses ${escapeHTML(strike.name)} on you: save against DC ${wholeNumber(strike.dc)}.</p>`
    );
    lines.push(`<p>${strike.onSave === "half" ? "A success halves the damage." : "A success avoids it."}</p>`);
  } else {
    lines.push(
      `<p class="wb-result">${escapeHTML(strike.attackerName)} hits you with ${escapeHTML(strike.name)}: ${wholeNumber(strike.total)} to hit${strike.natural20 ? " (natural 20)" : ""}.</p>`
    );
    if (strike.natural20) lines.push("<p>A natural 20 can't be dodged.</p>");
  }
  if (ex.log?.length) lines.push(`<p>${defenseLine(ex)}</p>`);
  if (reactions) lines.push(`<p class="wb-dialog-meta">${reactions}</p>`);
  const fields = [];
  if (options.some(option => option.kind === "save" && !option.stat)) {
    const best = STATS.reduce((a, b) => (defender.system.stats[b.key].mod > defender.system.stats[a.key].mod ? b : a));
    fields.push(
      `<label>Save with<select name="stat">${STATS.map(
        stat =>
          `<option value="${stat.key}"${stat.key === best.key ? " selected" : ""}>${stat.label} (${formatModifier(defender.system.stats[stat.key].mod)})</option>`
      ).join("")}</select></label>`
    );
  }
  if (options.some(option => ["dodge", "parry", "save"].includes(option.kind))) {
    fields.push(
      `<label>Roll<select name="mode"><option value="auto">Automatic</option><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label>`
    );
  }
  return `<div class="wb-check-options">${lines.join("")}${fields.join("")}</div>`;
}

// Wonder can change any non-attack d20: a failed Dodge, Parry or save may spend it to reroll,
// or at FTH 21 (Defy Fate) to succeed. Each new result may use Wonder again.
async function offerWonder(actor, strike, kind, rollMessage) {
  if (!rollMessage || !["dodge", "parry", "save"].includes(kind)) return rollMessage;
  const { useWonder } = await import("./roll-actions.mjs");
  const { wonderAction } = await import("./rolls.mjs");
  let current = rollMessage;
  for (;;) {
    const context = current.getFlag?.(SYSTEM_ID, "check");
    const total = current.rolls?.[0]?.total;
    if (!context || avoidOutcome(strike, kind, total, !!context.success).success) return current;
    const left = Number(actor.system.wonder?.value) || 0;
    const action = wonderAction(context.kind, actor.system.stats.fth?.effective ?? actor.system.stats.fth?.value);
    if (left < 1 || !action) return current;
    const label = KIND_LABELS[kind];
    const needs = kind === "save" ? `meet DC ${wholeNumber(strike.dc)}` : `beat ${wholeNumber(strike.total)}`;
    const use = await foundry.applications.api.DialogV2.confirm({
      classes: [SYSTEM_ID, "wb-roll-dialog", "wb-defense-prompt"],
      window: { title: `${actor.name}: use Wonder?` },
      content: `<div class="wb-check-options"><p class="wb-result">${label} ${wholeNumber(total)} doesn't ${needs}.</p><p>${
        action === "success" ? "Defy Fate: spend 1 Wonder to succeed instead." : "Spend 1 Wonder to reroll it."
      } ${wholeNumber(left)} left.</p></div>`,
      yes: { label: action === "success" ? "Defy Fate" : "Use Wonder" },
      no: { label: "Keep result" },
      rejectClose: false
    });
    if (!use) return current;
    const next = await useWonder(current);
    if (!next) return current;
    current = next;
  }
}

// Roll with the existing sheet actions so reactions, Parry's round use and chat cards stay identical.
async function rollDefense(actor, strike, { kind, mode, stat }) {
  if (kind === "take") return null;
  const actions = await import("./reaction-actions.mjs");
  const chosen = mode === "auto" ? undefined : mode;
  if (kind === "dodge")
    return actions.rollDodge(actor, { against: "attack", target: strike.total, mode: chosen, spendReaction: inCombat(actor) });
  if (kind === "parry") {
    const state = actions.parryState(actor);
    return actions.rollParry(actor, {
      target: strike.total,
      overwhelmingForce: strike.overwhelming,
      mode: chosen ?? "normal",
      spendReaction: !!state.combatId
    });
  }
  if (kind === "block") return actions.rollBlock(actor, { spendReaction: inCombat(actor) });
  if (kind === "save") {
    const { rollStatCheck } = await import("./roll-actions.mjs");
    const key = strike.saveStat || stat;
    if (!STATS.some(entry => entry.key === key)) throw new Error("Choose a stat to save with.");
    const heavy = key === "agl" && !!actor.system.equipment?.heavyDisadvantage;
    return rollStatCheck(actor, key, { kind: "save", mode: chosen ?? (heavy ? "disadvantage" : "normal") });
  }
  throw new Error("Choose a defense.");
}

/* -------------------------------------------- */
/*  Chat card status and controls               */
/* -------------------------------------------- */

function statusText(ex, data) {
  const name = escapeHTML(targetOf(data, ex.index)?.name ?? "The target");
  if (ex.status === "manual") return ex.note ? `Resolve by hand: ${escapeHTML(ex.note)}` : "Resolve by hand with the buttons below.";
  if (ex.status === "waiting") {
    const user = game.users.get(ex.prompt?.userId);
    return ex.prompt
      ? `Waiting for ${escapeHTML(user?.name ?? "the target's owner")} to ${ex.step === "block" ? "decide on Block" : "respond"}.`
      : "Working out the result…";
  }
  return (
    {
      miss: `Missed ${name}.`,
      dodged: `${name} dodged.`,
      parried: `${name} parried.`,
      resisted: `${name} resisted.`,
      hit: `${name} took ${wholeNumber(ex.total ?? 0)} damage${ex.applied ? "" : " (not applied)"}.`
    }[ex.outcome] ?? ""
  );
}

export function decorateStrike(message, html) {
  const data = attackData(message);
  const card = html.querySelector(".wb-attack-card");
  if (!data?.automated || !card || card.querySelector(".wb-strike-status")) return;
  const state = strikeState(message);
  const hands = data.hands ?? [];
  hands.forEach((hand, index) => {
    const ex = state?.exchanges?.[index];
    const box = document.createElement("div");
    box.className = "wb-strike-status";
    const text = document.createElement("p");
    text.innerHTML = ex ? statusText(ex, data) : "Waiting for the GM's client…";
    box.append(text);
    const defender = defenderOf(data, index);
    if (ex?.status === "waiting" && ex.prompt) {
      if (defender?.isOwner && (ex.prompt.userId === game.user.id || game.user.isGM)) {
        box.append(button("Respond", () => showDefensePrompt(message.id, index)));
      }
      if (game.user.isActiveGM) {
        box.append(
          button(ex.step === "block" ? "Skip Block" : "Let it hit", () =>
            handleStrikeResult({ messageId: message.id, index, token: ex.prompt.token, choice: "take" }, game.user.id)
          )
        );
      }
    }
    if (ex && ex.status !== "done" && ex.status !== "manual" && game.user.isActiveGM) {
      box.append(button("Resolve by hand", () => resolveByHand(message, index)));
    }
    (card.querySelector(`.wb-attack-hand[data-hand="${index}"]`) ?? card).append(box);
  });
}

function button(label, action) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", async () => {
    element.disabled = true;
    try {
      await action();
    } catch (error) {
      ui.notifications.error(error.message);
    } finally {
      element.disabled = false;
    }
  });
  return element;
}

async function resolveByHand(message, index) {
  return queuedAction(`strike:${message.id}`, async () => {
    const state = foundry.utils.deepClone(strikeState(message) ?? { exchanges: [] });
    const entry = state.exchanges[index] ?? (state.exchanges[index] = { index });
    Object.assign(entry, { status: "manual", step: "done", prompt: null, note: "" });
    await saveState(message, state);
  });
}

export function decorateStrikeResult(message, html) {
  const result = message.getFlag?.(SYSTEM_ID, "strikeResult");
  const card = html.querySelector(".wb-strike-result");
  if (!result || !card || !game.user.isGM || !(result.amount > 0) || card.querySelector(".wb-strike-health")) return;
  const applied = result.applied && !result.undone;
  const control = button(applied ? `Undo ${wholeNumber(result.amount)} damage` : `Apply ${wholeNumber(result.amount)} damage`, () =>
    changeResultHealth(message, applied ? "undo" : "apply")
  );
  control.classList.add("wb-strike-health");
  card.append(control);
}
