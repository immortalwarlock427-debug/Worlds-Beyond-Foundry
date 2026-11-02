# Character overview

The Character tab is now a play overview inspired by the user's circular-artwork references and Infinite Archive palette: midnight/indigo panels, ivory text, celestial gold, restrained cyan/amethyst light and rose resource accents. A large circular Actor portrait sits toward the center-left, with all eight current stats in circular medallions. Identity shows name, level, race and current form. The page includes Health, enabled/form-visible resources, AP (including Command), reactions, Wonder, Natural Evasion, Armor Rating, movement/AP, initiative modifier, hit die and four favorite ability slots.

The previous complete Character controls remain together under **Details**, with the same input names, stat editing behavior, settings, corrections, roll setup, defenses and help. No editor or saved field was removed. The original Equipment/Abilities/Status/Notes views remain separate. The sheet opens at 880 × 900, adapts at narrower widths and keeps navigation above a scrolling panel.

## Quick interactions

- Click a circular stat to open the existing check/save dialog. Teal means adjusted, gold means manually edited and purple means both. Milestone diamonds remain visible; the toolbar opens the complete milestone reference. **Edit attributes** goes directly to Details and focuses the stat editor. Effective/base/reset behavior is unchanged.
- Click Health, AP/reactions/Wonder or a resource card to open Details and focus its existing editor. The overview has no duplicate numeric inputs, so a form save cannot accidentally overwrite a different displayed copy. Owner edits use the original expenditure/whole-number handling. Observers can navigate to read-only details.
- **Favorite abilities → Choose** assigns four slots. Empty slots can also open the chooser. Favorites store references to owned native Ability Items or saved legacy ability/form UUIDs. Names open their source; Use/End calls the same activation/payment handlers as the Abilities list. Passive records offer Open. Compact summaries use current costs; full summaries are available on hover. Deleted sources show a replaceable placeholder rather than selecting another similarly named ability.
- Favorites remain shared across forms and are explicit shortcuts, even when a form's ability-list filter hides that definition. Changing favorites spends nothing and does not create/copy an ability. Newly loaded characters have four empty slots and no automatic preference writes.
- The race/form tags open Notes/Abilities. Portrait selection uses the existing picker and active form portrait behavior. Command/Long rest retain their original actions. Initiative displays the current WIS modifier for **1d20 + WIS**, not an encounter's rolled initiative result.

## Data and scope

Additive `Actor.system.favorites` is a String ArrayField, default empty. The editor writes only four reference slots. No existing data fields are renamed, removed or migrated. Health/resources, stat math, costs, equipment, timers and form loadouts use their existing calculations/actions. Bars retain fractional geometry while visible values remain whole numbers; overflow gets a cyan/rose accent. Presentation lives in scoped `styles/overview.css`, loaded after the existing stylesheet. Foundry's canvas/sidebar and other systems are untouched. The supplied screenshots are visual references, not executable requirements or a source of new game rules.

The current website's `css/sheet.css` was consulted for identity, portrait, stat-state colors and typography. The user's new palette/layout takes precedence for this page. Existing character art is used; no reference-sheet artwork or generated character image is bundled.

## Validation

Portable tests cover four stable references, current cost/active-state summaries, passive/legacy records, duplicate/missing selections, cancellation, ownership changes, stale/deleted definitions, ignored saves, and bounded/fractional meters. Native v14.365 TypeDataModel and strict owner/observer templates verify empty defaults, eight effective medallions, four shortcuts, color states, escaping, source immutability and unique original form fields in Details. Prior schema/form/resource/ability/form-loadout checks remain in place.

Forty isolated browser checks cover populated/empty/observer/chooser views and all six tabs at 1000/760/390/340 px: no horizontal overflow, loaded artwork, eight stat circles, four slots and touch-sized primary controls. Draft notes survive navigation. The real overview navigation action was exercised against rendered DOM to open Details and focus Health. Desktop/narrow screenshots were inspected. Browser frames and document/network context are offline adapters.

Not yet checked inside the running world: native tab/focus/autosave lifecycle, favorite activation/payment via live sockets, picker behavior, browser font loading, player permissions and actual phone use. Restart Foundry and refresh player browsers, then compare the overview with Details, try all eight rolls, edit a resource through its card, assign/use/end four favorites, switch forms and reload. Verify exact balances and manual stat states remain correct. The visual redesign precedes the final character-sheet audit; broader combat, spell visuals and module integrations remain deferred.
