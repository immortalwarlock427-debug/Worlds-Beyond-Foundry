# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system.

## What's in it so far

- A **character** actor with a level and the eight stats: Strength, Dexterity, Vitality, Agility, Intelligence, Wisdom, Charisma and Faith.
- Modifiers are calculated from the score. Strength and Dexterity use (score − 12) ÷ 2, rounded down. The other six move 1 per 3 points away from 12.
- Milestone diamonds light up at 21 and 28. Stat fields show the effective score and reveal the base while editing, matching the website. Automatic changes are teal, manual edits gold, and combined manual/automatic changes purple. Clearing a stat restores its remembered pre-edit base while keeping automatic adjustments (older edits without reset history use default 12).
- Clicking a stat's abbreviation opens a check/save dialog with normal, advantage or disadvantage dice and posts a chat card.
- Cards show the die result + bonus = total. Advantage/disadvantage show both dice and which one was kept, instead of raw keep-highest/lowest formula notation.
- Initiative is d20 + Wisdom modifier.
- Wonder has an editable current pool and maximum override, plus a long-rest refill button. Use it from check/save and combat-tracker initiative messages. At FTH 21, Defy Fate declares a failed check/save successful; initiative still rerolls.
- Wonder requires one available use. Each result can use Wonder once; the new reroll can use it again. Used results stay disabled after refills and reloads.
- **Long rest** restores all current resource pools (Health, AP, reactions and Wonder) to their maximums, including manual maximum overrides.
- Weapon, armor and shield records with editable sheets and a character equipment list (add/edit/equip/remove and native drops). Equipped armor/shields contribute to defenses and effective AGL; see [calculation scope and checklist](docs/ARMOR-CALCULATIONS.md).
- Each equipment type has its own data model. Weapons use a family dropdown, an independent Ranged weapon flag, property/signature checkboxes, numeric normal/long ranges and numeric loading. Standard ranged weapons use no special family, ranged Paragon keeps Paragon, and Thrown stays separate.
- Inventory slots: 10 + STR modifier, +6 with a backpack, with an override. Shields and Two-handed weapons take 2 slots, stackable items set how many fit in a slot, and worn or held equipment takes none. Going over capacity is shown, never blocked. See [inventory](docs/INVENTORY.md).
- Consumable items (potions, ammunition, other) with optional healing dice and a Use one button, and Miscellaneous items for carried gear.
- A **Worlds Beyond Catalog** compendium with every weapon, armor piece and shield from Notion. The GM is offered the import on first load and can refresh it from Configure Settings. See [catalog](docs/CATALOG.md).
- Block dice scale with level (1d4, 2d4 at 5th and so on), and the largest equipped shield sets the die size.
- Core numbers: Health, hit die, AP, reactions, Natural Evasion, Armor Rating and movement per AP, with clearable manual overrides and editable current pools.
- Health and AP are selectable token bars; newly created characters default to those two bars. Existing tokens keep their settings.
- The sheet includes a narrow layout and touch-sized controls. The user tested core numbers and rolls/Wonder; equipment awaits [in-world validation](docs/EQUIPMENT.md).

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
- `module/equipment-core.mjs`: Foundry-free worn armor/shield totals and effective AGL
- `module/equipment.mjs`: item data models, sheets and character controls
- `module/catalog.mjs`: Foundry-free weapon/armor/shield tables transcribed from Notion
- `module/catalog-import.mjs`: GM import of the catalog into a world compendium
- `module/worlds-beyond.mjs`: data model, character sheet and registration
- `templates/character-sheet.hbs`: sheet markup
- `styles/worlds-beyond.css`: sheet styles
- `tests/`: rules and sheet/token/roll adapter tests (`node --test`)
- `docs/ROADMAP.md`: what gets built next, in order
- `docs/CORE-NUMBERS.md`: rule sources, data behavior and Foundry validation checklist
- `docs/ROLLS.md`: roll/Wonder sources, data behavior and Foundry validation checklist
- `docs/INVENTORY.md`: inventory, consumable and Block dice rules, data changes and Foundry validation checklist

Keep the folder layout shallow. Claude can copy files up to about 6 folders below the system folder into Foundry.
