# Ability records

Version 0.23.0 implements the sheet-first ability-record step. It includes the preceding whole-number and compact-percent changes. Combat execution, effects/forms, automatic recovery/timers, targeting and animations stay deferred.

## Sources and scope

Read 2026-11-01: Notion [Game Systems](https://app.notion.com/p/351c72092efb8089812cd231debc3e74), [Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73) and [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6). AP modifiers change costs by at most half the base cost rounded down in either direction; spells normally start at 11 AP. The preview reuses the existing Foundry-free `actionApCost` function. No new combat math is introduced.

The current website `js/abilities.js` was consulted for active/passive/reaction/other types, categories, descriptions, a selected AP discount stat, resource references, uses, cooldowns, duration and notes. The Foundry roadmap calls for records first. The website's casting, effect, form and timer engine is not ported in this step. Weavecasting remains separate.

## Use

- On a character, choose **Abilities → Add ability**. Or create an **Ability** in Foundry's Items directory and drop it onto a character. These are native Item documents; each character owns its own copy and trackers.
- The character list groups Active, Passive, Reaction and Other records. Clicking the brass name opens the editor. Collapsible Details shows description, duration, recovery notes and general notes. Text is escaped and preserves line breaks. Remove requires confirmation and removes only that embedded ability.
- Set type/category, description and an optional icon path. The default is Foundry's built-in book SVG.
- **Costs:** blank AP means no AP cost is recorded; explicit 0 is supported. Choose None for a fixed entered price, or a stat for its current modifier's preview. World Items show the base cost until on a character. This is an editable record, not a class-based enforcement rule.
- Choose Mana, Holy power or a custom resource, amount, and Points or % of maximum. Mana/holy power remain selectable even if their pools are hidden. Costs are recorded and displayed, not deducted. Percentage costs refer to the resource maximum, not remaining points or the minimum-to-maximum display span.
- Custom pools are linked by stable ID: renaming Blood preserves the reference. Deleting the pool leaves the saved choice marked Missing resource. Copying an ability between characters with different custom pool IDs requires choosing the destination pool; names never silently rebind it. The world Item editor has no character custom pools, so configure those on a character copy.
- **Uses & cooldown:** blank Maximum uses means unlimited; explicit 0 is a tracked zero cap. When a finite maximum is set, new records start full. Uses left is editable, supports corrections outside the cap, and clearing it refills uses. Stored expenditure is preserved if the maximum changes or is temporarily cleared. Recovery is a text note, with no automatic rest/round reset.
- Cooldown rounds and remaining rounds are editable manual counters. Changing the duration does not start a timer or count it down. Duration is free text for rounds, minutes or special conditions. Long rest does not reset ability trackers in this record-only phase.
- Numeric controls follow whole-number entry/display while unchanged source fractions are preserved. Editing a description, category or cost does not reset uses/cooldown counters. Opening/reloading a sheet writes no actor/item data.
- Abilities contribute zero inventory slots and are excluded from Equipment. They do not equip, stow weapons, add stat bonuses, or alter armor. No existing actor/item fields are renamed or removed, and no migration runs.

## Validation

All 237 portable `node --test` cases pass. New cases cover AP discounts and limits/fixed costs, stable/missing resource references, use counts and maximum changes, manual summaries, inventory exclusion, native embedded creation, permissions, deletion confirmation, and full-form counter preservation.

Offline checks use actual Foundry v14.365 schemas and strict Handlebars rendering for standalone/owned records, nullable defaults and clearing, source/reload stability, AP preview, custom-resource selection, escaped descriptions/notes, read-only controls and inline rows. Existing resource and 42 interface regression checks remain green. Foundry's native ActorSheetV2 drop implementation was inspected and is used unchanged.

Not tested in a running Foundry client: creating/dropping/editing/removing records, live focus events, scrolling/mobile layout, simultaneous clients and user permissions in-world. The user tests the installed branch before merging. Restart Foundry and refresh player browsers, add a record, set AP 11 with INT/FTH discount, select Blood, record uses/cooldown, edit its description, reload, try a world Item drop and confirm resource balances/inventory totals remain unchanged. No live world/actor data is touched by offline checks or installation.
