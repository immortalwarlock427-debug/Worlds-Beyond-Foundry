# Sheet organization

## Native template parts

CharacterSheet uses seven ApplicationV2 parts: `header` (identity and navigation), `character`, `details`, `equipment`, `abilities`, `status` and `notes`. Each tab owns its root scroll position with `scrollable: [""]`. Details preloads two static Handlebars partials for resources and values/help. All nine files are directly under `templates/` and under 10 KB; no build step is added.

The existing `wb-body` layout class moves to Foundry's window-content container using `window.contentClasses`. A display-contents heading wrapper supplies the one root element required by native part rendering while keeping header/navigation geometry unchanged. All original tab classes, action attributes and field names remain. The former monolithic `character-sheet.hbs` is no longer loaded.

Show all abilities refreshes only the Abilities part. Show all resources refreshes Character and Details. Other tab DOM, including a pending Notes draft, remains in place. Full actor refreshes use the normal complete render; current tab, focus, scroll and synced disclosures retain Foundry's existing behavior. Shared context calculation is unchanged and will be separated in a later review item.

Validation compares the split against the pre-refactor template on the same native v14.365 model contexts: 36 filled/empty/long-name, owner/observer and active-tab cases have identical controls, action descriptors, rendered text and source data. An isolated browser runs the installed v14.365 HandlebarsApplicationMixin: 180 DOM/layout comparisons at 1280/1000/760/390/340 px match visible control geometry within 0.6 px. Native part synchronization restores focus, root scroll and open disclosures; partial Abilities/Character/Details renders preserve the actual Notes DOM node and draft. The Foundry socket transport and base document-sheet lifecycle are adapted offline; live autosave, drag/drop and real player browsers remain for user validation.

## Tab contents

The character sheet now uses Foundry v14's native ApplicationV2 tabs:

| Tab | Contents |
| --- | --- |
| Character | Circular portrait/stat overview, vitals/resources, defenses/movement/initiative and four favorite abilities |
| Details | Original resource controls, long rest, core numbers, defenses, stats/milestones, Adjust values and rules help |
| Equipment | Inventory, backpack, equipment rows, Add item and equipment help |
| Abilities | Ability records, forms, Use/End controls and Base form |
| Status | Currently active ability/form/equipment/native status sources only; End or open the source |
| Notes | Class, Race, Background, Appearance, Backstory and Notes, directly visible |

Name, level, race/current-form links and tab navigation stay above the scrolling panel. The default window is 880 × 900, capped to the viewport; it can be resized. Character holds the large circular portrait and play overview. Narrow navigation uses three columns, with a stacked overview and the existing responsive editors. The user's midnight/indigo/gold palette and existing stat-state colors are used. See [Character overview](CHARACTER-OVERVIEW.md). Inactive definitions stay in their ability/equipment editors, not Status. New standalone actor-effect creation is removed; saved actor-owned forms/adjustments appear under Abilities for compatibility.

## Native behavior and data

`CharacterSheet.TABS` defines one group (`sheet`), initially `character`. Buttons use native `data-action="tab"`, group/id and pressed state. Native `changeTab` changes active classes and the in-memory tab selection without reconstructing the form or writing to the actor. Buttons remain available to read-only viewers after native form disabling; editing permissions remain unchanged.

All six panels remain in the DOM. Only the active panel is displayed, so inactive numeric controls, checkboxes and narrative fields retain their names, values and form behavior. Whole-number/fractional-value preservation, base-score editing and source-bonus corrections still run through the existing form adapter. Switching views does not spend resources or reset effects, forms, uses or cooldowns.

Each panel is registered with native Handlebars scroll synchronization. Disclosure `data-sync` identifiers are retained except for the removed outer character-details disclosure, which is unnecessary on its own Notes tab. The selected tab and scrolling are window-local UI state. Actor refreshes keep that selection; a newly created sheet instance starts on Character. Tab state is not a saved actor field or a cross-browser preference.

Tab navigation itself adds no actor/item data, migrations, rules calculations, combat flows or module dependencies. The overview adds the optional favorite-reference field described in CHARACTER-OVERVIEW.md. Native ActorSheetV2 drag/drop remains attached to the sheet root, so native item drops keep their existing behavior across views.

The website's current `index.html`, `js/sheet-layout.js` and `css/sheet.css` were consulted for section navigation, touch controls and responsive styling. Foundry provides the tab lifecycle instead of porting website navigation code.

## Infinite Archive tab finish

