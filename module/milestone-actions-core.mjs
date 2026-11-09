// Foundry-free milestone actions: which milestones have a Use button, how many uses
// are left, and how a use or a correction changes the saved record.
// Rules: Notion → Stats (Stat Milestones) and each stat's page (checked 2026-11-09).
//
// Per-actor record, saved in the actor flag `milestoneUses`:
//   { [id]: { combatId, round, outside } }
// combatId/round: the combat and round of the last use in combat. A once-per-round
// milestone is spent while that round is current; a once-per-combat one while that
// combat is. outside: uses spent outside combat (or of a once-per-long-rest milestone),
// cleared by a long rest.
import { STATS, statModifier } from "./stats.mjs";
import { numberOr } from "./core-numbers.mjs";

// per: "round" | "combat" | "rest". ap: the listed AP cost, paid in combat.
export const MILESTONE_ACTIONS = Object.freeze([
  {
    id: "titans-might",
    stat: "str",
    at: 21,
    per: "round",
    ap: 0,
    label: "Titan's Might",
    text: "After landing a melee attack: push the target 15 ft in any direction or try to knock it prone, at no extra AP."
  },
  {
    id: "singularity",
    stat: "dex",
    at: 28,
    per: "round",
    ap: 0,
    label: "Singularity",
    attack: true,
    text: "Declared before a weapon attack: if it hits, it's a critical hit. A miss still spends it for the round."
  },
  {
    id: "indomitable",
    stat: "vit",
    at: 21,
    per: "combat",
    ap: 0,
    label: "Indomitable",
    text: "Negate a status that physically restrains or damages you, such as stunned, paralyzed or restrained, as it would take hold. Mind-based effects like charmed or frightened don't count."
  },
  {
    id: "stratagem",
    stat: "int",
    at: 21,
    per: "round",
    ap: 5,
    label: "Stratagem",
    text: "Give a plan to an ally who can hear you. Their next attack roll or ability check before your next turn adds your Intelligence modifier."
  },
  {
    id: "absolute-comprehension",
    stat: "int",
    at: 28,
    per: "round",
    ap: 5,
    label: "Absolute Comprehension",
    text: "Analyze a creature, ability, object or phenomenon you can perceive: the GM tells you one significant property, weakness or underlying principle, if one can be inferred."
  },
  {
    id: "sixth-sense",
    stat: "wis",
    at: 21,
    per: "round",
    ap: 0,
    label: "Sixth Sense",
    text: "Ask the GM whether a specific choice is dangerous. You get a feeling back: good, bad or unsure."
  },
  {
    id: "eyes-of-truth",
    stat: "wis",
    at: 28,
    per: "round",
    ap: 5,
    label: "Eyes of Truth",
    roll: true,
    text: "Perceive the true intent behind anything in sight. Wisdom check, contested by a creature's Charisma if it's hiding something, or against a DC the GM sets."
  },
  {
    id: "commanding-presence",
    stat: "cha",
    at: 21,
    per: "round",
    ap: 5,
    label: "Commanding Presence",
    text: "A creature within 60 ft that can perceive you makes a Charisma save. On a failure, its attention is fixed on you until the start of your next turn, and it has disadvantage on attacks against anyone but you."
  },
  {
    id: "miracle",
    stat: "fth",
    at: 28,
    per: "rest",
    ap: 0,
    label: "Miracle",
    text: "Declare in one sentence a single restriction standing in the way of an action. Fate bends probability so the action can come to pass. It fails if the declaration is too broad or fundamentally impossible for you."
  }
]);

export const milestoneAction = id => MILESTONE_ACTIONS.find(action => action.id === id) ?? null;

const PERIOD = { round: "this round", combat: "this combat", rest: "per long rest" };

function score(system, key) {
  return numberOr(system?.stats?.[key]?.effective ?? system?.stats?.[key]?.value, 12);
}

// The current state of one milestone action. `combat` is { id, round } for the started
// combat the character is in, or null outside combat.
export function milestoneUsage(system, id, record = {}, combat = null) {
  const action = milestoneAction(id);
  if (!action) return null;
  const value = score(system, action.stat);
  const modifier = statModifier(action.stat, value);
  const unlocked = value >= action.at;
  const outsideCount = Math.max(0, Math.floor(numberOr(record?.outside, 0)));
  let maximum, spent, period;
  if (action.per === "rest") {
    maximum = 1;
    spent = Math.min(maximum, outsideCount);
    period = PERIOD.rest;
  } else if (combat) {
    maximum = 1;
    const sameCombat = record?.combatId === combat.id;
    spent = sameCombat && (action.per === "combat" || Number(record?.round) === Number(combat.round)) ? 1 : 0;
    period = PERIOD[action.per];
  } else {
    // Outside combat: once per combat becomes once per long rest; once per round
    // becomes uses equal to the stat's modifier per long rest (Notion Stats).
    maximum = action.per === "combat" ? 1 : Math.max(0, modifier);
    spent = Math.min(maximum, outsideCount);
    period = PERIOD.rest;
  }
  const remaining = Math.max(0, maximum - spent);
  return {
    ...action,
    statLabel: STATS.find(stat => stat.key === action.stat)?.abbr ?? action.stat.toUpperCase(),
    score: value,
    modifier,
    unlocked,
    inCombat: !!combat,
    maximum,
    remaining,
    period,
    ap: combat ? action.ap : 0,
    dc: action.id === "commanding-presence" ? 12 + modifier : null,
    ready: unlocked && remaining >= 1
  };
}

export function milestoneUsages(system, records = {}, combat = null) {
  return MILESTONE_ACTIONS.map(action => milestoneUsage(system, action.id, records?.[action.id], combat));
}

// The record after one use. Throws when the milestone is locked or spent.
export function spendMilestone(system, id, record = {}, combat = null) {
  const usage = milestoneUsage(system, id, record, combat);
  if (!usage) throw new Error("Unknown milestone.");
  if (!usage.unlocked) throw new Error(`${usage.label} needs ${usage.statLabel} ${usage.at}.`);
  if (!usage.ready)
    throw new Error(
      `${usage.label} is already used ${usage.period === PERIOD.rest ? "until a long rest" : usage.period}. Correct its uses on the Abilities tab if needed.`
    );
  const next = { combatId: record?.combatId ?? null, round: record?.round ?? null, outside: numberOr(record?.outside, 0) };
  if (usage.per !== "rest" && combat) Object.assign(next, { combatId: combat.id, round: combat.round });
  else next.outside += 1;
  return next;
}

// The record after a manual correction to the number of uses left.
export function correctMilestone(system, id, remaining, record = {}, combat = null) {
  const usage = milestoneUsage(system, id, record, combat);
  if (!usage) throw new Error("Unknown milestone.");
  const wanted = Math.floor(Number(remaining));
  if (!Number.isFinite(wanted) || wanted < 0) throw new Error("Enter 0 or more uses.");
  const left = Math.min(usage.maximum, wanted);
  const next = { combatId: record?.combatId ?? null, round: record?.round ?? null, outside: numberOr(record?.outside, 0) };
  if (usage.per !== "rest" && combat) {
    if (left >= 1) Object.assign(next, { combatId: null, round: null });
    else Object.assign(next, { combatId: combat.id, round: combat.round });
  } else next.outside = usage.maximum - left;
  return next;
}

// One line for the sheet: "1 / 1 this round", "2 / 3 per long rest".
export function usageText(usage) {
  if (!usage.unlocked) return `Requires ${usage.statLabel} ${usage.at}`;
  return `${usage.remaining} / ${usage.maximum} ${usage.period}${usage.ap ? ` · ${usage.ap} AP` : ""}`;
}
