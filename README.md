# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system.

## What's in it so far

- A **character** actor with a level and the eight stats: Strength, Dexterity, Vitality, Agility, Intelligence, Wisdom, Charisma and Faith.
- Modifiers are calculated from the score. Strength and Dexterity use (score − 12) ÷ 2, rounded down. The other six move 1 per 3 points away from 12.
- Milestone diamonds light up at 21 and 28.
- Clicking a stat's abbreviation rolls d20 + its modifier to chat.
- Initiative is d20 + Wisdom modifier.

## Installing

Put this folder in `%LOCALAPPDATA%\FoundryVTT\Data\systems\worlds-beyond` (the folder name must be `worlds-beyond`), restart Foundry, and create a new world with the Worlds Beyond system.

## Layout

- `system.json`: the manifest
- `module/stats.mjs`: stat list and modifier math (no Foundry code, so it can be tested on its own)
- `module/worlds-beyond.mjs`: data model, character sheet and registration
- `templates/character-sheet.hbs`: sheet markup
- `styles/worlds-beyond.css`: sheet styles
- `tests/`: tests for the stat math
- `docs/ROADMAP.md`: what gets built next, in order

Keep the folder layout shallow. Claude can copy files up to about 6 folders below the system folder into Foundry.
