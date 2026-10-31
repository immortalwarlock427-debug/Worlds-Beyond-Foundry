# Roadmap

What's next for the Foundry system, in order. Each numbered step is one PR, or a few if it's large. Update this file in place as steps finish. Don't append per-PR histories.

## Approach

The Worlds Beyond website (`immortalwarlock427-debug/Worlds-Beyond`) already implements most of the rules. **Port its rules, rebuild its interface, and skip what Foundry already does.**

- **Port** the DOM-free rules modules into Foundry-free files under `module/`, with tests: `js/combat-core.js` (effective stats, Armor Rating, AP, attacks, crits, defenses), `js/character-core.js` (Health, payments), `js/resources.js` and the rules parts of `js/abilities.js` and `js/status.js`. Check each rule against Notion while porting. Notion wins when they disagree.
- **Rebuild** the interface as Foundry sheets and chat cards. Don't port the website's HTML or page code.
- **Skip** the battlemap, fog, light, routing, DM Room, player preview, cloud saves, save protection, dice roller and roll history. Foundry's canvas, combat tracker, server and chat log cover them, and every player joins from their own device.

Website features map to Foundry like this:

| Website | Foundry |
| --- | --- |
| Weapons, armor, shields, consumables, abilities | Item types |
| Form bonuses, ability effects, statuses | Active Effects |
| Health, AP | Token bars (trackable attributes) |
| DM Room initiative and turns | Combat tracker and combat hooks |
| Battlemap movement | Token movement on the canvas |

## Done

- **Stats.** Character actor with level and the 8 stats, modifiers per the Notion chart, milestone diamonds at 21/28, click-to-roll d20 + modifier, d20 + WIS initiative.

## Next

1. **Core numbers.** Health (VIT × level from current VIT), hit die from the VIT row, AP (15, +2 every 5 levels), reactions (1, +1 at AGL 21 and 28), Natural Evasion (12 + AGL mod + light-armor bonus), Armor Rating (VIT mod + armor), movement per AP (5 ft + 5 ft per AGL mod), with manual overrides. Health and AP as token bars. Build the sheet with a narrow phone layout from the start.
2. **Rolls.** Checks with advantage/disadvantage, Wonder rerolls (FTH mod per long rest) and clean chat cards.
3. **Equipment.** Weapon, armor and shield item types with their properties. Worn slots (armor by piece: chest, pants, arm guards, leg guards as a pair, helmet). Armor sets AR, Evasion bonus and the heavy-armor AGL penalty. Inventory slots (10 + STR mod, backpack adds more). The full weapon list from Notion's Weapons Explained page. **Settle the compendium question below first.**
4. **Attacks and damage.** Attack vs Natural Evasion, damage dice scaling at levels 5/10/15/20, Finesse/Paragon crit range 18–20, Heavy and Paragon double modifiers, two-handed hits halving AR, Block dice. Signature properties start as descriptive text and get automated one at a time.
5. **Combat flow.** AP and reactions reset at turn start through combat hooks. Block, Dodge, Parry and opportunity attacks as reactions. Command passing AP to an ally.
6. **Mana, holy power and custom resources.** Max = INT or FTH × (level + 2) from the current stat. Custom pools with current/max, regeneration and long-rest refill.
7. **Abilities, forms and milestones.** Ability items with AP/resource costs, stat AP discounts (floor at half, rounded up), uses, cooldowns and durations. Forms as switchable effect sets. Milestone actions. Likely several PRs.
8. **AP movement on the map.** Moving a token spends AP at the character's movement rate using Foundry's token movement. Difficult terrain costs double.
9. **Statuses.** Once the status rules (bleeding, burning, unconscious, exhaustion) are settled in Notion.

## Open questions

- **Compendiums vs the folder-depth limit.** Foundry stores compendium packs in nested folders (`packs/<name>/…`). Claude currently can't copy files that deep into the user's Foundry install. Options: connect the Foundry system folder itself to Claude so the depth counts from there, keep item data in a flat file with a button that builds the compendium inside Foundry, or make the Foundry folder a git clone updated with `git pull`. Decide before step 3.
- **Phones.** The table plays in person with each player on a phone. Foundry runs in a phone browser, but its interface is cramped. Sheets need a narrow layout. The canvas will stay clunky on phones.
