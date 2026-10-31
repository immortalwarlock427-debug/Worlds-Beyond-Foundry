# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system.

## What's in it so far

- A **character** actor with a level and the eight stats: Strength, Dexterity, Vitality, Agility, Intelligence, Wisdom, Charisma and Faith.
- Modifiers are calculated from the score. Strength and Dexterity use (score − 12) ÷ 2, rounded down. The other six move 1 per 3 points away from 12.
- Milestone diamonds light up at 21 and 28.
- Clicking a stat's abbreviation rolls d20 + its modifier to chat.
- Initiative is d20 + Wisdom modifier.
- Core numbers: Health, hit die, AP, reactions, Natural Evasion, Armor Rating and movement per AP, with clearable manual overrides and editable current pools.
- Health and AP are selectable token bars; newly created characters default to those two bars. Existing tokens keep their settings.
- The sheet includes a narrow layout and touch-sized controls. This core-numbers release still needs in-world desktop/phone validation; see [the checklist](docs/CORE-NUMBERS.md).

## Installing

Put this folder in `%LOCALAPPDATA%\FoundryVTT\Data\systems\worlds-beyond` (the folder name must be `worlds-beyond`), restart Foundry, and create a new world with the Worlds Beyond system.

## Layout

- `system.json`: the manifest
- `module/stats.mjs`: stat list and modifier math (no Foundry code, so it can be tested on its own)
- `module/core-numbers.mjs`: Health, hit dice, AP, reactions, defenses and movement math
- `module/character-actor.mjs`: editable token bars, including Health corrections
- `module/worlds-beyond.mjs`: data model, character sheet and registration
- `templates/character-sheet.hbs`: sheet markup
- `styles/worlds-beyond.css`: sheet styles
- `tests/`: stat/core-number rules and sheet/token adapter tests (`node --test`)
- `docs/ROADMAP.md`: what gets built next, in order
- `docs/CORE-NUMBERS.md`: rule sources, data behavior and Foundry validation checklist

Keep the folder layout shallow. Claude can copy files up to about 6 folders below the system folder into Foundry.