Details, Equipment, Abilities, Status and Notes now share the overview's midnight/indigo surfaces, thin brass frame language, Amiri display typography and restrained cyan accents. Small page headings identify each record; common controls retain their familiar labels and actions.

- **Details:** framed current pools, luminous optional resource meters, grouped core/defense fragments and two attribute ledgers. Circular stat abbreviations roll as before; original effective/base colors and all correction controls remain. Settings and help stay collapsible.
- **Equipment:** a compact inventory ledger with a decorative capacity meter, grouped framed rows, visible icons and a brass equipped edge. The meter clamps visually without changing slots or restricting over-capacity inventory. Existing Attack/Use/Reload/Equip and quiet remove buttons remain.
- **Abilities:** the same grouped record style, live cost/uses/cooldown summaries, a cyan edge on active records and matching End state. Forms, Base, Show all and expandable descriptions keep their existing behavior.
- **Status:** only active sources, connected by a thin cyan line, with a count and the existing source/End controls. Empty Status gets a calm framed message; no inactive definitions or new effect creator are added.
- **Notes:** numbered chronicle panels with two columns for identity/history, full-width Backstory/Notes, readable multiline text and one column at narrow widths. Owner fields and observer prose are retained.

`styles/archive-tabs.css` loads after the overview stylesheet. Every rule is scoped to `.worlds-beyond.wb-character-sheet` and the five `data-record-tab` panels. Character, item editors, chat, the native sidebar and other applications keep their current presentation. The only markup additions are headings, presentation classes and a decorative capacity meter; no field, handler, schema or calculation changes are required.

For this finish, the website's current `css/sheet.css` was checked again. The user's approved Infinite Archive direction supplies the shared geometry/palette. Broader combat, spell effects and module work still follow final sheet validation.

## Validation

Portable tests cover selected-tab context across actor refreshes for owners/observers, alongside the full existing rules and adapter suite. Offline installed v14.365 model/strict-template checks exercise all six tabs for owners/observers, exactly one active panel, correct content grouping, unchanged submitted controls across views and unchanged actor source data. Existing resource/ability/effect/milestone/narrative save/reload and fractional-balance regressions pass.

The tab finish additionally compares every named control and button action attribute with merged main using the same native v14.365 context. They remain identical for owners/observers, including fractions and narrative escaping. Its populated preview includes all five equipment groups, all five ability categories, active bonuses and custom resource overflow. Ninety browser states cover all six tabs × populated owner/observer/empty sheets at 1120/1000/760/390/340 px with Foundry's actual CSS. Checks include lazy-loaded icons, horizontal overflow, expanded settings fields, 44 px primary actions and preserved AP/Notes drafts. Twelve desktop/narrow screenshots were prepared and inspected, including attributes lower on Details. These are isolated DOM/document adapters, not a running world; native autosave, drops, live item actions, socket permissions and actual phones remain for user review.

An isolated headless Chromium preview checks the compiled markup and system CSS at 760, 390 and 340 px across the original tabs, supplemented by the new overview checks in CHARACTER-OVERVIEW.md: no horizontal panel overflow, one displayed panel, 44 px navigation controls, fixed navigation, hidden form fields still serialized and a note draft retained while switching views. Screenshots were inspected. This preview uses a simplified frame and tab-class switching; it is not a live Foundry client. The native v14 tab/context, read-only handling, root drag/drop and disclosure/scroll implementation were inspected in local Foundry source.

Still to check in Foundry, after restarting and refreshing player browsers:

1. Switch all six tabs with mouse/touch and Tab/Enter/Space. Edit and leave a field before switching; verify autosave, the selected tab after an actor refresh, and data after closing/reopening/reloading.
2. Use an existing character with fractions, maximum overrides, earned stat points and active effects. Change a stat, toggle a form, equip armor and spend a resource; check refreshed totals and no balance reset across tabs.
3. Drop equipment and Ability Items from the native directory. Check item editors, attack/defense dialogs and milestone reference still open. Combat action behavior is unchanged.
4. Test an owner and a read-only observer. Tabs, rule references and Notes prose should stay readable while document edits remain protected.
5. Resize to phone widths/heights. Verify the header/nav remain visible, panel scrolling reaches every field, equipment actions fit, Notes can be resized and long names wrap/clip without horizontal overflow. Check scroll/disclosure position after a document update.

Live world, server, token and phone-client testing remains with the user, per their preference. The user has explicitly resumed the targeted combat actions documented in ITEM-BONUSES-ACTIONS.md.
