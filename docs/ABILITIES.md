# Ability records

Native Ability Items now support self bonuses and Use/End controls in addition to editable records. See [item bonuses and combat actions](ITEM-BONUSES-ACTIONS.md) for activation costs and scope. Attack/damage casting, automatic recovery/timers, targeting and animations remain deferred.

## Sources and scope

Read 2026-11-01: Notion [Game Systems](https://app.notion.com/p/351c72092efb8089812cd231debc3e74), [Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73) and [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6). AP modifiers change costs by at most half the base cost rounded down in either direction; spells normally start at 11 AP. The preview reuses the existing Foundry-free `actionApCost` function. No new combat math is introduced.

The current website `js/abilities.js` was consulted for active/passive/reaction/other types, categories, descriptions, a selected AP discount stat, resource references, uses, cooldowns, duration and notes. The Foundry roadmap calls for records first. The website's effect targets and activation costs inform the native Foundry implementation; its full casting, targeting and timer engine is not ported. Weavecasting remains separate.

## Use

- On a character, choose **Abilities → Add ability**. Or create an **Ability** in Foundry's Items directory and drop it onto a character. These are native Item documents; each character owns its own copy and trackers.
- The character list groups Active, Passive, Reaction, Forms and Other records. **Add form** creates a Form-type Ability Item; it uses the same bonus and cost editor. Use replaces the previous form, and End or Base form ends it for free. Ordinary buffs remain independent. Clicking the brass name opens the editor. Collapsible Details shows description, duration, recovery notes and general notes. Text is escaped and preserves line breaks. Remove requires confirmation and removes only that embedded ability.
- Set type/category, description and an optional icon path. The default is Foundry's built-in book SVG.
- **Costs:** blank AP means no AP cost is recorded; explicit 0 is supported. Choose None for a fixed entered price, or a stat for its current modifier's preview. World Items show the base cost until on a character. This is an editable record, not a class-based enforcement rule.
- Choose Mana, Holy power or a custom resource, amount, and Points or % of maximum. Mana/holy power remain selectable even if their pools are hidden. Use deducts the selected resource; hidden Mana/Holy power must first be enabled in Resources. Percentage payment retains fractional points internally. Percentage costs refer to the resource maximum, not remaining points or the minimum-to-maximum display span.
- Custom pools are linked by stable ID: renaming Blood preserves the reference. Deleting the pool leaves the saved choice marked Missing resource. Copying an ability between characters with different custom pool IDs requires choosing the destination pool; names never silently rebind it. The world Item editor has no character custom pools, so configure those on a character copy.
- **Uses & cooldown:** blank Maximum uses means unlimited; explicit 0 is a tracked zero cap. When a finite maximum is set, new records start full. Uses left is editable, supports corrections outside the cap, and clearing it refills uses. Stored expenditure is preserved if the maximum changes or is temporarily cleared. Recovery is a text note, with no automatic rest/round reset.
- Cooldown rounds and remaining rounds are editable manual counters. Use starts the entered cooldown, but changing duration does not start a timer or count it down. Duration is free text for rounds, minutes or special conditions. Long rest does not reset these manual ability trackers.
- Numeric controls follow whole-number entry/display while unchanged source fractions are preserved. Editing a description, category or cost does not reset uses/cooldown counters. Opening/reloading a sheet writes no actor/item data.
- Abilities contribute zero inventory slots and are excluded from Equipment. They do not equip or stow weapons. Bonuses on the ability can adjust stats, defenses, movement and resource maxima; passive bonuses apply while owned, active ones while enabled. No existing actor/item fields are renamed or removed, and no migration runs.
- **Status** shows active bonuses from their source only. An inactive ability definition stays here in Abilities; after Use its active bonuses appear once under its name in Status. End from either view ends the ability without deleting its definition. Disabled/expired bonuses are hidden. Saved actor-owned forms/adjustments from older sheets also remain usable here; they keep their original stored representation and cost-free controls. New definitions use Ability Items.

## Validation

The portable `node --test` suite covers the records and activation adapters. New cases cover AP discounts and limits/fixed costs, stable/missing resource references, use counts and maximum changes, manual summaries, inventory exclusion, native embedded creation, permissions, deletion confirmation, and full-form counter preservation.

Offline checks use actual Foundry v14.365 schemas and strict Handlebars rendering for standalone/owned records, nullable defaults and clearing, source/reload stability, AP preview, custom-resource selection, escaped descriptions/notes, read-only controls and inline rows. Existing resource and 42 interface regression checks remain green. Foundry's native ActorSheetV2 drop implementation was inspected and is used unchanged.

Not tested in a running Foundry client: creating/dropping/editing/removing records, live focus events, scrolling/mobile layout, simultaneous clients and user permissions in-world. The user tests the installed branch before merging. Restart Foundry and refresh player browsers, add a record, set AP 11 with INT/FTH discount, select Blood, record uses/cooldown, edit its description, reload, try a world Item drop and confirm resource balances/inventory totals remain unchanged. No live world/actor data is touched by offline checks or installation.
