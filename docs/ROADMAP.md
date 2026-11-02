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
- **Stat setup — implemented, awaiting validation.** User-requested stat generation/typed assignments and separate 4-point awards at levels 4/8/12/16/19, at most 2 per stat per award. This takes priority over the next combat-flow step. See [stat setup and validation](STAT-SETUP.md).
- **Core numbers.** Health, hit die, AP, reactions, Natural Evasion, Armor Rating, movement per AP, manual overrides and Health/AP token bars. The user confirmed the installed release works in Foundry on 2026-10-31 and authorized the next step. See [rules and regression checklist](CORE-NUMBERS.md).

- **Rolls.** Checks/saves, advantage/disadvantage, readable chat cards, Wonder and long rest. The user tested the installed release and merged PR #5 before requesting equipment.

## Next

### Current priority: finish the character sheet

The user requested item/ability bonuses, Command and potion AP after the base sheet tabs. These are implemented for validation. Forms belong to Abilities and Status shows only active sources. Opportunity attacks are deferred again: later combat work should prompt when a creature moves away from an armed character with a reaction. Do not add a standalone React button. Broader casting, timers and combat automation remain below.

1. **Mana, holy power and custom resources — base pools user-validated; refinements awaiting validation.** See [RESOURCES.md](RESOURCES.md). Custom pools offer any-stat scaling; all optional pools have points/percentage display, final maximum overrides and minimum spending floors. Optional overflow lets gains exceed the normal cap, including Health when explicitly enabled. [Whole-number controls/display](NUMBER-DISPLAY.md) preserve internal fractional balances. Recovery is manual; no new turn automation is introduced.
2. **Ability records on the sheet — user-validated.** Native Ability Items, grouped rows, descriptions, AP previews/resource cost records, manual uses/cooldowns, duration and notes. See [ABILITIES.md](ABILITIES.md). Self-bonus activation/payment is implemented; attack/damage casting follows later.
3. **Ability/item bonuses, forms and Status — implemented, awaiting validation.** Native item-owned bonuses, Form-type Ability Items with one selected form, and active-only Status. Saved actor-owned forms/adjustments remain under Abilities, with no new standalone effect creator. Base scores and expenditure are preserved. See [EFFECTS-FORMS.md](EFFECTS-FORMS.md). Portrait/loadout switching and automatic timers remain deferred.
4. **Milestone details — implemented, awaiting validation.** All 16 Notion rules, current effective-score unlock states and current-value previews in an expandable reference opened from the diamonds or Attributes toolbar. Existing Adamantine Body/reaction/Defy Fate passives verified; actions and usage remain manual. See [MILESTONES.md](MILESTONES.md).
5. **Character details and notes — user-validated.** Class/Race, Background, Appearance, Backstory and Notes fields, with plain-text editing and readable observer output. Six blank-default fields leave existing actors and rules data intact. See [CHARACTER-DETAILS.md](CHARACTER-DETAILS.md).
6. **Organization and validation — implemented, awaiting in-world validation.** Native Character/Equipment/Abilities/Status/Notes tabs, fixed identity/navigation, independently scrolling panels and narrow layout. Forms stay in Abilities; Status shows active sources only. Offline checks cover all tabs, unchanged form controls, existing actor data and save/reload regressions. The user still needs to check the live client and phone layout; see [SHEET-TABS.md](SHEET-TABS.md).
7. **Consumable benefits and resource-triggered forms — implemented, awaiting validation.** Consumables restore Health or one selected resource with points/dice/percentage and apply numeric bonuses. Active per-use groups live only in Status. Form triggers detect resource crossings, defaulting to Ask first and Ask to end on newly configured forms. Declining ending keeps the transformation active. See [CONSUMABLES-TRIGGERS.md](CONSUMABLES-TRIGGERS.md).

### Remaining sheet mechanics before wider combat

