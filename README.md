# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system.

## What's in it so far

- A **character** actor with a level and the eight stats: Strength, Dexterity, Vitality, Agility, Intelligence, Wisdom, Charisma and Faith.
- **Roll & assign** generates eight 2d6 + 1d12 scores or accepts typed scores, with swappable destinations and an explicit Apply. **Stat points** tracks 4-point awards at levels 4/8/12/16/19, at most 2 per stat per award, separately from bases and gear. See [stat setup](docs/STAT-SETUP.md).
- Modifiers are calculated from the score. Strength and Dexterity use (score − 12) ÷ 2, rounded down. The other six move 1 per 3 points away from 12.
- Milestone diamonds light up at 21 and 28. Stat fields show the effective score and reveal the base while editing, including earned level-up points in the normal base color. Gear/effect changes are teal, manual edits gold, and both together purple. Clearing restores the remembered pre-edit base plus earned points and active adjustments (older edits without reset history use default 12 plus earned points).
- Clicking a stat's abbreviation opens a check/save dialog with normal, advantage or disadvantage dice and posts a chat card.
- Cards show the die result + bonus = total. Advantage/disadvantage show both dice and which one was kept, instead of raw keep-highest/lowest formula notation.
- Initiative is d20 + Wisdom modifier.
- Wonder has an editable current pool and maximum override, plus a long-rest refill button. Use it from check/save and combat-tracker initiative messages. At FTH 21, Defy Fate declares a failed check/save successful; initiative still rerolls.
- Wonder requires one available use. Each result can use Wonder once; the new reroll can use it again. Used results stay disabled after refills and reloads.
- **Long rest** restores all current resource pools (Health, AP, reactions and Wonder) to their maximums, including manual maximum overrides.
- **Mana, holy power and custom resources:** Resources → Manage enables optional INT/FTH pools and adds custom trackers. Maxima follow current stats/level; spent points are preserved through maximum changes. Current totals and settings are editable, with Spend/Restore/Fill, manual custom recovery and per-custom-pool long-rest refill. Mana/holy power can be selected as token bars. See [resource pools](docs/RESOURCES.md).
- Custom pools can use **any stat × (level + 2)** or a manual maximum. Resource cards offer points/percentage display and a fill bar. Changing display preserves the point balance; percentage edits set that fraction of the maximum.
- Weapon, armor and shield records with editable sheets and a character equipment list (add/edit/equip/remove and native drops). Equipped armor/shields contribute to defenses and effective AGL; see [calculation scope and checklist](docs/ARMOR-CALCULATIONS.md).
- Each equipment type has its own data model. Weapons use a family dropdown, an independent Ranged weapon flag, property/signature checkboxes, numeric normal/long ranges and numeric loading. Standard ranged weapons use no special family, ranged Paragon keeps Paragon, and Thrown stays separate.
- Inventory slots: 10 + STR modifier, +6 with a backpack, with an override. Shields and Two-handed weapons take 2 slots, stackable items set how many fit in a slot, and worn or held equipment takes none. Going over capacity is shown, never blocked. See [inventory](docs/INVENTORY.md).
- Consumable items (potions, ammunition, other) with optional healing dice and a Use one button, and Miscellaneous items for carried gear.
- A **Worlds Beyond Catalog** compendium with every weapon, armor piece and shield from Notion. The GM is offered the import on first load and can refresh it from Configure Settings. See [catalog](docs/CATALOG.md).
- **Weapon attacks:** an Attack button on equipped weapons rolls d20 + the right stat against a targeted token's Natural Evasion, spends AP in combat (10 − modifier, from 5 to 15), supports attacking with two Light weapons and Loading/reload, flags automatic disadvantage and crits, then rolls level-scaled damage with double modifiers, charges and Armor Rating notes. See [attacks](docs/ATTACKS.md).
- **Click a token to attack:** select one owned character token, then click another visible token. Choose an equipped weapon if needed; the existing attack dialog uses that exact target. Alt-click preserves normal selection. Equipping stows conflicting hand gear while allowing two Light weapons, one-handed weapon + shield and no-hand Strapped weapons. See [token attacks and hand gear](docs/TOKEN-ATTACKS.md).
- Attack, reload and consumable cards respect the selected chat visibility. Failed actions restore spent resources or report when manual correction is needed; damage/healing cards can retry after failure. See [review findings and validation](docs/ACTION-REVIEW.md).
- Block dice scale with level (1d4, 2d4 at 5th and so on), and the largest equipped shield sets the die size.
- **Block reaction:** the Block button under Worn armor and corrections rolls those dice + STR into chat. Its editable formula supports special equipment; Spend 1 reaction defaults on during combat and off outside combat. Failed posting refunds the reaction. Apply damage to Health manually for now; see [Block scope and checklist](docs/BLOCK.md).
- **Dodge reaction:** roll d20 + AGL against an entered attack total or area save DC, with optional reaction spending, heavy-armor disadvantage defaults and Wonder support. Direct Dodge must beat the attack; an area save meets its DC for half damage. Health changes stay manual; see [Dodge scope and checklist](docs/DODGE.md).
- **Parry reaction:** roll d20 + DEX against an attack total, with ally protection, optional reaction spending and once-per-round tracking, a reset correction, Overwhelming Force reminders and Wonder support. DEX 21 and held-equipment requirements are shown in the dialog. See [Parry scope and checklist](docs/PARRY.md).
- **Defend from attack cards:** Block, Dodge and Parry open with the incoming weapon roll's total and relevant flags. Choose an owned defender when needed, including an unlinked token. Each defense can spend once per character per incoming hand, with reset corrections and unspent practice. Replies retain the source audience and Wonder keeps the link. Health stays manual; see [linked defenses](docs/LINKED-DEFENSES.md).
- Starting combat or advancing a turn refills the incoming character's AP and reactions to their current maxima. One active GM performs the update; unlinked tokens use their own actor. See [turn-refill scope and checklist](docs/TURN-REFILLS.md).
- Core numbers: Health, hit die, AP, reactions, Natural Evasion, Armor Rating and movement per AP, with clearable manual overrides and editable current pools.
- Health and AP are selectable token bars; newly created characters default to those two bars. Existing tokens keep their settings.
- The sheet includes a narrow layout and touch-sized controls. The user tested core numbers and rolls/Wonder; equipment awaits [in-world validation](docs/EQUIPMENT.md).
- The interface keeps totals and common actions up front. **Adjust values** holds overrides; **Rules & help** and per-dialog help sections open on click, tap or keyboard. Item details and longer chat explanations are also collapsible. See [interface scope and checks](docs/INTERFACE.md).
- System chat cards share the navy/brass theme, including attacks, damage, reloads and consumables. Equipment uses grouped rows with fitting icons, key stats, clear equipped states and compact actions. See [chat and equipment polish](docs/VISUAL-POLISH.md).
- All 70 catalog entries have unique image paths: 63 stock matches and 7 user-supplied illustrations. Old default images and matching placeholders resolve in inventories, editor previews and Item directories/compendiums; custom images stay chosen. See [equipment artwork](docs/EQUIPMENT-ART.md).

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
- `module/attacks.mjs`: Foundry-free attack, crit, damage-scaling and Armor Rating rules
- `module/attack-actions.mjs`: attack dialog and attack/damage chat cards
- `module/defenses.mjs`: Foundry-free Dodge/Parry readiness, comparison and outcome rules
- `module/reaction-actions.mjs`: Block/Dodge/Parry dialogs, reaction spending, Parry use tracking and chat results
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
