# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system.

## What's in it so far

- A **character** actor with a level and the eight stats: Strength, Dexterity, Vitality, Agility, Intelligence, Wisdom, Charisma and Faith.
- Modifiers are calculated from the score. Strength and Dexterity use (score − 12) ÷ 2, rounded down. The other six move 1 per 3 points away from 12.
- Milestone diamonds light up at 21 and 28.
- Clicking a stat's abbreviation opens a check/save dialog with normal, advantage or disadvantage dice and posts a chat card.
- Cards show the die result + bonus = total. Advantage/disadvantage show both dice and which one was kept, instead of raw keep-highest/lowest formula notation.
- Initiative is d20 + Wisdom modifier.
- Wonder has an editable current pool and maximum override, plus a long-rest refill button. Use it from check/save and combat-tracker initiative messages. At FTH 21, Defy Fate declares a failed check/save successful; initiative still rerolls.
- Wonder requires one available use. Each result can use Wonder once; the new reroll can use it again. Used results stay disabled after refills and reloads.
- **Long rest** restores all current resource pools (Health, AP, reactions and Wonder) to their maximums, including manual maximum overrides.
- Core numbers: Health, hit die, AP, reactions, Natural Evasion, Armor Rating and movement per AP, with clearable manual overrides and editable current pools.
- Health and AP are selectable token bars; newly created characters default to those two bars. Existing tokens keep their settings.
- The sheet includes a narrow layout and touch-sized controls. The user confirmed core numbers working in Foundry; the new rolls/Wonder flow awaits [in-world validation](docs/ROLLS.md).

## Installing

Put this folder in `%LOCALAPPDATA%\FoundryVTT\Data\systems\worlds-beyond` (the folder name must be `worlds-beyond`), restart Foundry, and create a new world with the Worlds Beyond system.

## Layout

- `system.json`: the manifest
- `module/stats.mjs`: stat list and modifier math (no Foundry code, so it can be tested on its own)
- `module/core-numbers.mjs`: Health, hit dice, AP, reactions, defenses and movement math
- `module/character-actor.mjs`: editable token bars, including Health corrections
- `module/rolls.mjs`: Foundry-free check modes, Wonder pool and Defy Fate rules
- `module/roll-actions.mjs`: roll dialogs, chat cards, Wonder use and refill
- `module/character-combatant.mjs`: initiative context for Wonder
- `module/worlds-beyond.mjs`: data model, character sheet and registration
- `templates/character-sheet.hbs`: sheet markup
- `styles/worlds-beyond.css`: sheet styles
- `tests/`: rules and sheet/token/roll adapter tests (`node --test`)
- `docs/ROADMAP.md`: what gets built next, in order
- `docs/CORE-NUMBERS.md`: rule sources, data behavior and Foundry validation checklist
- `docs/ROLLS.md`: roll/Wonder sources, data behavior and Foundry validation checklist

Keep the folder layout shallow. Claude can copy files up to about 6 folders below the system folder into Foundry.