- **Ability restoration — implemented, awaiting validation:** self healing/resource gains with fixed amounts, dice or percentage, combined with existing costs and bonuses. Full pure-restoration uses spend nothing; failed actions roll back gains and costs. See [ABILITY-RESTORATION.md](ABILITY-RESTORATION.md).
- **Lifetimes and recovery:** ability/consumable durations, cooldown countdown, uses recharge, resource regeneration and configured rest recovery. These counters remain manual today.
- **Form loadouts:** portraits, gear, available abilities and resource visibility per form, without losing balances or base data.
- **Final sheet validation:** verify existing-character saves, base/effective stats, resource bounds and payments, inventory, ability/consumable benefits, forms, active Status and narrow/read-only sheets in the live client. Resolve sheet defects before expanding combat.

The base sheet completion gate is restoration, lifetimes/recovery, form loadouts and the final validation pass above. Explicitly tell the user when these are complete and work is about to move into combat, spell effects or module integrations. No module installation is part of this sheet task.

Ability damage/save/target resolution, movement AP, opportunity prompts and automatic damage/defenses belong to the later combat phase. Richer advantage/dice adjustments, damage defenses and condition presets follow their settled Notion rules there. A simple area ability editor and optional visuals also follow later.

### Deferred combat work and wider roadmap

3. **Equipment — catalog implemented, awaiting validation.** Item records (PR #6), worn armor (PR #7) and inventory/consumables (PR #8) are merged. The Notion weapon, armor and shield tables now import into a world compendium; see the [catalog checklist](CATALOG.md). This finishes step 3 once validated.
4. **Attacks and damage — implemented, awaiting validation.** Single and two-weapon attacks, damage scaling, Loading/reload and the capped AP costs are in [ATTACKS.md](ATTACKS.md). Signature properties stay reminders and get automated one at a time alongside later steps. Original scope: Attack vs Natural Evasion, damage dice scaling at levels 5/10/15/20, Finesse/Paragon crit range 18–20, Heavy and Paragon double modifiers, two-handed hits halving AR, Block dice. Signature properties start as descriptive text and get automated one at a time.
5. **Combat flow — linked defenses implemented, awaiting validation.** Shared chat theming and grouped equipment rows are implemented; see [VISUAL-POLISH.md](VISUAL-POLISH.md). Attack cards now open linked Block/Dodge/Parry dialogs with per-hand use tracking and correction resets; see [LINKED-DEFENSES.md](LINKED-DEFENSES.md). Health adjustments remain manual. Non-stacking Command AP transfer and potion AP integration are implemented for validation; opportunity attacks wait for later movement-triggered prompts. See [ITEM-BONUSES-ACTIONS.md](ITEM-BONUSES-ACTIONS.md).
   The user's token-click attack and hand-equipment request takes priority before the remaining combat actions; implemented in [TOKEN-ATTACKS.md](TOKEN-ATTACKS.md), awaiting in-world validation.
6. **Mana, holy power and custom resources — implemented for sheet use, awaiting validation.** Max = INT or FTH × (level + 2) from the current stat. Custom pools have current/max, manual recovery and optional long-rest refill. Turn-based regeneration remains deferred with combat work.
7. **Abilities, forms and milestones.** Ability records, cost previews and manual forms/effects are implemented for sheet use; self-bonus payments/activation are implemented; attack/damage casting and timer/recovery automation remain. Stat AP discounts cap changes at half the base cost rounded down in either direction. Milestone actions. After the sheet is mostly finished, revisit a simple area/damage ability creator and optional Sequencer/JB2A visuals, plus module integrations. Likely several PRs.
8. **AP movement on the map.** Moving a token spends AP at the character's movement rate using Foundry's token movement. Difficult terrain costs double.
9. **Statuses.** Once the status rules (bleeding, burning, unconscious, exhaustion) are settled in Notion.

## Open questions

- **Compendiums and folder depth — resolved.** The user connected the system folder itself to Claude, so nesting is counted from `worlds-beyond\` and compendium packs (`packs/<name>/…`) can be copied into Foundry. Packs can live in the repo as normal.
- **Phones.** The table plays in person with each player on a phone. Foundry runs in a phone browser, but its interface is cramped. Sheets need a narrow layout. The canvas will stay clunky on phones.
