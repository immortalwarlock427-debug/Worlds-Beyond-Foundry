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

The user paused combat development on 2026-11-01. Finish the sheet before returning to the numbered combat tasks below:

1. **Mana, holy power and custom resources — base pools user-validated; refinements awaiting validation.** See [RESOURCES.md](RESOURCES.md). Custom pools offer any-stat scaling; all optional pools have points/percentage display, final maximum overrides and minimum spending floors. [Whole-number controls/display](NUMBER-DISPLAY.md) preserve internal fractional balances. Recovery is manual; no new turn automation is introduced.
2. **Ability records on the sheet — user-validated.** Native Ability Items, grouped rows, descriptions, AP previews/resource cost records, manual uses/cooldowns, duration and notes. See [ABILITIES.md](ABILITIES.md). Executing combat actions follows later.
3. **Effects and forms — implemented, awaiting validation.** Native Active Effects, independent toggles and one selected form, with stat/defense/movement/resource-maximum bonuses and source labels. Base scores and expenditure are preserved. See [EFFECTS-FORMS.md](EFFECTS-FORMS.md). Portrait/loadout switching, entry costs and automatic timers remain deferred.
4. **Milestone details — implemented, awaiting validation.** All 16 Notion rules, current effective-score unlock states and current-value previews in an expandable reference opened from the diamonds or Attributes toolbar. Existing Adamantine Body/reaction/Defy Fate passives verified; actions and usage remain manual. See [MILESTONES.md](MILESTONES.md).
5. **Character details and notes — user-validated.** Class/Race, Background, Appearance, Backstory and Notes fields, with plain-text editing and readable observer output. Six blank-default fields leave existing actors and rules data intact. See [CHARACTER-DETAILS.md](CHARACTER-DETAILS.md).
6. **Organization and validation — implemented, awaiting in-world validation.** Native Character/Equipment/Abilities/Notes tabs, fixed identity/navigation, independently scrolling panels and narrow layout. Offline checks cover all tabs, unchanged form controls, existing actor data and save/reload regressions. The user still needs to check the live client and phone layout; see [SHEET-TABS.md](SHEET-TABS.md). Combat work stays deferred until the user confirms the sheet is ready.

### Deferred combat work and wider roadmap

3. **Equipment — catalog implemented, awaiting validation.** Item records (PR #6), worn armor (PR #7) and inventory/consumables (PR #8) are merged. The Notion weapon, armor and shield tables now import into a world compendium; see the [catalog checklist](CATALOG.md). This finishes step 3 once validated.
4. **Attacks and damage — implemented, awaiting validation.** Single and two-weapon attacks, damage scaling, Loading/reload and the capped AP costs are in [ATTACKS.md](ATTACKS.md). Signature properties stay reminders and get automated one at a time alongside later steps. Original scope: Attack vs Natural Evasion, damage dice scaling at levels 5/10/15/20, Finesse/Paragon crit range 18–20, Heavy and Paragon double modifiers, two-handed hits halving AR, Block dice. Signature properties start as descriptive text and get automated one at a time.
5. **Combat flow — linked defenses implemented, awaiting validation.** Shared chat theming and grouped equipment rows are implemented; see [VISUAL-POLISH.md](VISUAL-POLISH.md). Attack cards now open linked Block/Dodge/Parry dialogs with per-hand use tracking and correction resets; see [LINKED-DEFENSES.md](LINKED-DEFENSES.md). Health adjustments remain manual. Remaining small steps: opportunity attacks as reactions, Command passing AP to an ally, and potion AP integration.
   The user's token-click attack and hand-equipment request takes priority before the remaining combat actions; implemented in [TOKEN-ATTACKS.md](TOKEN-ATTACKS.md), awaiting in-world validation.
6. **Mana, holy power and custom resources — implemented for sheet use, awaiting validation.** Max = INT or FTH × (level + 2) from the current stat. Custom pools have current/max, manual recovery and optional long-rest refill. Turn-based regeneration remains deferred with combat work.
7. **Abilities, forms and milestones.** Ability records, cost previews and manual forms/effects are implemented for sheet use; payments, casting and timer/recovery automation remain. Stat AP discounts cap changes at half the base cost rounded down in either direction. Milestone actions. After the sheet is mostly finished, revisit a simple area/damage ability creator and optional Sequencer/JB2A visuals, plus module integrations. Likely several PRs.
8. **AP movement on the map.** Moving a token spends AP at the character's movement rate using Foundry's token movement. Difficult terrain costs double.
9. **Statuses.** Once the status rules (bleeding, burning, unconscious, exhaustion) are settled in Notion.

## Open questions

- **Compendiums and folder depth — resolved.** The user connected the system folder itself to Claude, so nesting is counted from `worlds-beyond\` and compendium packs (`packs/<name>/…`) can be copied into Foundry. Packs can live in the repo as normal.
- **Phones.** The table plays in person with each player on a phone. Foundry runs in a phone browser, but its interface is cramped. Sheets need a narrow layout. The canvas will stay clunky on phones.
