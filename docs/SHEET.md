# Character sheet guide

Character is the play overview; Details holds stat/resource editors and corrections; Equipment, Abilities, Status and Notes organize the rest. Use the [30-minute desktop audit](CHARACTER-SHEET-AUDIT.md) for release validation. The [roadmap](ROADMAP.md) is the single source for completion status.

The sections below consolidate the original design, rules-source and regression notes. Test counts and version-specific observations are historical evidence, not the current release status. Current controls include automatic equipped armor, short rests and turn refills; map movement spending remains deferred.


## Contents

- [Character overview](#character-overview)
- [Sheet organization](#sheet-tabs)
- [Character details and notes](#character-details)
- [Stat generation and level-up points](#stat-setup)
- [Core numbers](#core-numbers)
- [Milestone details](#milestones)
- [Rolls and Wonder](#rolls)
- [Whole-number controls and presentation](#number-display)
- [Compact interface](#interface)
- [Chat and equipment polish](#visual-polish)


<a id="character-overview"></a>
## Character overview

The Character tab is now a play overview inspired by the user's circular-artwork references and Infinite Archive palette: midnight/indigo panels, ivory text, celestial gold, restrained cyan/amethyst light and rose resource accents. A large circular Actor portrait sits toward the center-left, with all eight current stats in circular medallions. Identity shows name, level, race and current form. The page includes Health, enabled/form-visible resources, AP (including Command), reactions, Wonder, Natural Evasion, Armor Rating, movement/AP, initiative modifier, hit die and four favorite ability slots.

The shared identity header shows Class and Race only when their Notes fields contain text. Form appears once the actor has a native or saved legacy form definition; it shows the named Base while untransformed and the active form otherwise. Separators appear only between visible labels. Clearing Race or deleting the last form removes its header label without deleting appearance settings. Hit die has its own padded caption row below the lowest stat medallion.

The previous complete Character controls remain together under **Details**, with the same input names, stat editing behavior, settings, corrections, roll setup, defenses and help. No editor or saved field was removed. The original Equipment/Abilities/Status/Notes views remain separate. The sheet opens at 880 × 900, adapts at narrower widths and keeps navigation above a scrolling panel.

The polish pass treats this as a connected celestial record: a dark void vortex behind the portrait, a gold spine linking resource fragments, convergence lines into the four numbered favorite seals, and utilities within that same foundation. Each stat places its 21/28 diamonds to the left/right of the number, with separate abbreviation and modifier rows. Native button layout is explicitly reset so labels and meters cannot collapse horizontally. Health uses a segmented rose meter; AP/reactions/Wonder use gold/cyan/amethyst meters with one segment per maximum point up to 24 (a continuous meter for larger/fractional maxima). Custom pools retain luminous cyan and overflow accents. The original native window title is visually quieter but remains present for identification and window controls.

Prominent values and names use Foundry's bundled **Amiri** face; headings keep Marcellus SC and small labels/controls retain Alegreya Sans with readable system fallbacks. No new font download or dependency is required.

The resource column now shares a framed spine with short links to Health, action economy, each pool and defenses. Matching inset edges and aligned metric values keep the fragments part of one record. Spacing is tighter without changing bar geometry or custom colors. The lower foundation links four numbered seals; each populated favorite keeps its ability icon visible at every width, allows a two-line name, shows its current cost beneath it and retains a separate 44 px Use/End control. Active sources give their card and seal a restrained cyan/amethyst accent. Empty slots keep the same structure; on a narrow sheet the connecting line flows vertically. Status, its count and the existing utilities remain in the foundation's footer.

<a id="character-overview-portrait-void-vortex"></a>
### Portrait void vortex

The previous circular linework, tick marks and geometric inscriptions are replaced by a black central well, asymmetric accretion streams, dust and layered haze. `icons/void-vortex.svg` is local vector artwork: broad tapered spiral ribbons with translucent gradients, static displacement/blur and scattered dust. CSS radial/conic gradients, masks and shadow layers add depth behind the unchanged circular portrait. The stats sit above every decorative layer; the effect cannot intercept pointer events.

Only the background streams rotate, once every 180 seconds. Inactive tabs pause the animation, and `prefers-reduced-motion: reduce` disables it. The static SVG is decoded as an image; its turbulence/filter parameters are never animated. Portrait framing, image selection, form switching, stats, favorite actions and stored data are unchanged.

A stationary elliptical opacity mask fades the complete vortex composite to transparent at all four bounds. The moving streams, haze, shadows, dust and any future texture share that fade, so rotation and wider portrait panels do not expose a rectangular top/side cutoff. The portrait, stat medallions and toolbar remain outside the mask. The portrait image's separate, narrow edge feather also uses valid eight-digit alpha color syntax.

An optional future texture has its own `.wb-vortex-texture` layer behind the portrait, already masked and blended. It defaults to no image. A trusted stylesheet can set `--wb-vortex-texture: url(...)` later without changing the markup; there is no new saved texture field or user upload control in this pass.

<a id="character-overview-quick-interactions"></a>
### Quick interactions

- Click a circular stat to open the existing check/save dialog. Teal means adjusted, gold means manually edited and purple means both. Milestone diamonds remain visible; the toolbar opens the complete milestone reference. **Edit attributes** goes directly to Details and focuses the stat editor. Effective/base/reset behavior is unchanged.
- Click Health, AP/reactions/Wonder or a resource card to open Details and focus its existing editor. The overview has no duplicate numeric inputs, so a form save cannot accidentally overwrite a different displayed copy. Owner edits use the original expenditure/whole-number handling. Observers can navigate to read-only details.
- **Favorite abilities → Choose** assigns four slots. Empty slots can also open the chooser. Favorites store references to owned native Ability Items or saved legacy ability/form UUIDs. Names open their source; Use/End calls the same activation/payment handlers as the Abilities list. Passive records offer Open. Compact summaries use current costs; full summaries are available on hover. Deleted sources show a replaceable placeholder rather than selecting another similarly named ability.
- Favorites remain shared across forms and are explicit shortcuts, even when a form's ability-list filter hides that definition. Changing favorites spends nothing and does not create/copy an ability. Newly loaded characters have four empty slots and no automatic preference writes.
- The race/form tags open Notes/Abilities. Portrait selection uses the existing picker and active form portrait behavior. Command/Long rest retain their original actions. Initiative displays the current WIS modifier for **1d20 + WIS**, not an encounter's rolled initiative result.
- **Base form name → pencil**, **Abilities → Rename base form**, or **Attributes → sliders icon** opens Appearance: rename Base Form (for example Human Form), and preview vertical portrait framing with a 0–100 slider. The name field receives initial focus. The header rename shortcut appears while in Base; an active transformation's header label still opens Abilities. Save applies the framing to the form that was active when opened, or to Base; changing forms while the dialog is open asks you to reopen it. Cancel writes nothing. Clearing the Base name restores the default label. The separate Base button in Abilities still ends the current transformation.
- **Abilities → open a Form → Form loadout → Choose form portrait** opens Foundry's normal image picker. Each native Form Ability Item already supports its own portrait; its optional vertical framing field is now beside the path. Blank framing inherits Base. Clicking the large portrait still changes artwork for the current form. End/Base restores the saved Base artwork and its framing. Framing changes the circular sheet crop, not the underlying image or token art. Saved legacy ActiveEffect forms inherit Base framing; their existing data remains intact.

<a id="character-overview-data-and-scope"></a>
### Data and scope

Additive `Actor.system.favorites` is a String ArrayField, default empty. The editor writes only four reference slots. No existing data fields are renamed, removed or migrated. Health/resources, stat math, costs, equipment, timers and form loadouts use their existing calculations/actions. Bars retain fractional geometry while visible values remain whole numbers; overflow gets a cyan/rose accent. Presentation lives in scoped `styles/overview.css`, loaded after the existing stylesheet. Foundry's canvas/sidebar and other systems are untouched. The supplied screenshots are visual references, not executable requirements or a source of new game rules.

Appearance adds `Actor.system.appearance.baseFormName` (blank defaults to Base Form), `Actor.system.appearance.portraitY` (35), and `Ability.system.loadout.portraitY` (nullable, inherits Base). Values are integer 0–100. Only appearance fields are written; images, gear and resources continue using the tested form-loadout switch. Partial appearance saves compensate the other written field and report any save failure. The supplied Monstrous illustration is used only in the isolated preview, not bundled or assigned to a live actor.

The current website's `css/sheet.css` was consulted for identity, portrait, stat-state colors and typography. The user's new palette/layout takes precedence for this page. Existing character art is used; no reference-sheet artwork or generated character image is bundled.

<a id="character-overview-validation"></a>
### Validation

Portable tests cover four stable references, current cost/active-state summaries, passive/legacy records, duplicate/missing selections, cancellation, ownership changes, stale/deleted definitions, ignored saves, and bounded/fractional meters. Native v14.365 TypeDataModel and strict owner/observer templates verify empty defaults, eight effective medallions, four shortcuts, color states, escaping, source immutability and unique original form fields in Details. Prior schema/form/resource/ability/form-loadout checks remain in place.

Fifty-five isolated browser checks load Foundry's actual v14.365 stylesheet and cover populated/empty/observer/chooser/appearance views and all six tabs at 1280/1000/760/390/340 px: no horizontal overflow, loaded artwork, visible resource meter tracks, contained medallion contents, eight stat circles, four slots and touch-sized primary controls. Draft notes survive navigation. The real overview navigation action was exercised against rendered DOM to open Details and focus Health. Desktop/narrow screenshots were inspected. Browser frames and document/network context are offline adapters. Portable tests also cover Base/form framing, inheritance, escaped previews, cancellation, unchanged/ignored saves, partial-save rollback, changed forms and lost ownership.

Not yet checked inside the running world: native tab/focus/autosave lifecycle, favorite activation/payment via live sockets, picker behavior, browser font loading, player permissions and actual phone use. Restart Foundry and refresh player browsers, then compare the overview with Details, try all eight rolls, edit a resource through its card, assign/use/end four favorites, switch forms and reload. Verify exact balances and manual stat states remain correct. The visual redesign precedes the final character-sheet audit; broader combat, spell visuals and module integrations remain deferred.

The void refinement passes the full 375-test suite. Native v14.365/strict-template checks compare the original named controls and action count with main and verify unchanged source data. Sixty isolated browser states at 1280/1000/760/390/340 px cover supplied/default portraits, owner/observer/empty views, all tabs, SVG loading, unobstructed portrait/stat hit targets, hidden-tab pause and reduced-motion disabling. Desktop/narrow previews were visually inspected. Live GPU/phone performance and the user's aesthetic review remain for validation in Foundry.

The connected-fragment/favorite follow-up preserves all named form controls and action counts against the Base Form rename commit. Seventy isolated browser cases include long names, several optional resources, no optional resources, overflowing pools, owner/observer/empty states, preferences and all six tabs. Favorite images load at every width, primary targets remain at least 44 px high and the overview-to-Details focus action still works. Models and source balances remain unchanged by rendering. Native client/socket behavior and the user's actual character layout remain for live review.

<a id="sheet-tabs"></a>
## Sheet organization

<a id="sheet-tabs-native-template-parts"></a>
### Native template parts

CharacterSheet uses seven ApplicationV2 parts: `header` (identity and navigation), `character`, `details`, `equipment`, `abilities`, `status` and `notes`. Each tab owns its root scroll position with `scrollable: [""]`. Details preloads two static Handlebars partials for resources and values/help. All nine files are directly under `templates/` and below 12 KB after expanding attribute lists for readability; no build step is added.

The existing `wb-body` layout class moves to Foundry's window-content container using `window.contentClasses`. A display-contents heading wrapper supplies the one root element required by native part rendering while keeping header/navigation geometry unchanged. All original tab classes, action attributes and field names remain. The former monolithic `character-sheet.hbs` is no longer loaded.

Show all abilities refreshes only the Abilities part. Show all resources refreshes Character and Details. Other tab DOM, including a pending Notes draft, remains in place. Full actor refreshes use the normal complete render; current tab, focus, scroll and synced disclosures retain Foundry's existing behavior.

`module/character-context.mjs` prepares read-only presentation data through separate header, Character, Details, Equipment, Abilities, Status and Notes helpers. Stat rows and resource projections are shared. The sheet adapter supplies read-only stored source values, prepared equipment rows and combat-dependent Command readiness. The presenters import existing rules functions, require no Foundry globals and never save or prepare a document. Context keys and values are preserved.

Desktop Foundry and ordinary window resizing are now the validation priority, following the user's 2026-11-02 preference. Existing narrow styling remains; historical phone checks below describe prior testing and additional phone work is deferred.

JavaScript modules and tests use the checked-in Prettier configuration (version 3.6.2, two spaces, 140-column target). Long template opening tags place attributes on separate lines; Handlebars expressions, values and surrounding text are preserved. Long literal strings remain intact. The formatting pass compares semantic JavaScript ASTs for all 100 modules/tests and exact template text/attribute tokens for all 23 templates. All 385 portable tests, 48 native-model context/control comparisons and 192 offline desktop DOM/layout comparisons pass, including native focus/scroll/disclosure restoration and Notes draft retention. Live document actions remain for user testing.

Base stat preparation, sheet context preparation and form processing read the native system model's `_source` without serializing the whole model. They never write through it. Working prepared stats, display projections and update payloads remain separate; intentional actor cloning for changed Health/resource totals remains. Adapter regression fixtures reject accidental source serialization. Offline v14.365 checks use deeply frozen sources: 48 context/control/text cases, 12 repeated preparation comparisons and 48 form-update comparisons match the previous implementation, including earned/manual/effect stats, fractional pools, Command AP, resource overflow and narrative edits. The measured preparation/form paths perform zero full source copies versus 64 in the old comparison run; this is a call count, not a live performance benchmark. All 385 portable tests pass. Actual world autosave, effects, sockets and player clients still need the user's live check.

The context extraction passes five Foundry-free presenter tests and compares its complete output with the previous sheet method in 48 native-model cases, including modified/manual stats and fractional Command/resource values. Across 192 desktop/window comparisons at 1280/1000/880/760 px, the same templates, DOM and control geometry remain unchanged. Native scroll/focus/disclosure synchronization and preservation of an unrelated Notes draft still pass. Real document/socket behavior remains for the user's live check.

Validation compares the split against the pre-refactor template on the same native v14.365 model contexts: 36 filled/empty/long-name, owner/observer and active-tab cases have identical controls, action descriptors, rendered text and source data. An isolated browser runs the installed v14.365 HandlebarsApplicationMixin: 180 DOM/layout comparisons at 1280/1000/760/390/340 px match visible control geometry within 0.6 px. Native part synchronization restores focus, root scroll and open disclosures; partial Abilities/Character/Details renders preserve the actual Notes DOM node and draft. The Foundry socket transport and base document-sheet lifecycle are adapted offline; live autosave, drag/drop and real player browsers remain for user validation.

<a id="sheet-tabs-tab-contents"></a>
### Tab contents

The character sheet now uses Foundry v14's native ApplicationV2 tabs:

| Tab | Contents |
| --- | --- |
| Character | Circular portrait/stat overview, vitals/resources, defenses/movement/initiative and four favorite abilities |
| Details | Original resource controls, long rest, core numbers, defenses, stats/milestones, Adjust values and rules help |
| Equipment | Inventory, backpack, equipment rows, Add item and equipment help |
| Abilities | Ability records, forms, Use/End controls and Base form |
| Status | Currently active ability/form/equipment/native status sources only; End or open the source |
| Notes | Class, Race, Background, Appearance, Backstory and Notes, directly visible |

Name, level, race/current-form links and tab navigation stay above the scrolling panel. The default window is 880 × 900, capped to the viewport; it can be resized. Character holds the large circular portrait and play overview. Narrow navigation uses three columns, with a stacked overview and the existing responsive editors. The user's midnight/indigo/gold palette and existing stat-state colors are used. See [Character overview](SHEET.md#character-overview). Inactive definitions stay in their ability/equipment editors, not Status. New standalone actor-effect creation is removed; saved actor-owned forms/adjustments appear under Abilities for compatibility.

<a id="sheet-tabs-native-behavior-and-data"></a>
### Native behavior and data

`CharacterSheet.TABS` defines one group (`sheet`), initially `character`. Buttons use native `data-action="tab"`, group/id and pressed state. Native `changeTab` changes active classes and the in-memory tab selection without reconstructing the form or writing to the actor. Buttons remain available to read-only viewers after native form disabling; editing permissions remain unchanged.

All six panels remain in the DOM. Only the active panel is displayed, so inactive numeric controls, checkboxes and narrative fields retain their names, values and form behavior. Whole-number/fractional-value preservation, base-score editing and source-bonus corrections still run through the existing form adapter. Switching views does not spend resources or reset effects, forms, uses or cooldowns.

Each panel is registered with native Handlebars scroll synchronization. Disclosure `data-sync` identifiers are retained except for the removed outer character-details disclosure, which is unnecessary on its own Notes tab. The selected tab and scrolling are window-local UI state. Actor refreshes keep that selection; a newly created sheet instance starts on Character. Tab state is not a saved actor field or a cross-browser preference.

Tab navigation itself adds no actor/item data, migrations, rules calculations, combat flows or module dependencies. The overview adds the optional favorite-reference field described in CHARACTER-OVERVIEW.md. Native ActorSheetV2 drag/drop remains attached to the sheet root, so native item drops keep their existing behavior across views.

The website's current `index.html`, `js/sheet-layout.js` and `css/sheet.css` were consulted for section navigation, touch controls and responsive styling. Foundry provides the tab lifecycle instead of porting website navigation code.

<a id="sheet-tabs-infinite-archive-tab-finish"></a>
### Infinite Archive tab finish

Details, Equipment, Abilities, Status and Notes now share the overview's midnight/indigo surfaces, thin brass frame language, Amiri display typography and restrained cyan accents. Small page headings identify each record; common controls retain their familiar labels and actions.

- **Details:** framed current pools, luminous optional resource meters, grouped core/defense fragments and two attribute ledgers. Circular stat abbreviations roll as before; original effective/base colors and all correction controls remain. Settings and help stay collapsible.
- **Equipment:** a compact inventory ledger with a decorative capacity meter, grouped framed rows, visible icons and a brass equipped edge. The meter clamps visually without changing slots or restricting over-capacity inventory. Existing Attack/Use/Reload/Equip and quiet remove buttons remain.
- **Abilities:** the same grouped record style, live cost/uses/cooldown summaries, a cyan edge on active records and matching End state. Forms, Base, Show all and expandable descriptions keep their existing behavior.
- **Status:** only active sources, connected by a thin cyan line, with a count and the existing source/End controls. Empty Status gets a calm framed message; no inactive definitions or new effect creator are added.
- **Notes:** numbered chronicle panels with two columns for identity/history, full-width Backstory/Notes, readable multiline text and one column at narrow widths. Owner fields and observer prose are retained.

`styles/archive-tabs.css` loads after the overview stylesheet. Every rule is scoped to `.worlds-beyond.wb-character-sheet` and the five `data-record-tab` panels. Character, item editors, chat, the native sidebar and other applications keep their current presentation. The only markup additions are headings, presentation classes and a decorative capacity meter; no field, handler, schema or calculation changes are required.

For this finish, the website's current `css/sheet.css` was checked again. The user's approved Infinite Archive direction supplies the shared geometry/palette. Broader combat, spell effects and module work still follow final sheet validation.

<a id="sheet-tabs-validation"></a>
### Validation

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

<a id="character-details"></a>
## Character details and notes

Open the **Notes** tab for Character details & notes. Fields are visible directly, with entered Class/Race shown beneath the name beside the current form in the shared header. A blank or whitespace-only Class adds no label or separator; the saved text remains unchanged. Clicking the Class or Race label opens Notes. It uses the same navy/brass palette as the rest of the sheet. Native tab state keeps the selected view during sheet refreshes.

- **Class** and **Race** are free text, matching the website's character identity fields.
- **Background** and **Appearance** are shorter multiline fields.
- **Backstory** and **Notes** use full-width multiline fields. Notes can hold session reminders, languages, connections or other text.

An owner edits through normal Foundry submit-on-change behavior: leaving a changed field saves it. Fields can be cleared. Read-only viewers see escaped, wrapped prose with preserved line breaks rather than disabled text boxes. These notes follow the actor's ordinary permissions; they are not a separate private/GM-only journal.

Text is stored literally, not as rich HTML. Line breaks, spaces, Unicode, decimal text and notation such as 1.5× are retained. Class/Race/Background text does not grant rules effects or change stats. The main sheet's numeric controls retain their existing whole-number behavior.

<a id="character-details-data"></a>
### Data

Additive `system.details` SchemaField with six StringFields: `class`, `race`, `background`, `appearance`, `backstory` and `notes`. All default to an empty string, allow clearing and disable trimming. Existing actors gain empty fields through native schema defaults; no migration or world data edit is needed. No existing fields are renamed or removed.

Narrative controls use saved source values. Unchanged details are omitted from unrelated whole-sheet submissions, so changing a stat does not resubmit the stored story. Only changed narrative keys are submitted. Existing Health/resource handling still preserves damage/expenditure and hidden fractional balances.

The website's current `index.html` identity and character-notes sections were consulted for labels, plain-text editing and multiline layout. The four narrative fields follow this repository's character-sheet roadmap. Class and Race are descriptive, with no new rules interpretation. See [sheet organization](SHEET.md#sheet-tabs) for tab behavior.

<a id="character-details-validation"></a>
### Validation

Portable tests cover unchanged detail omission, deliberate clearing, literal text and whitespace preservation, and absence of unintended resource/stat updates. `node --test` runs the existing rules and adapter regression suite.

Offline checks using installed v14.365 DataModel fields and strict Handlebars templates verify:

- Old actor data gains six blank defaults while its other stored fields remain unchanged.
- Newlines, spacing, Unicode, literal HTML and decimal notation survive save/reload/clearing.
- Owner fields have the correct native form names; read-only output has no narrative form controls and escapes markup.
- Rendering does not mutate stored data; unrelated saves omit unchanged details.
- Narrative updates leave exact Health, AP and Mana balances unchanged. Prior interface/resource/ability/effect/milestone checks still pass.

The user validated the initial fields. Following the tab organization, check owner autosave on leaving fields, tab switching, reopen/reload, empty-field clearing, a long multiline paste, header updates, read-only viewing and narrow/phone layout. Also change a stat or spend a resource on Character and confirm the story stays intact on Notes.

<a id="stat-setup"></a>
## Stat generation and level-up points

Version 0.16.0 adds **Roll & assign** and **Stat points** above the eight attributes. Both are draft windows: only Apply/Save writes to the character. Closing cancels the draft. The existing score fields remain editable.

<a id="stat-setup-sources"></a>
### Sources

- [Notion: Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4), read 2026-11-01: roll **2d6 + 1d12 eight times**, assign freely; levels **4, 8, 12, 16 and 19** grant **4 points each**, at most **2 to one stat per award**. Natural advancement reaches 28; magic may exceed it.
- Current website [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html) and [js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), read 2026-11-01: independent result slots, assigning/swapping scores, rolling one or filling the pool, editable per-award allocations and optional help. The interface is rebuilt in ApplicationV2; the website files are unchanged.
- The website's older Health/Mana advancement history conflicts with current Notion's current-stat formulas. This feature ports stat generation/awards only; existing Foundry Health and other derived values keep the current Notion calculations.

<a id="stat-setup-behavior-and-data"></a>
### Behavior and data

The generator uses Foundry's dice engine without posting to chat. Roll one fills the first blank; Roll remaining fills blanks; Reroll eight replaces a full draft. Typed scores can replace any result. A destination change swaps assignments so each result is used once, including equal totals. Blank results leave their stat unchanged. Apply establishes the selected new base scores and clears their manual-edit/reset flags; awards, gear and Active Effects still add afterward. Manual/lore exceptions remain possible through typed scores and ordinary sheet corrections. Draft roll results are not saved on close.

The additive `system.advancement` schema stores `level4`, `level8`, `level12`, `level16` and `level19`, each with the eight stat keys and zero initial points. No existing field is removed or renamed. Existing actors gain zero allocations and retain all current scores. If a player already included an award in a manually entered base, correct that base before recording it here; old scores cannot identify which points were previously added by hand.

`prepareBaseData` adds earned allocations before Foundry applies initial Active Effects; derived stats, modifiers, milestones, armor, Health and pools therefore use the augmented scores. Prepared totals never overwrite stored scores. As clarified for 0.16.1, earned points become part of the displayed/editable base and keep the normal color. Only gear/effects beyond that base use teal; manual edits use gold, and manual edits with gear/effects use purple. Clearing a manual edit restores its remembered base plus currently earned points. Resource spending and damage deficits are not reset by saving scores or points.

Editing a base of 21 (stored 19 + 2 earned points) to 22 stores 20, so the two earned points are counted once. Gear +2 then displays 24 in purple; clearing the edit restores 23 (original 19 + 2 earned + 2 gear). Stored pre-award components remain integers but may be negative for manual exceptions below the earned-point total; no field is removed or renamed, and existing saved numbers/allocations are not rewritten.

Each earned award may spend up to four integer points, up to two in one stat. The guided + controls stop at natural 28, using bases and awards without gear/effects; direct manual corrections remain available. Save revalidates the draft and ownership. Award changes can be undone with minus or Reset award. Lowering a level **suspends** higher awards without deleting choices; raising it restores them. This intentionally preserves corrections rather than copying the website's destructive level-down behavior. There are no extra awards at 20 or later.

Stat/award/level changes elsewhere invalidate an open draft rather than silently overwriting newer data. Unrelated resource changes do not invalidate it. Local duplicate Apply actions are serialized; the update writes absolute base scores or allocation counts, never repeated increments. This is a correction-friendly sheet, not a cross-client locking or audit system.

<a id="stat-setup-validation"></a>
### Validation

Run `node --test`. Rules tests cover thresholds, per-award budgets, natural cap, suspending/re-enabling awards, assignments and partial/typed score updates. Adapter tests cover dice generation, failure recovery, permissions, stale drafts, duplicate saves and allocation-only writes. Local checks against Foundry 14.365's real data model and strict Handlebars cover form compatibility, new/old actors, derived values, manual reset plus effects, preserved pools, and generation/award templates at levels 1/4/8/19 in editable/read-only states.

The PR records actual live checks and remaining limits. Before merging:

1. Restart Foundry and refresh player browsers. Open both controls above Attributes. Check compact layouts, keyboard controls, optional help and footer scrolling.
2. In a test character, roll one, type another score, fill the remaining results, swap destinations and Apply. Confirm the assigned bases and modifiers. Cancel a second draft and confirm no changes.
3. At level 4, spend two points each in two stats; verify a third point in either stat and a fifth overall are unavailable. Remove/reset points and save. Reach 8, 12, 16 and 19 to confirm separate awards. Level 20 adds no award.
4. Verify gear/effects still add, clearing a manual edit preserves awarded points, and dropping/re-raising level suspends/restores later choices. Check the cap with gear pushing an effective score beyond 28.
5. Verify existing manually entered scores before recording old awards, save/reload persistence, current spent resources, player permissions, and both linked/unlinked actors. No in-world test should overwrite an existing character's bases merely to exercise generation.

<a id="core-numbers"></a>
## Core numbers

Roadmap step 1 adds current Health/AP/reactions, automatic maxima, hit die, Natural Evasion, Armor Rating and feet per AP. All maxima and derived numbers have manual overrides; clearing an override restores the rule. Armor contributions are entered manually until the equipment step. Automatic turn resets, short-rest rolls, equipment penalties and token movement spending belong to later steps. The rolls step adds Long rest to refill Health, AP, reactions and Wonder.

<a id="core-numbers-short-rests-and-hit-dice"></a>
### Short rests and hit dice

The user clarified on 2026-11-02: hit-die uses equal your level, each use adds your current VIT modifier, uses are shared across short rests, and every long rest restores them all. Notion's Stats/Vitality pages establish the current VIT hit-die formula; they do not specify those spending/refill details. The current website's hit-die and rest presentation was consulted.

Choose Short rest on Character or Details, select a count, then Roll & heal. A compound formula such as 1d12 + 1d4 is one use; VIT is added once to each use. Each selected roll is spent. Negative roll totals heal 0, and healing caps at maximum Health. Full/overflow Health spends nothing. The chat card shows dice plus modifier, current Health and remaining uses, with native dice details collapsed. It follows the chosen chat visibility. No AP/resource/ability recovery or automatic world-clock advancement is added to a short rest.

`system.hitDice.spent` is an additive integer field initially 0. Availability is level minus spent, floored at 0. Level, VIT, gear and form changes do not reset spent uses. Current hit-die overrides still apply. Details → Adjust values → Hit dice spent provides a manual correction. Long rest resets it alongside the existing recovery transaction; unrelated saves preserve it.

Rules live in Foundry-free `module/rest-core.mjs`; dialogs, dice, payment/healing and chat use `module/rest-actions.mjs`. Rolls and rendering prepare before the actor update. Local actor actions are serialized and pool changes rechecked. A failed/cancelled update posts nothing; failed chat posting compensates the healing and use count, preserving later corrections. A failed compensation tells the user which fields need correction. Native fractional Health remains intact while card numbers follow whole-number presentation.

All 396 portable tests pass, including compound rolls, VIT on every use, use exhaustion, level changes, below-zero/full Health, caps, hidden fractions, cancellation, concurrent clicks, failed roll/render/update/chat and compensation. Offline installed v14.365 models/strict templates cover 48 owner/observer/tab contexts with unchanged stored source. A desktop preview covers the six tabs at 1280/1000/880/760 px, including visible counts and disabled read-only rest controls. Actual live dice/autosave, client permissions and rest recovery still need user validation after restarting Foundry.

<a id="core-numbers-rules-checked"></a>
### Rules checked

Checked against Notion on 2026-10-31:

- [Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4): current VIT × level for Health, matching changes to current Health, the hit-die chart, Evasion and reaction milestones.
- [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73): 15/17/19/21/23 AP at levels 1/5/10/15/20; movement has a 5 ft per AP floor.
- [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) and [Vitality](https://www.notion.so/351c72092efb813e9ab9c1193bdcbb47): Armor Rating has a zero floor. At current VIT 28 or higher, Adamantine Body replaces the VIT modifier with half VIT, rounded down, before adding armor.

The hit-die lookup is ported from the website's [combat-core.js at f6cfc79](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/f6cfc79e077d1354ca2be7004ef099c2e30d9da1/js/combat-core.js). The website's historical rolled-Health formula is not ported: it disagrees with the current Notion rule. The roadmap's shorthand also omitted the movement/AR floors and Adamantine Body; this implementation follows Notion. No website files are changed.

<a id="core-numbers-data-and-token-behavior"></a>
### Data and token behavior

- Existing `level` and `stats.<key>.value` fields are unchanged. New schema fields have defaults, so old actors acquire the new numbers when loaded.
- `health.damage` stores the difference between maximum and current Health. Derived `health.value` and `health.max` are not saved. For example, 41/60 Health means 19 damage; increasing maximum to 80 gives 61/80, and reducing it to 60 restores 41/60. This also works when prepared VIT changes through an Active Effect. No preparation hook writes to the database.
- `ap.value` and `reactions.value` start at `null` (full at the current maximum). Once a current value is entered, it stays at that value until corrected. Clearing a current pool returns it to full. No turn hooks are added yet.
- `health.maxOverride`, `ap.maxOverride`, `reactions.maxOverride` and numeric fields under `overrides` use `null` for automatic. `overrides.hitDie` uses a blank string. Explicit zero overrides are preserved.
- `bonuses.armor` and `bonuses.evasion` are manual equipment contributions. `overrides.armorRating` and `overrides.evasion` replace the complete final values.
- Corrections may be negative or above maximum; there are no new gameplay restrictions. The automatic formula floors do not clamp manual overrides.
- Bars use `health`, `ap` and optionally `reactions`. Newly created characters default to Health/AP unless the creation data already supplies those bar settings. Existing tokens and prototype tokens are not rewritten; choose the attributes in Token Configuration → Resources. Bar visibility remains the user's Foundry setting.
- Health edits on the sheet and through `actor.modifyTokenAttribute("health", value, isDelta, true)` convert to `health.damage`. Macros should use that method for current Health, rather than persisting the derived `system.health.value`. Direct damage corrections use `actor.update({"system.health.damage": amount})`.

<a id="core-numbers-validation"></a>
### Validation

The user confirmed the installed core-numbers release works in Foundry on 2026-10-31 and authorized the rolls step. The detailed checklist below remains available for regression testing; that confirmation does not imply every listed scenario was individually verified.

Automated: `node --test` covers the Notion chart, level/milestone boundaries, movement and AR floors, zero/blank overrides, Health increases/decreases, token corrections and full-form submissions. Adapter tests use lightweight Foundry stubs; they do not exercise the world server, canvas or actual ApplicationV2 lifecycle.

Additional local checks used the installed Foundry **14.365** TypeDataModel/field classes for defaults, persisted versus derived fields, serialization/reload, prepared VIT changes and zero overrides. The actual Handlebars template compiled with representative sheet context. These checks did not launch or modify the installed world. Browser visual preview was unavailable because the browser tool blocked the local file URL.

In-world regression checklist:

- [ ] Open an existing character and a new character; confirm no data is lost and defaults render.
- [ ] At level 5/VIT 12, set Health to 41/60. Raise VIT to 16: expect 61/80; restore VIT: expect 41/60. Reload and repeat using a temporary VIT Active Effect.
- [ ] Check VIT 27/28/29/30, AGL 20/21/27/28, levels 4/5/9/10/14/15/19/20, armor contributions and clearable overrides, including zero.
- [ ] Correct Health below zero and above max on the sheet and token HUD; check AP/reactions likewise. Changing unrelated fields must not heal or refill pools.
- [ ] Confirm Health/AP bars on new tokens and select them on an existing token. Check linked and unlinked tokens, saving and reloading, and updates visible to another connected player.
- [ ] Check the sheet at 320/390 px and desktop width: no horizontal overflow, reachable controls, scrolling and focus. Check observer/read-only views and stat click-to-roll.

<a id="core-numbers-resistance-tracking"></a>
### Resistance tracking

Details → Resistances → Edit offers Bludgeoning, Piercing, Slashing and Fire checkboxes, plus one custom resistance per line. Saving trims surrounding whitespace and deduplicates names without case sensitivity. Clear all choices/lines and save to remove the list. Read-only viewers see the entries without edit controls. Character shows a compact summary when the list has entries.

`system.resistances` is a blank-default array of strings. Existing actors need no migration; native array replacement removes deselected entries. The editor updates only this field. Ordinary sheet saves, rest actions, equipment changes and form switches do not change it. These are manually recorded character resistances; automatic grants from equipment/abilities and damage application are future combat work. Conditional custom entries remain labels for the table to interpret.

Sources checked 2026-11-03:

- [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d): resistance halves damage, rounded down, before Armor Rating.
- [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48): Bludgeoning, Piercing and Slashing in weapon tables.
- [Status Effects Explained](https://www.notion.so/351c72092efb812098ded266c9753a38): Burning deals Fire damage.

Game Systems has no exhaustive damage-type list. These presets are confirmed examples, with custom entries for other types; the website's broader suggestions were reviewed but not treated as Notion rules. `isResistant` provides an exact individual-type lookup for later integration with the existing `hitDamage` helper. No combat path invokes that lookup yet, and combined damage labels are not split or inferred.

Validation: Node tests cover normalization, custom entries, cancellation, clearing, save failures, permissions and an exact-type lookup feeding the existing damage helper. Offline checks use installed Foundry v14.365 data models for default/update/clear/reload persistence and strict templates, plus desktop browser renders for owner/observer and long entries. Live Foundry interaction and multiplayer transport remain user validation.

Live check: save Fire and a custom type, reopen the sheet and refresh; confirm both summaries. Remove Fire, then clear all entries; confirm the overview summary disappears. Health/AP and other values should remain unchanged throughout.

<a id="milestones"></a>
## Milestone details

Use **Attributes → Milestones** for the full reference, or tap/click a milestone diamond to open that stat with the chosen rule expanded. Each stat has its 21 and 28 milestones, a current score and an Unlocked/Requires state. Filter between stats or All stats. Details expand on click, touch or keyboard; longer rules stay out of the character sheet.

This reference is a native v14 DocumentSheetV2 window tied to the actor, so actor refreshes update its values. It uses a non-form root, no named data inputs and no document submit writes. Owners and read-only viewers can filter and open rules. Native permissions still govern access. Reopening a diamond reuses the actor's reference window, expands the requested rule and scrolls it into view; disclosure and scroll state otherwise use native Handlebars synchronization.

<a id="milestones-rules-and-calculations"></a>
### Rules and calculations

- All 16 milestones use the current effective score, including earned points, effects and armor penalties. Reaching 21/28 gains the milestone; dropping below it loses it. Unlock state is derived, never saved as a separate flag.
- The reference includes timing, full mechanical rules, source links and the general out-of-combat rule: once-per-combat becomes once per long rest, and once-per-round becomes uses equal to the stat modifier per long rest. Indomitable's status-negation limit is distinguished from its separate below-zero stabilization roll; Sixth Sense's question limit is separate from its passive warning.
- Current previews include Parry's DEX roll and ally reach, Indomitable's VIT roll against DC 12, Adamantine Body's VIT contribution, Surge's 2 free movement AP expressed at the final movement rate, Stratagem's INT bonus, Wisdom rolls, Commanding Presence's target DC and Unassailable Self's source-level threshold. Wonder's displayed maximum respects its existing override.
- Already implemented passives remain unchanged: Adamantine Body replaces the VIT modifier with floor(VIT / 2) in AR at current VIT 28; AGL 21/28 each adds a reaction maximum; Defy Fate upgrades the existing Wonder check/save behavior at FTH 21. Final overrides still win. Regression checks cover these passives rather than duplicating their calculations in the reference.
- Other entries are rules/previews only. Uses, AP payments, attacks, movement, status negation, GM checks, vision and conditional advantages are resolved manually. In particular, Surge does not inflate normal AP, Eyes of Truth does not modify token vision, and no new combat action or automatic lifecycle is introduced. Listed AP costs reproduce the source; this window does not calculate or pay action costs.

No actor/item fields are added, renamed or removed. No saved bases, resource balances, effects or ability records are written by this feature.

<a id="milestones-source-review"></a>
### Source review

The website's current `js/app.js`, `js/abilities.js`, `index.html` and `css/sheet.css` were consulted for expandable milestone details, names and the navy/brass palette. Two website rules are stale relative to Notion: its STR 21 entry is Devastate, and its Commanding Presence DC is 10 + twice CHA. This implementation follows the current Notion pages: **Titan's Might pushes 15 ft** (or attempts prone), and **Commanding Presence uses DC 12 + CHA modifier**. Singularity uses Notion's declared weapon-attack wording; no website-only dual-hand rule is introduced here.

Authoritative pages reviewed:

- [General Stats](https://app.notion.com/p/351c72092efb81baaae9c21636d2dee4) and [Stats Explained](https://app.notion.com/p/351c72092efb81e89505f5950939e031).
- [Strength](https://app.notion.com/p/351c72092efb81bc9c1dc28707e48241), [Dexterity](https://app.notion.com/p/351c72092efb8132b174eb48b029c4ab), [Vitality](https://app.notion.com/p/351c72092efb813e9ab9c1193bdcbb47), [Agility](https://app.notion.com/p/351c72092efb812cae19fb7713e9e76b).
- [Intelligence](https://app.notion.com/p/351c72092efb81fd8861d6d5d5b12eb4), [Wisdom](https://app.notion.com/p/351c72092efb8126bbbaf6116a2b38a3), [Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c), [Faith](https://app.notion.com/p/351c72092efb813a8dcdf9dbae517e29).

<a id="milestones-validation"></a>
### Validation

`node --test` covers all 16 records, exact unlock boundaries, effective rather than stored scores, current modifiers and preview values, out-of-combat descriptions, passive recalculation, source immutability, local filtering, window reuse, focused disclosure, no-op submission and read-only access to reference controls.

Offline checks with installed Foundry v14.365 fields and strict Handlebars templates cover earned points, native effects gaining/losing milestones, Adamantine AR/reaction changes, current CHA DC, all/focused references, safe non-submit buttons, unchanged character form fields and source data. Native DocumentSheetV2 registration/permission handling and Handlebars disclosure/scroll synchronization were inspected in installed v14.365 source.

No live Foundry world or computer UI was used, per the user's preference to test the interface themselves. Check after restarting:

1. Open Milestones and filter All/each stat. Tap a locked and unlocked diamond; check the chosen rule opens and the window scrolls/resizes on desktop and phone. Test keyboard focus and disclosure controls.
2. Keep the reference open while changing a score or toggling a form/effect across 21/28. Check its state and current previews refresh. Check earned-point and heavy-armor effects on unlocks.
3. Verify VIT 28 AR, AGL reaction maxima and FTH 21 Wonder still work with clearable overrides. Check Titan's Might says 15 ft and Commanding Presence displays 12 + current CHA modifier.
4. Test an owner and a read-only observer; filtering, reading and closing should work without enabling character edits. Reopen/reload and confirm no resources, bases or usage counts changed from reading rules.

<a id="rolls"></a>
## Rolls and Wonder

Roadmap step 2 adds check/save choices, advantage/disadvantage, readable chat cards, Wonder spending and a Long rest action. It does not add attack automation.

<a id="rolls-rules-and-sources"></a>
### Rules and sources

Checked on 2026-10-31 against Notion [Faith](https://www.notion.so/351c72092efb813a8dcdf9dbae517e29) and [Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4):

- Wonder rerolls non-attack d20 rolls. Automatic uses are the FTH modifier, with negative modifiers giving zero uses; uses return on a long rest.
- At current FTH 21, Defy Fate turns a failed check or save into a success when Wonder is used. Initiative continues to reroll. This is included now because postponing it to the abilities step would give high-Faith characters the wrong Wonder behavior. The player declares failure; there is no automatic DC check.
- FTH 28 Miracle remains part of the later abilities step.

The website's [js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js) was inspected at blob `f3b2c49a553b6b720011bbe45f06e63bb8bc7706`: advantage keeps the higher of two d20s, disadvantage the lower, and Wonder retains the original roll mode and modifier. Foundry's dice engine implements those rolls; its chat log preserves the history. No website files are changed.

<a id="rolls-behavior-and-data"></a>
### Behavior and data

- **Long rest** restores all currently implemented resource pools: Health, AP, reactions and Wonder. As clarified by the user, this is a full refill, not a Wonder-only action. It sets Health damage to zero and the other pools to `null` (full at their current maximum), preserving maximum overrides, stats and used-result history. Resources introduced in later roadmap steps must join this action.

- Existing character fields are unchanged. New `system.wonder.value` starts at `null` (full), `maxOverride` at `null` (automatic), and `max` is derived and not persisted. Old characters acquire defaults on load. A spent value, including zero, survives unrelated edits and reloads. Blank current/refill restores full; blank max override restores the rule. Manual corrections remain unrestricted, including negative or above-max values.
- Click a stat abbreviation, choose check/save and dice, then Roll. Closing the dialog does nothing. Public, GM, blind and self roll modes use Foundry v14's `messageMode` API.
- Visible cards show the kept die, original bonus/penalty and total (for example, `9 + 4 = 13`). Advantage/disadvantage list both dice and the kept higher/lower result. The underlying Foundry formula still uses `kh1` (keep highest one) or `kl1` (keep lowest one), but card rendering replaces that notation with readable text. Existing system cards also get this display when rendered again; hidden results are untouched.
- Use Wonder from a supported chat card. It posts a new result without editing the original; the new result replaces the old for play. Rerolls keep the original formula/modifier and exact whisper/blind audience. Defy Fate retains the original dice as context and clearly marks the declared success.
- Native combat-tracker initiative rolls carry their combat/combatant identity. Wonder updates that combatant's initiative after posting. If it no longer exists or the tracker update fails, the new total remains in chat with a warning to apply it manually. Linked and unlinked token speakers resolve through Foundry's speaker lookup.
- Only an actor owner who can see a result gets the action. At the user's request, spending now requires at least one current use and each result may use Wonder only once. The new reroll is independently eligible. Buttons show `Wonder used` or `No Wonder uses left` and refresh on actor/chat updates. Manual pool corrections remain editable; negative values left from the previous release are not silently changed. Take a long rest or correct that value before using Wonder again.
- `flags.worlds-beyond.wonderUsed.<messageId>` records consumed results on the speaker actor alongside the pool decrement. This survives reloads, refills and deletion of the replacement chat message, and does not require the player to edit a GM-authored initiative message. Existing reroll messages' `previousMessageId` links also identify already-used older results. Deleted pre-fix history cannot be reconstructed.
- Local actions for one actor are serialized. Simultaneous changes from separate clients are not a server-side transaction and can still require manual correction; this is not an anti-cheat system.
- Failed roll/card preparation spends nothing. If posting fails after spending, refund the use and clear its consumed flag. If that refund fails, tell the player to restore one use manually and make a new roll because the original remains marked used.
- Generic `/roll` messages, old messages without system metadata and third-party macro rolls have no Wonder button. This step covers system check/save cards and new native combat-tracker initiative rolls. Other non-attack rolls can be rerolled manually and their Wonder uses corrected on the sheet.

<a id="rolls-validation"></a>
### Validation

`node --test` covers formulas, readable die/bonus breakdowns (including ties and negative/zero bonuses), Wonder/Defy Fate boundaries, zero/manual pools, cancellation, original modifiers and audience, initiative updates, spending/refund failures, repeat-use rejection, chained rerolls, persisted consumed flags, legacy rerolls, local concurrent clicks, mounted button refresh, refill and unchanged sheet submissions. Adapter tests use stubs and do not prove a live Foundry session works.

Additional local checks used the installed Foundry **14.365** TypeDataModel/field classes: old-character defaults, derived fields excluded from saved data, spent-zero persistence and refill. The sheet, dialog and chat templates compiled with the installed Handlebars library, including escaped text and native dice markup. v14 API usage was checked against the installed Foundry source. Browser preview was blocked for local files; no live world, visual layout or multiplayer validation was performed by Codex.

In-world checklist before moving to equipment:

- [ ] Restart Foundry, refresh player browsers, and open an existing character. Confirm existing stats, Health and pools remain intact; inspect desktop and phone widths.
- [ ] Roll a normal check, an advantage check and a disadvantage save. Confirm die + = total and both advantage/disadvantage dice with the kept value. Expand dice details and confirm native tooltips still work. Cancel the dialog and confirm no new message.
- [ ] Set FTH 18: expect 2 Wonder uses. Use Wonder, check the new result and decrement, change an unrelated stat and reload. Long rest: expect 2 Wonder uses and Health/AP/reactions restored to their maximums. Check current/max manual overrides including zero and clearing; maximum overrides and used-result history must remain intact.
- [ ] Use Wonder on result A: A must show `Wonder used`. Use Wonder on its new result B: B becomes used and result C appears. At zero, C must show `No Wonder uses left`. Refill: only C becomes usable; A/B remain used after reload. Repeat on a GM-rolled initiative message as the owning player.
- [ ] Set FTH 21: use Wonder on a failed check/save and confirm declared success without another dice roll. Initiative must still reroll.
- [ ] Roll initiative from the combat tracker, use Wonder and confirm its total updates. Repeat with linked and unlinked tokens; confirm their own pools change. If combat is deleted, the new result should warn that it needs manual application.
- [ ] Check public, GM, self and blind modes from separate player/GM views. Wonder must preserve the original audience even after changing the chat roll mode; hidden results must not expose totals or actions.
- [ ] Check owner versus observer views, rapid clicks, fresh/reloaded chat history and narrow screens. Native dice tooltips and controls must remain usable.

Wait for the user's Foundry validation before starting the equipment step.

<a id="number-display"></a>
## Whole-number controls and presentation

Version 0.22.0 follows the user's request to hide fractional totals and floor decimal entries while retaining fractional calculations internally. Current website `js/resources.js` was consulted for the existing interface; flooring is the user's explicit Foundry preference. This is presentation/entry handling, not a new rounding rule for combat math.

- Character and equipment number inputs floor typed decimals when committed. Numeric dialogs normalize before submission, including Enter. Stat generation drafts and manual stat edits floor entries before applying earned points/effects. Blank fields still clear/reset exactly as before; invalid input remains subject to existing validation.
- Character/equipment contexts, resource percentages, numeric dialog summaries, consumable counts and visible system dice totals use whole numbers. Round down means `Math.floor`, including negative corrections: −0.2 becomes −1.
- Dice formulas, descriptive text, prices stored as text and meaningful ratios such as 1.5× are not rewritten. Core Foundry windows and third-party interfaces are not globally restyled or intercepted.
- Internal math and data models remain fractional-capable. For a 125-point pool with 4.6 spent, current remains 120.4 internally but shows 120. Spending another 0.5 internally makes current 119.9, displayed as 119. A whole 97% input can represent 121.25 points. The next whole current edit deliberately replaces that total.
- Unchanged displayed totals are omitted from full-form updates, preserving fractional Health damage, AP/current pools, overrides, item fields and resource expenditure when saving unrelated changes. Percentage mode uses the original display unit and revised limits when a deliberate edit is converted back to points. Changing display does not quantize the underlying balance.
- Rendering does not update actors/items. No persisted fields are renamed, removed or changed to integer schemas. Existing rules' rounding, action costs, manual corrections, limits and resource rest behavior are retained. No migration runs.

Form token width/height, art scale and transformation seconds are explicit decimal exceptions. Their numeric controls use `data-allow-decimal`, skip whole-number input/form normalization and retain their exact values in the Form editor's display context. For example 1.15 scale and 1.5 seconds save/reload unchanged.

<a id="number-display-validation"></a>
### Validation

Portable tests cover positive/negative floors, text/formula preservation, event binding/Enter submission, unchanged full-form saves, deliberate entries, stat effects, visible/hidden chat totals and retained resource fractions. Offline checks use Foundry v14.365's actual schema and strict Handlebars libraries for character/equipment rendering and full-form processing. They reproduce 120.4 → 120 and 119.9 → 119 without writing source data.

No live user world/actor data is accessed. The user should restart Foundry/refresh browsers, enter a decimal in a resource/override/item field, check stat editing with an effect, clear overrides, and test save/reload, mobile inputs and simultaneous clients. Live focus/change event ordering and platform/native token HUD presentation still require user testing.

<a id="interface"></a>
## Compact interface

Version 0.14.0 implements the user's request to tighten the interface and make detailed explanations available on demand. This is a presentation pass over the tested Block/Dodge/Parry work.

<a id="interface-layout"></a>
### Layout

- Resources show current/maximum totals in compact cards. Core numbers and a dedicated Block/Dodge/Parry row follow, then stats and equipment.
- **Adjust values** groups the existing maximum, core-number, armor and inventory overrides. A Custom badge appears when an override or extra armor/evasion correction is active, including an explicit zero override. Clearing and editing behavior stays the same.
- **Rules & help** contains sheet instructions, stat-color/reset behavior, Wonder, armor calculations and inventory guidance. Brief hover tooltips supplement the clickable help controls.
- Roll dialogs show the fields, dice choices and spending controls first. Short current warnings remain visible. Longer rules are under **How Block/Dodge/Parry works**, **Roll help** or **Attack help**. Dice remain the same named radio inputs, arranged as compact choices.
- **Add item** opens creation buttons. Carried totals, backpack, item names, basic damage/defense figures, loaded shots and common item actions remain visible. In 0.15.0, grouped equipment rows replace the cards: click a brass name to open its editor, or hover for its summary. Item sheets group range/loading, carry/cost, image paths, properties, signature properties, description and guidance into disclosures; selected property names remain visible in their summaries.
- New defense cards show their outcome, target and spending briefly, with fuller application rules behind a details control. Damage breakdowns, signature reminders and consumable descriptions also open on demand. Existing chat messages keep their stored content.
- Native details/summary controls support mouse, touch, Enter and Space. Actor/item disclosures use Foundry's `data-sync` support, which preserves their open state through sheet rerenders. Roll dialogs retain the scrollable content and visible action footer from 0.13.1.
- Navy/brass colors, stat provenance colors and 44px action targets are retained. Resources use two columns on narrow sheets; defense actions stay grouped together.

<a id="interface-scope-and-sources"></a>
### Scope and sources

No rules, costs, data-model fields, resource transitions or existing data were changed. The pass adjusts templates/styles, visible wording, property-summary context and where roll information appears. Character/item controls preserve their names, values and disabled state; collapsed controls still participate in form submission.

The website's current [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html), read 2026-11-01, informed the optional health/vitals guidance and grouped controls. The existing Notion-backed rules documented in BLOCK.md, DODGE.md, PARRY.md, ATTACKS.md and EQUIPMENT.md remain authoritative.

<a id="interface-validation"></a>
### Validation

`node --test` covers the existing gameplay adapters and calculations. Local checks using Foundry 14.365's real data models and bundled Handlebars compile 42 character/item/dialog/card cases and compare submitted controls against the installed 0.13.1 baseline: names, values, selected/checked states, choice values and read-only protection match. Preparation leaves persisted model data unchanged. New help starts collapsed; escaping and native roll markup are preserved.

The PR records the live Foundry checks completed for the installed commit. Before merging, check:

1. The character sheet's compact resource/core/defense/stat layout, including a narrower sheet.
2. Open Adjust values, edit a correction, and confirm it remains open after the sheet refreshes. Check zero overrides and stat colors/reset behavior.
3. Open Rules & help and each defense/roll help section by mouse and keyboard. Confirm long help scrolls above a visible Roll button.
4. Open Add item, existing item sheets and property/description sections. Check all item types and editable/read-only views.
5. Confirm new roll cards show totals/results and offer details, while spending, damage/healing actions, Wonder and private visibility still behave as before.

<a id="visual-polish"></a>
## Chat and equipment polish

Version 0.15.0 implements the first visual-review batch: consistent system chat cards and compact equipment rows, including item artwork, equipped-state contrast and quieter removal controls. It retains the tested 0.14.0 interface cleanup that was merged into the Parry topic branch after that branch's PR had already merged to main. This PR carries that approved cleanup forward to main as well.

<a id="visual-polish-behavior"></a>
### Behavior

- A shared render hook themes visible Worlds Beyond roll, attack, damage, reload and consumable cards. It identifies the system card markup, so cards without attack/check flags receive the same surface. Hidden results are skipped before their HTML is inspected. Ordinary Foundry messages and native sidebar/canvas styling retain their own theme.
- Equipment is grouped under Weapons, Armor, Shields, Consumables and Gear. Empty groups are omitted; unknown/legacy item types remain in Gear. Existing inventory order is preserved inside each group.
- Desktop rows contain a stock/custom icon, a brass name link and one line of key stats, followed by compact actions. Quantity appears when useful, including zero. Names open the existing item editor; hover summaries provide additional detail. On narrow sheets the actions wrap beneath the item text to retain 44px touch targets.
- Attack/Use remain the primary actions. Reload, Equip and Remove have labeled icon controls. Equipped gear has a filled brass hand/armor/shield button and a pressed state. Remove stays muted and keeps the existing confirmation dialog.
- Native stock icons cover all catalog weapons and armor pieces/shields. New or manually refreshed catalog entries get this artwork. Existing generic SVG images get a sheet-only fallback; custom images are preserved and saved item images are not rewritten. No catalog-version bump or automatic compendium refresh runs for an art-only update.
- The system sheet/dialog scrollbars, checkboxes and radio controls use brass. The compact dice row and optional rules/help from 0.14.0 remain. Character/Equipment tabs and later Abilities/Notes views are a separate interface step after this batch is tested.
- No rules, costs, resource transitions, actor/item schemas or item IDs changed. Existing actions still resolve the original embedded item ID and enforce the same ownership/read-only behavior.

<a id="visual-polish-sources-and-checks"></a>
### Sources and checks

The current website's grouped equipment/consumable controls in [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html) were consulted on 2026-11-01. Artwork paths were selected from the installed Foundry 14.365 stock library; all 36 referenced stock paths were checked on disk. Foundry's own checkbox CSS variables supply the checked-state colors.

Automated tests cover all supported chat-card markers, hidden/unrelated messages, stock/custom icon selection, catalog artwork diversity, grouping legacy/zero-quantity items and preservation of their actions. Existing gameplay tests cover spending, ownership, rolls and recovery. Local checks use real Foundry data models and strict Handlebars for 42 interface cases plus populated editable/read-only rows across all item categories. Those checks retain form controls and verify item identities/actions, quantity zero, shots, name escaping and custom artwork.

The PR records live Foundry checks and their limits. Test before merging:

1. Restart Foundry and refresh player browsers. Compare an existing stat, attack/damage, reload and consumable card; each should have the same navy surface/brass headings. Ordinary chat and blind-roll visibility should behave as before.
2. Open equipment and check the grouped rows, fitting icons, key stats and existing Attack/Reload/Use actions. Click a name to open its editor.
3. Compare equipped/unequipped states. Remove should be a quieter trash control with the existing confirmation.
4. Check a narrower sheet, keyboard focus, long names, zero quantity, loaded-shot counts and a custom item image. Check the Backpack checkbox's two states and the scrollbar.
5. Keep compendium refresh optional: existing character rows already receive generic-image fallbacks. Refreshing the catalog follows the existing behavior in CATALOG.md.

## Resource controls and portrait motion

Resource settings reopen before restoring scroll, so changes keep the current location. Manage fits its Add resource button. The Details seal opens Adjust values. Portrait and form image pickers bind a fresh upload control on rerender to avoid duplicate upload listeners.

The portrait vortex keeps elapsed rotation for the lifetime of its sheet window. Theme defaults are Health #8B1026 → #FF465A, Mana #4433CC → #35D7FF, and Holy power/Wonder #C18A27 → #FFF0AE. Saved custom colors take priority.

## DM activity log

A GM can open the private **Worlds Beyond · DM activity log** Journal from Notes → Open DM activity log. With an active GM connected, the log records character values, resources, equipment, ability/form changes, bonuses, rests and edited text/artwork. Each entry identifies the character, player and time, with token copies labeled separately. Nearby updates for the same character/player are grouped into one entry.

The default is the latest 500 entries. Configure Settings → Worlds Beyond offers logging and retention controls (100–5,000). The Journal uses GM-only ownership. Opening tabs, hovering controls and typing without saving produce no log entry. Logging begins after this release loads; it cannot reconstruct earlier activity or edits made while no GM is connected. It is a play aid for a trust-based sheet.
