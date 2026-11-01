import { test } from "node:test";
import assert from "node:assert/strict";
import { milestoneGroups } from "../module/milestones.mjs";
import { STATS } from "../module/stats.mjs";
import { coreNumbers } from "../module/core-numbers.mjs";

const rows = system => milestoneGroups(system).flatMap(group => group.rows);
test("all 16 Notion milestones have source rules, unique keys and the existing stat names", () => {
  const groups = milestoneGroups();
  assert.equal(groups.length, 8); assert.equal(rows().length, 16);
  assert.equal(new Set(rows().map(row => row.id)).size, 16);
  groups.forEach((group, i) => {
    assert.deepEqual(group.rows.map(row => row.name), STATS[i].milestones);
    assert.deepEqual(group.rows.map(row => row.threshold), [21, 28]);
    for (const row of group.rows) {
      assert.equal(row.unlocked, false); assert.equal(row.preview, "");
      assert.ok(row.paragraphs.length); assert.ok(row.summary); assert.ok(row.timing);
      assert.match(row.source, /^https:\/\/app.notion.com\/p\/[a-f0-9]{32}$/);
    }
  });
});

test("unlock states use effective scores at both boundaries, not bases or cached milestone counts", () => {
  for (const stat of STATS) for (const [effective, states] of [[20, [false, false]], [21, [true, false]], [27.99, [true, false]], [28, [true, true]], [20, [false, false]]]) {
    const group = milestoneGroups({ stats: { [stat.key]: { value: 40, effective, milestones: 2 } } }).find(group => group.key === stat.key);
    assert.deepEqual(group.rows.map(row => row.unlocked), states, `${stat.key} ${effective}`);
    assert.equal(group.score, Math.floor(effective));
  }
  assert.equal(rows({ stats: { str: { value: 21 } } })[0].unlocked, true);
  assert.equal(rows({ stats: { str: { value: 28, effective: 0 } } })[0].unlocked, false);
});

test("current previews use current modifiers, final movement and pool overrides; out-of-combat limits stay descriptive", () => {
  const system = { level: 8, stats: Object.fromEntries(STATS.map(stat => [stat.key, { value: 12, effective: 28 }])), core: { movement: 12.5 }, wonder: { max: 9 } };
  const original = structuredClone(system), list = rows(system), find = id => list.find(row => row.id === id);
  assert.match(find("cha-21").preview, /DC 18/);
  assert.match(find("int-21").preview, /\+6/);
  assert.match(find("vit-28").preview, /14 Armor Rating/);
  assert.match(find("vit-21").preview, /d20 \+6 vs DC 12/);
  assert.match(find("dex-21").preview, /d20 \+8 · Ally reach: 12 ft/);
  assert.match(find("agl-21").preview, /25 ft/);
  assert.match(find("fth-21").preview, /maximum: 9/);
  assert.match(find("cha-28").preview, /level 8 or lower/);
  assert.equal(find("str-21").outside, "8 uses per long rest outside combat");
  assert.equal(find("vit-21").outside, "Status negation: once per long rest outside combat");
  assert.equal(find("agl-21").outside, "");
  assert.deepEqual(system, original);
  find("str-21").paragraphs.push("Edited view");
  assert.equal(rows(system)[0].paragraphs.length, 1, "view mutations never change shared rules");
});

test("Notion differences are explicit: Titan pushes 15 ft and Commanding Presence uses 12 + CHA", () => {
  assert.match(rows()[0].paragraphs[0], /push the target 15 ft/);
  assert.doesNotMatch(rows()[0].paragraphs.join(" "), /Devastate|damage modifier twice/);
  assert.match(rows().find(row => row.id === "cha-21").paragraphs[0], /DC 12 \+ your Charisma modifier/);
});

test("passive calculations already track milestone gains and losses with additive gear and final overrides", () => {
  for (const [score, armor, reactions] of [[27, 9, 2], [28, 18, 3], [29, 18, 3], [27, 9, 2]]) {
    const core = coreNumbers({ stats: { vit: { value: score }, agl: { value: score } }, bonuses: { armor: 4 } });
    assert.equal(core.armorRating, armor); assert.equal(core.reactionsMax, reactions);
    assert.equal(coreNumbers({ stats: { vit: { value: score } }, overrides: { armorRating: 0 } }).armorRating, 0);
  }
});
