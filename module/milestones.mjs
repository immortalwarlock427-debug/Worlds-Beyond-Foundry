// Read-only milestone reference, checked against Notion's eight stat pages.
import { STATS, MILESTONE_SCORES, statModifier, formatModifier } from "./stats.mjs";
import { numberOr } from "./core-numbers.mjs";
import { wholeNumber } from "./number-display.mjs";

const pages = {
  str: "351c72092efb81bc9c1dc28707e48241", dex: "351c72092efb8132b174eb48b029c4ab",
  vit: "351c72092efb813e9ab9c1193bdcbb47", agl: "351c72092efb812cae19fb7713e9e76b",
  int: "351c72092efb81fd8861d6d5d5b12eb4", wis: "351c72092efb8126bbbaf6116a2b38a3",
  cha: "351c72092efb81e78d5ae82a2cf5cd8c", fth: "351c72092efb813a8dcdf9dbae517e29"
};

// Text only: no HTML, source mutations, payments, targeting or usage tracking.
const rules = {
  str: [
    { frequency: "round", timing: "Once per round · No extra AP", summary: "Push 15 ft or attempt to knock prone after a melee hit.",
      paragraphs: ["Once per round, when you land a melee attack, you can push the target 15 ft in any direction or try to knock it prone, at no extra AP. You can also try to grapple or shove creatures larger than you, within reason."] },
    { timing: "Passive", summary: "Weapon and unarmed damage cannot be reduced below half.",
      paragraphs: ["Your weapon and unarmed attacks cannot have their damage reduced below half by anything, including Armor Rating, blocks and parries. A dodge still avoids them entirely. This does not bypass immunities."] }
  ],
  dex: [
    { frequency: "round", timing: "Once per round · 1 reaction", summary: "Parry a visible physical attack against you or a nearby ally.",
      paragraphs: ["As a reaction, parry a physical melee or ranged attack you can see against you or anyone you could reach with 1 AP of movement. To protect someone else, move in front of wherever the attack comes from. You need a weapon or shield in hand.", "Roll d20 + your Dexterity modifier. A result higher than the attack roll negates all its damage and any non-magical effects it would apply. A tie fails."] },
    { frequency: "round", timing: "Once per round · Declare before rolling", summary: "A declared weapon attack becomes a critical hit if it hits.",
      paragraphs: ["Before rolling a melee or ranged weapon attack, you can declare Singularity. If the attack hits, it is a critical hit. If it misses, Singularity is still spent for the round."] }
  ],
  vit: [
    { frequency: "combat", timing: "Status negation once per combat", summary: "Negate a physical status; gain a stabilization roll below 0 Health.",
      paragraphs: ["Once per combat, when a status effect that physically restrains or damages you would take hold, such as stunned, paralyzed or restrained, you can negate it so it never affects you. Mind-based effects such as charmed or frightened do not count.", "Also, when dropped below 0 Health, you can roll d20 + your Vitality modifier against DC 12. On success you stop bleeding and remain unconscious. The once-per-combat limit above applies to status negation."] },
    { timing: "Passive · Included in Armor Rating", summary: "Use half your current VIT for Armor Rating instead of its modifier.",
      paragraphs: ["Your Armor Rating becomes half your current Vitality, rounded down, plus the armor you wear, instead of your Vitality modifier plus your armor. Equipment and extra Armor Rating corrections still add; a final Armor Rating override replaces the result."] }
  ],
  agl: [
    { timing: "Each turn · +1 reaction maximum", summary: "Gain 2 free movement AP each turn and an extra reaction.",
      paragraphs: ["Each turn, you get 2 AP of movement for free. You also gain an additional reaction.", "The extra reaction is included in the calculated reaction maximum. Free movement AP stays separate from normal AP; track its use manually for now."] },
    { timing: "Passive · +1 reaction maximum", summary: "Avoid opportunity attacks; sight-based attackers have disadvantage.",
      paragraphs: ["You cannot be hit by opportunity attacks. Any attack that relies on sight to hit you has disadvantage, whether melee, ranged or a spell. You have advantage on saves against spells that need sight to target you. You also gain an additional reaction.", "The extra reaction is included in the calculated maximum. Sight conditions, advantage and opportunity-attack immunity are resolved manually."] }
  ],
  int: [
    { frequency: "round", timing: "Once per round · Listed cost 5 AP", summary: "Give an ally your INT modifier on their next attack or ability check.",
      paragraphs: ["Give a plan to an ally who can hear you. Their next attack roll or ability check before your next turn adds your Intelligence modifier. The listed cost is 5 AP."] },
    { frequency: "round", timing: "Once per round · Listed cost 5 AP", summary: "Analyze one significant property, weakness or underlying principle.",
      paragraphs: ["Analyze a creature, ability, object or phenomenon you can perceive to learn how it works: one significant property, weakness or underlying principle, if one can be inferred from the available information. The listed cost is 5 AP."] }
  ],
  wis: [
    { frequency: "round", timing: "Passive warning · One question per round · 0 AP", summary: "Sense hidden danger and ask whether a specific choice is dangerous.",
      paragraphs: ["Whenever you face a danger you do not know about, the GM secretly makes a Wisdom check for you against the danger's DC, such as an ambusher's stealth roll or a trap's DC. On success, you feel something is wrong, but the GM does not say what.", "Once per round, at no AP cost, you can also ask the GM whether a specific choice is dangerous. You receive a feeling: good, bad or unsure."] },
    { frequency: "round", timing: "Passive sight · Insight once per round · Listed cost 5 AP", summary: "See through illusions, see invisible creatures within 30 ft and read intent.",
      paragraphs: ["You naturally see through illusions and can see invisible creatures within 30 ft.", "Once per round, for a listed 5 AP, attempt to perceive the true intent behind anything in sight: whether a creature is hostile, afraid, lying or hiding something, or the purpose of surrounding things, such as who a trap is meant to catch or what a ritual is meant to bring about. Make a Wisdom check, contested by a creature's Charisma if it is hiding something, or against a DC set by the GM."] }
  ],
  cha: [
    { frequency: "round", timing: "Once per round · Listed cost 5 AP", summary: "Force a creature within 60 ft to focus its attacks on you.",
      paragraphs: ["A creature within 60 ft that can perceive you makes a Charisma save against DC 12 + your Charisma modifier. On failure, its attention is fixed on you until the start of your next turn, and its attacks against anyone else have disadvantage. The listed cost is 5 AP."] },
    { timing: "Passive · Compare source level", summary: "Protect your personality, memories and identity against outside control.",
      paragraphs: ["You are immune to possession and effects that forcibly alter your personality, memories or identity when they come from a source of your level or lower. Against higher-level sources, you have advantage to resist them."] }
  ],
  fth: [
    { timing: "Uses Wonder · Regained on a long rest", summary: "Wonder turns a failed save or ability check into a success.",
      paragraphs: ["Each use of Wonder turns a failed saving throw or ability check into a success. Uses equal your Faith modifier and return on a long rest. Initiative still rerolls when using Wonder.", "The existing Wonder controls apply this rule; a manual Wonder maximum override still takes priority."] },
    { timing: "Once per long rest · 0 AP", summary: "Bend probability around one declared restriction on an action.",
      paragraphs: ["Declare in one sentence a single restriction standing in the way of an action, such as a usage limit, an immunity or the limit of your own strength. Fate bends probability so the action can come to pass anyway.", "Miracle fails if the declaration is too broad or fundamentally impossible for you, such as granting an ability you do not have, like flight. It cannot bypass its own usage limit."] }
  ]
};

