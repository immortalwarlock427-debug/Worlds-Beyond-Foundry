# Sheet organization

The character sheet now uses Foundry v14's native ApplicationV2 tabs:

| Tab | Contents |
| --- | --- |
| Character | Resources, long rest, core numbers, defenses, stats/milestones, Adjust values and rules help |
| Equipment | Inventory, backpack, equipment rows, Add item and equipment help |
| Abilities | Ability records, effects and forms |
| Notes | Class, Race, Background, Appearance, Backstory and Notes, directly visible |

Portrait, name, Class/Race summary, level and tab navigation stay above the scrolling panel. The default window is 720 × 780, capped to the viewport; it can be resized. Narrow sheets use two rows of 44 px navigation buttons, two-column resources/core numbers and single-column stats/details as space requires. Existing navy/brass styling, stat colors, fields and actions are retained.

## Native behavior and data

`CharacterSheet.TABS` defines one group (`sheet`), initially `character`. Buttons use native `data-action="tab"`, group/id and pressed state. Native `changeTab` changes active classes and the in-memory tab selection without reconstructing the form or writing to the actor. Buttons remain available to read-only viewers after native form disabling; editing permissions remain unchanged.

All four panels remain in the DOM. Only the active panel is displayed, so inactive numeric controls, checkboxes and narrative fields retain their names, values and form behavior. Whole-number/fractional-value preservation, base-score editing and source-bonus corrections still run through the existing form adapter. Switching views does not spend resources or reset effects, forms, uses or cooldowns.

Each panel is registered with native Handlebars scroll synchronization. Disclosure `data-sync` identifiers are retained except for the removed outer character-details disclosure, which is unnecessary on its own Notes tab. The selected tab and scrolling are window-local UI state. Actor refreshes keep that selection; a newly created sheet instance starts on Character. Tab state is not a saved actor field or a cross-browser preference.

No actor/item fields, data migrations, rules calculations, combat flows or module dependencies are added. Native ActorSheetV2 drag/drop remains attached to the sheet root, so native item drops keep their existing behavior across views.

The website's current `index.html`, `js/sheet-layout.js` and `css/sheet.css` were consulted for section navigation, touch controls and responsive styling. Foundry provides the tab lifecycle instead of porting website navigation code.

## Validation

Portable tests cover selected-tab context across actor refreshes for owners/observers, alongside the full existing rules and adapter suite. Offline installed v14.365 model/strict-template checks exercise all four tabs for owners/observers, exactly one active panel, correct content grouping, unchanged submitted controls across views and unchanged actor source data. Existing resource/ability/effect/milestone/narrative save/reload and fractional-balance regressions pass.

An isolated headless Chromium preview checks the compiled markup and system CSS at 760, 390 and 340 px across all four tabs: no horizontal panel overflow, one displayed panel, 44 px navigation controls, fixed navigation, hidden form fields still serialized and a note draft retained while switching views. Screenshots were inspected. This preview uses a simplified frame and tab-class switching; it is not a live Foundry client. The native v14 tab/context, read-only handling, root drag/drop and disclosure/scroll implementation were inspected in local Foundry source.

Still to check in Foundry, after restarting and refreshing player browsers:

1. Switch all four tabs with mouse/touch and Tab/Enter/Space. Edit and leave a field before switching; verify autosave, the selected tab after an actor refresh, and data after closing/reopening/reloading.
2. Use an existing character with fractions, maximum overrides, earned stat points and active effects. Change a stat, toggle a form, equip armor and spend a resource; check refreshed totals and no balance reset across tabs.
3. Drop equipment and Ability Items from the native directory. Check item editors, attack/defense dialogs and milestone reference still open. Combat action behavior is unchanged.
4. Test an owner and a read-only observer. Tabs, rule references and Notes prose should stay readable while document edits remain protected.
5. Resize to phone widths/heights. Verify the header/nav remain visible, panel scrolling reaches every field, equipment actions fit, Notes can be resized and long names wrap/clip without horizontal overflow. Check scroll/disclosure position after a document update.

Live world, server, token and phone-client testing remains with the user, per their preference. Combat development remains paused until the user confirms the sheet is ready.
