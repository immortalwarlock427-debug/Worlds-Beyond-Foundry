import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MILESTONE_ACTIONS,
  milestoneUsage,
  milestoneUsages,
  spendMilestone,
  correctMilestone,
  usageText
} from "../module/milestone-actions-core.mjs";
import { STATS } from "../module/stats.mjs";

const character = scores => ({
  stats: Object.fromEntries(STATS.map(({ key }) => [key, { value: 12, effective: scores[key] ?? 12 }]))
});
const combat = (round = 1, id = "combatA") => ({ id, round });

test("milestone actions use Notion's names, thresholds, limits and listed AP", () => {
  const names = Object.fromEntries(STATS.map(stat => [stat.key, stat.milestones]));
  for (const action of MILESTONE_ACTIONS) assert.equal(action.label, names[action.stat][action.at === 21 ? 0 : 1]);
  const table = Object.fromEntries(MILESTONE_ACTIONS.map(action => [action.id, `${action.per}/${action.ap}`]));
  assert.deepEqual(table, {
    "titans-might": "round/0",
    singularity: "round/0",
    indomitable: "combat/0",
    stratagem: "round/5",
    "absolute-comprehension": "round/5",
    "sixth-sense": "round/0",
    "eyes-of-truth": "round/5",
    "commanding-presence": "round/5",
    miracle: "rest/0"
  });
});

test("milestones follow the current score: locked below 21/28, unlocked at it", () => {
  assert.equal(milestoneUsage(character({ int: 20 }), "stratagem").unlocked, false);
  assert.equal(milestoneUsage(character({ int: 21 }), "stratagem").unlocked, true);
  assert.equal(milestoneUsage(character({ int: 27 }), "absolute-comprehension").unlocked, false);
  assert.equal(milestoneUsages(character({})).filter(usage => usage.unlocked).length, 0);
  assert.throws(() => spendMilestone(character({ int: 20 }), "stratagem"), /needs INT 21/);
});

test("in combat, once-per-round milestones refresh each round and pay their listed AP", () => {
  const system = character({ int: 21 });
  const fresh = milestoneUsage(system, "stratagem", {}, combat(1));
  assert.deepEqual([fresh.remaining, fresh.maximum, fresh.ap, fresh.period], [1, 1, 5, "this round"]);
  const used = spendMilestone(system, "stratagem", {}, combat(1));
  assert.deepEqual(used, { combatId: "combatA", round: 1, outside: 0 });
  assert.equal(milestoneUsage(system, "stratagem", used, combat(1)).remaining, 0);
  assert.throws(() => spendMilestone(system, "stratagem", used, combat(1)), /already used this round/);
  assert.equal(milestoneUsage(system, "stratagem", used, combat(2)).remaining, 1);
  assert.equal(milestoneUsage(system, "stratagem", used, combat(1, "combatB")).remaining, 1);
});

test("Indomitable is once per combat in combat", () => {
  const system = character({ vit: 21 });
  const used = spendMilestone(system, "indomitable", {}, combat(1));
  assert.equal(milestoneUsage(system, "indomitable", used, combat(4)).remaining, 0);
  assert.equal(milestoneUsage(system, "indomitable", used, combat(1, "combatB")).remaining, 1);
});

test("outside combat: once per round becomes the stat modifier per long rest, once per combat becomes once", () => {
  const system = character({ wis: 22, vit: 21 }); // WIS +4, VIT +3
  const sixth = milestoneUsage(system, "sixth-sense");
  assert.deepEqual([sixth.remaining, sixth.maximum, sixth.ap, sixth.period], [4, 4, 0, "per long rest"]);
  let record = {};
  for (let i = 0; i < 4; i++) record = spendMilestone(system, "sixth-sense", record);
  assert.equal(record.outside, 4);
  assert.throws(() => spendMilestone(system, "sixth-sense", record), /until a long rest/);
  // Listed AP is a combat cost.
  assert.equal(milestoneUsage(character({ int: 21 }), "stratagem").ap, 0);
  assert.equal(milestoneUsage(system, "indomitable").maximum, 1);
  // Uses spent outside combat don't spend the in-combat round use, and vice versa.
  assert.equal(milestoneUsage(system, "sixth-sense", record, combat(1)).remaining, 1);
  const inFight = spendMilestone(system, "sixth-sense", {}, combat(1));
  assert.equal(milestoneUsage(system, "sixth-sense", inFight).remaining, 4);
});

test("Miracle is once per long rest, in or out of combat", () => {
  const system = character({ fth: 28 });
  const used = spendMilestone(system, "miracle", {}, combat(1));
  assert.equal(used.outside, 1);
  assert.equal(milestoneUsage(system, "miracle", used, combat(2)).remaining, 0);
  assert.equal(milestoneUsage(system, "miracle", used).remaining, 0);
});

test("Commanding Presence's save DC is 12 + CHA modifier", () => {
  assert.equal(milestoneUsage(character({ cha: 21 }), "commanding-presence").dc, 15);
  assert.equal(milestoneUsage(character({ cha: 28 }), "commanding-presence").dc, 18);
});

test("the uses field corrects the tracker either way", () => {
  const system = character({ int: 22 });
  const used = spendMilestone(system, "stratagem", {}, combat(3));
  const restored = correctMilestone(system, "stratagem", 1, used, combat(3));
  assert.equal(milestoneUsage(system, "stratagem", restored, combat(3)).remaining, 1);
  const spent = correctMilestone(system, "stratagem", 0, {}, combat(3));
  assert.equal(milestoneUsage(system, "stratagem", spent, combat(3)).remaining, 0);
  const outside = correctMilestone(system, "stratagem", 2, {});
  assert.equal(milestoneUsage(system, "stratagem", outside).remaining, 2);
  assert.equal(milestoneUsage(system, "stratagem", correctMilestone(system, "stratagem", 9, {})).remaining, 4);
  assert.throws(() => correctMilestone(system, "stratagem", -1, {}), /0 or more/);
});

test("a lower modifier caps outside uses already spent", () => {
  const record = { outside: 3 };
  assert.equal(milestoneUsage(character({ int: 21 }), "stratagem", record).remaining, 0);
  assert.equal(milestoneUsage(character({ int: 28 }), "stratagem", record).remaining, 3);
});

test("sheet text shows uses, period and combat AP", () => {
  assert.equal(usageText(milestoneUsage(character({ int: 21 }), "stratagem", {}, combat())), "1 / 1 this round · 5 AP");
  assert.equal(usageText(milestoneUsage(character({ int: 21 }), "stratagem")), "3 / 3 per long rest");
  assert.equal(usageText(milestoneUsage(character({}), "stratagem")), "Requires INT 21");
});