function preview(system, key, index, score, modifier) {
  const mod = formatModifier(modifier), movement = numberOr(system.core?.movement, null);
  const values = {
    str: ["15 ft push · No extra AP", "Damage floor: 50% · Immunities still apply"],
    dex: [`Parry: d20 ${mod}${movement === null ? "" : ` · Ally reach: ${wholeNumber(movement)} ft`}`, "Declare before the attack · A miss still spends the use"],
    vit: [`Stabilize: d20 ${mod} vs DC 12`, `VIT contribution: ${Math.floor(score / 2)} Armor Rating`],
    agl: [`2 free movement AP${movement === null ? "" : ` · ${wholeNumber(2 * movement)} ft at your current rate`}`, "+1 reaction maximum · Sight-based attacks: disadvantage"],
    int: [`Ally's next roll: ${mod}`, "One significant property, weakness or principle"],
    wis: [`Secret GM check: d20 ${mod}`, `Invisible creatures: 30 ft · Intent check: d20 ${mod}`],
    cha: [`Target's CHA save: DC ${12 + modifier}`, `Immunity to sources of level ${wholeNumber(numberOr(system.level, 1))} or lower`],
    fth: [`Wonder maximum: ${wholeNumber(numberOr(system.wonder?.max, Math.max(0, modifier)))}`, "One sentence · One restriction · GM adjudication"]
  };
  return values[key][index];
}

export function milestoneGroups(system = {}) {
  return STATS.map(stat => {
    const score = numberOr(system.stats?.[stat.key]?.effective ?? system.stats?.[stat.key]?.value, 12);
    const modifier = statModifier(stat.key, score);
    return { key: stat.key, label: stat.label, abbr: stat.abbr, score: wholeNumber(score),
      rows: stat.milestones.map((name, index) => {
        const rule = rules[stat.key][index], threshold = MILESTONE_SCORES[index], unlocked = score >= threshold;
        const outside = rule.frequency === "round" ? `${Math.max(0, modifier)} uses per long rest outside combat`
          : rule.frequency === "combat" ? "Status negation: once per long rest outside combat" : "";
        return { id: `${stat.key}-${threshold}`, key: stat.key, name, threshold, unlocked,
          status: unlocked ? "Unlocked" : `Requires ${stat.abbr} ${threshold}`, summary: rule.summary, timing: rule.timing,
          paragraphs: [...rule.paragraphs], outside, preview: unlocked ? preview(system, stat.key, index, score, modifier) : "",
          source: `https://app.notion.com/p/${pages[stat.key]}` };
      }) };
  });
}
