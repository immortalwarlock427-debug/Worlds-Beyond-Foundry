# Abilities, forms and active status

For the v14 transformation-image quality trace and native-token comparison, see [Token rendering investigation](TOKEN-RENDERING.md). The investigation does not change the renderer.

Create Active/Passive/Reaction/Other abilities or dedicated Forms. Add spell creates an Active preset with 11 base AP and INT/Mana or FTH/Holy power; enter its resource cost in the editor. Use spends AP and reactions only in combat. Resource costs, uses and cooldowns also apply outside combat. Equipment/ability bonuses affect the sheet; Status lists active sources only.

Forms share the same inventory, balances and counters. Optional portraits, token transforms, equipment presets and visibility apply on Use and restore on End/Base. Threshold prompts ask before changing forms by default. Timers use Foundry time. Broader spell attacks, area resolution and visuals remain deferred.

The [desktop audit](CHARACTER-SHEET-AUDIT.md) is the release gate. Detailed configuration, compatibility and historical regression notes follow.


## Contents

- [Ability records](#abilities)
- [Ability restoration](#ability-restoration)
- [Ability durations and cooldowns](#ability-timers)
- [Bonuses, forms and Status](#effects-forms)
- [Form loadouts](#form-loadouts)
- [Consumables, overflow and form triggers](#consumables-triggers)
- [Item bonuses and combat actions](#item-bonuses-actions)


<a id="abilities"></a>
## Ability records

Native Ability Items support self bonuses, restoration and Use/End controls, plus optional native active-duration and cooldown clocks. See [item bonuses and combat actions](ABILITIES-FORMS.md#item-bonuses-actions) for activation costs and [timers](ABILITIES-FORMS.md#ability-timers) for expiry and manual corrections. Attack/damage casting, uses/resource recovery, targeting and animations remain deferred.

Native Forms also offer an optional resource-threshold Trigger, with Ask first and Ask to end preferences, normal entry costs and stale-prompt checks. Older forms remain manual until configured. See [form trigger setup and limits](ABILITIES-FORMS.md#consumables-triggers).

<a id="abilities-sources-and-scope"></a>
### Sources and scope

Read 2026-11-01: Notion [Game Systems](https://app.notion.com/p/351c72092efb8089812cd231debc3e74), [Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73) and [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6). AP modifiers change costs by at most half the base cost rounded down in either direction; spells normally start at 11 AP. The preview reuses the existing Foundry-free `actionApCost` function. No new combat math is introduced.

The current website `js/abilities.js` was consulted for active/passive/reaction/other types, categories, descriptions, a selected AP discount stat, resource references, uses, cooldowns, duration and notes. The Foundry roadmap calls for records first. The website's effect targets and activation costs inform the native Foundry implementation; its full casting, targeting and timer engine is not ported. Weavecasting remains separate.

<a id="abilities-use"></a>
### Use

- **Restoration:** non-passive abilities and forms can restore one selected pool on Use, alongside their bonuses. Choose a target, amount/dice and Points or % of maximum; leave the amount blank to disable it. Pure restoration at full spends nothing. End does not undo restoration. See [configuration, payment behavior and validation](ABILITIES-FORMS.md#ability-restoration).
- On a character, choose **Abilities → Add ability**. Or create an **Ability** in Foundry's Items directory and drop it onto a character. These are native Item documents; each character owns its own copy and trackers.
- The character list groups Active, Passive, Reaction, Forms and Other records. **Add form** opens a Form editor with a fixed type; **Add ability** offers Active, Passive, Reaction and Other. Form is absent from that ability dropdown. Existing stored kinds remain compatible. Both editors support bonuses and costs. Use replaces the previous form, and End or Base form ends it for free. Ordinary buffs remain independent. Clicking the brass name opens the editor. Collapsible Details shows description, duration, recovery notes and general notes. Text is escaped and preserves line breaks. Remove requires confirmation and removes only that embedded ability.
- Set type/category, description and an optional icon path. The default is Foundry's built-in book SVG.
- **Costs:** blank AP means no AP cost is recorded; explicit 0 is supported. Choose None for a fixed entered price, or a stat for its current modifier's preview. Use checks and deducts this amount even without a started encounter, per the user's requested sheet behavior. Insufficient AP leaves bonuses, resources and uses unchanged. World Items show the base cost until on a character. Manual corrections remain available.
- Choose Mana, Holy power or a custom resource, amount, and Points or % of maximum. Mana/holy power remain selectable even if their pools are hidden. Use deducts the selected resource; hidden Mana/Holy power must first be enabled in Resources. Percentage payment retains fractional points internally. Percentage costs refer to the resource maximum, not remaining points or the minimum-to-maximum display span.
- Custom pools are linked by stable ID: renaming Blood preserves the reference. Deleting the pool leaves the saved choice marked Missing resource. Copying an ability between characters with different custom pool IDs requires choosing the destination pool; names never silently rebind it. The world Item editor has no character custom pools, so configure those on a character copy.
- **Uses & cooldown:** blank Maximum uses means unlimited; explicit 0 is a tracked zero cap. When a finite maximum is set, new records start full. Uses left is editable, supports corrections outside the cap, and clearing it refills uses. Stored expenditure is preserved if the maximum changes or is temporarily cleared. Reset uses offers Manual (default), Long rest, New combat or Own turn. Combat/turn policies also refill on long rest, and turn uses refill at combat start. Recovery notes remain descriptive text. See [recovery settings](RESOURCES.md#recovery).
- Cooldown rounds and remaining rounds retain manual defaults. **Count cooldown automatically** starts a native round clock on the next Use. **Active duration** separately times bonuses/forms in rounds, minutes or hours; blank/0 keeps manual End. **Duration notes** preserves the original free-text field without parsing it into a timer. Settings affect future activations; End does not reset cooldown. Long rest does not reset cooldowns or active duration; use resets follow their separate setting. See [timer details and validation](ABILITIES-FORMS.md#ability-timers).
- Numeric controls follow whole-number entry/display while unchanged source fractions are preserved. Editing a description, category or cost does not reset uses/cooldown counters. Opening/reloading a sheet writes no actor/item data.
- Abilities contribute zero inventory slots and are excluded from Equipment. Ordinary abilities do not equip or stow weapons; forms can optionally use saved gear presets (see FORM-LOADOUTS.md). Bonuses on the ability can adjust stats, defenses, movement and resource maxima; passive bonuses apply while owned, active ones while enabled. No existing actor/item fields are renamed or removed, and no migration runs.
- **Status** shows active bonuses from their source only. An inactive ability definition stays here in Abilities; after Use its active bonuses appear once under its name in Status. End from either view ends the ability without deleting its definition. Disabled/expired bonuses are hidden. Saved actor-owned forms/adjustments from older sheets also remain usable here; they keep their original stored representation and cost-free controls. New definitions use Ability Items.

<a id="abilities-validation"></a>
### Validation

The portable `node --test` suite covers the records and activation adapters. New cases cover AP discounts and limits/fixed costs, stable/missing resource references, use counts and maximum changes, manual summaries, inventory exclusion, native embedded creation, permissions, deletion confirmation, and full-form counter preservation.

Offline checks use actual Foundry v14.365 schemas and strict Handlebars rendering for standalone/owned records, nullable defaults and clearing, source/reload stability, AP preview, custom-resource selection, escaped descriptions/notes, read-only controls and inline rows. Existing resource and 42 interface regression checks remain green. Foundry's native ActorSheetV2 drop implementation was inspected and is used unchanged.

Not tested in a running Foundry client: creating/dropping/editing/removing records, live focus events, scrolling/mobile layout, simultaneous clients and user permissions in-world. The user tests the installed branch before merging. Restart Foundry and refresh player browsers, add a record, set AP 11 with INT/FTH discount, select Blood, record uses/cooldown, edit its description, reload, try a world Item drop and confirm resource balances/inventory totals remain unchanged. No live world/actor data is touched by offline checks or installation.

<a id="abilities-spell-preset"></a>
### Spell preset

Abilities → Add spell creates an ordinary Active ability, category Spell. Choose INT (arcane/Mana) or FTH (holy/Holy power); the preset records 11 base AP and that discount stat. The existing capped AP calculation and payment apply on Use during combat. Set the resource cost yourself: spell costs vary, so the preset leaves it untracked. It does not enable a resource pool automatically. All fields remain editable in the normal Ability editor; this adds no new Item type, attack resolution or spell animation.

Validation: Node tests cover both presets, cancel, invalid choice and owner-only creation, alongside existing capped AP/payment tests. Check Add spell in the live client, set an enabled pool and resource cost, then Use and verify the same payment/End behavior as any other Active ability.

<a id="ability-restoration"></a>
## Ability restoration

An Ability Item can now restore its user's Health or one resource when used, alongside its existing costs and numeric bonuses. This is sheet resolution for self benefits; ally targeting, damage, saves, templates and animations belong to later combat work.

<a id="ability-restoration-configure-and-use"></a>
### Configure and use

1. Open an owned non-passive ability or form and expand **Restoration**.
2. Choose Health, enabled Mana/Holy power or a custom resource such as Blood. Custom references use stable IDs; renamed pools keep working, deleted or hidden pools require a new selection.
3. Enter an amount or Foundry dice formula, such as `20` or `2d6+2`. Select Points or % of maximum. Blank disables restoration.
4. Use the ability from Abilities. Its navy chat card shows restoration and any roll using the selected chat visibility. Fractional balances remain internal; the restored amount displays rounded down.

Percentage restoration uses the pool's maximum before this activation's costs, bonuses or form switch. It does not use the remaining balance or the span from minimum to maximum. Normal restoration caps at maximum; a pool's explicit Allow over maximum setting permits overflow.

Pure restoration at an already full pool spends no AP, resource, reaction, use or cooldown and rolls no dice. A zero/negative roll likewise spends nothing for pure restoration. An ability that also grants an enabled bonus or enters a form can still activate at full: that other benefit and its normal costs remain meaningful. Passive abilities never automatically heal; their editor hides Restoration.

Use validates costs before rolling. Payment, restoration, use/cooldown tracking, form changes and bonus activation share the existing reversible action. Paying and restoring the same resource retains both operations: 125 maximum, 20 spent, a 10-point cost and 10% restoration leave 17.5 spent (107.5 current). A pure restoration ability cannot spend into an already full pool just to create room for its own restoration.

Restoration happens once per successful Use. Pure restoration stays ready to Use subject to its uses/cooldown. Abilities with bonuses/forms retain Use/End activation; End removes those bonuses without undoing healing or refunding a successful activation. Failed updates or chat posting roll back completed operations; a failed refund reports that manual correction is needed.

<a id="ability-restoration-data-and-sources"></a>
### Data and sources

The additive `system.restoration` group has `target` (default `health`), `amount` (blank formula text) and `unit` (default `points`). Existing abilities therefore gain no automatic restoration. No stored fields are renamed or removed. Restoration math is shared with consumables in Foundry-free `module/consumable-benefits.mjs`.

The website's current `js/abilities.js` was consulted for costs, owned bonuses and activation flow. Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) remains the resource-scaling authority. These editable benefits implement the user's requested customization; no new spell formula or class rule is invented.

<a id="ability-restoration-validation"></a>
### Validation

Portable tests cover capped healing, full/zero no-spend, buffs/forms at full, overflow, stable/missing custom pools, same-pool percentage payment, whole-number results, all four visibility modes, insufficient AP before rolling and update/post/render failures with refunds. Existing action regressions remain covered.

Offline checks load actual installed v14.365 data fields and strict Handlebars templates. Native models verify additive defaults, exact same-pool balances and rollback without source drift; owner/observer templates verify escaped labels, disabled controls and passive hiding. An isolated headless editor preview passes at 760/390/340 pixels with no horizontal overflow and visible controls at least 44 pixels. Dice and document lifecycle use adapters; this does not substitute for a running world.

Live checklist for the user: restart Foundry and refresh browsers; configure a Health heal with AP and a resource cost, test capped/full use, then restore Blood and a percentage of the same resource being spent. Combine healing with a bonus and verify End only removes that bonus. Check private/blind rolls, a form trigger crossing and an unlinked token. Confirm saves/reloads preserve balances and existing blank-restoration abilities behave as before. Installation and offline checks never edit world/actor data.

<a id="ability-timers"></a>
## Ability durations and cooldowns

Ability Items now support optional native Foundry v14 clocks for active duration and cooldown. Their existing costs, restoration, bonuses, uses and form selection keep their rules. This is character-sheet tracking; it adds no damage casting, targeting, spell visuals or module dependency.

<a id="ability-timers-configure"></a>
### Configure

- Expand **Active duration** on a non-passive Ability or Form and enter a whole count with Rounds, Minutes or Hours. Blank or 0 keeps manual End. A descriptive timed ability/form can be tracked even without numeric bonuses.
- Under **Uses & cooldown**, enter Cooldown (rounds) and enable **Count cooldown automatically**. It starts an independent native round clock on Use. With that checkbox off, the existing editable remaining-round counter stays manual.
- The original **Duration notes** text is preserved and remains descriptive. Existing text such as `3 rounds` is not silently converted; existing abilities default to untimed/manual cooldowns. New timer settings apply to the next activation, not a running clock.

A form duration is an explicit automatic ending, independent of its resource-trigger exit prompt. Leave Active duration blank on a transformation intended to remain until manual End or a resource-trigger prompt.

Use validates clocks before dice/payment. Round clocks require a started encounter containing the actor. Rounds expire at the start of that actor's turn after the configured number of rounds, even when Use happened during another actor's turn. Minutes/hours use Foundry world time; waiting in real time does not advance them. Use minutes/hours without automatic round cooldown for out-of-combat timed abilities. As with native potion timers, a connected active GM persists expiry.

<a id="ability-timers-active-state-and-costs"></a>
### Active state and costs

Use starts the chosen clocks along with its payment, restoration and bonuses. Duration expiry ends the active ability/form and suppresses its bonuses, returning effective stats to their bases plus other sources. It does not undo healing, refund costs, reset uses or clear a still-running cooldown. End and Base form stop the active-duration clock early; a cooldown continues independently. Switching forms also stops the old form's duration.

For example, use a +3 STR ability with a 3-round duration and a 2-round automatic cooldown. At the actor's turn two rounds later, its cooldown is ready but the bonus is still active. One round later, the bonus ends. An active ability still offers End rather than another paid Use; end it before activating again if you want to refresh it.

Abilities shows a compact active/cooldown line; Status shows the active source and duration remaining. Pure cooldowns are not statuses, and internal clock records never appear as editable bonus definitions. Active forms/abilities without numeric bonuses still appear in Status and can be ended. Passive bonuses remain continuous while owned and have no activation clock.

If a native round duration reaches zero before the owner's expiry event, it waits for that event; cooldown stays unavailable until then. Foundry's native expiry policy remains unchanged, including compatibility with its delete-on-expiry option. Early End, expiration and reopening the sheet never charge again.

<a id="ability-timers-corrections-and-persistence"></a>
### Corrections and persistence

Deliberately editing **Cooldown remaining** detaches that running automatic clock and uses the entered manual count. Turning automatic cooldown off preserves its current count as manual. Deliberately toggling **Bonuses active** detaches its duration clock and keeps the chosen manual active state. Editing unrelated fields preserves both running clocks. A later Use starts configured clocks again; manual corrections do not disable future timer configuration.

Clocks persist as native Item-owned, non-transferring Active Effects with no changes and a namespaced timer-kind flag. Additive `activeDuration` settings, `cooldown.automatic` (false) and `timers.durationId/cooldownId` references keep them separate from bonus definitions. No existing actor/item field is removed or renamed. Fresh IDs per activation prevent late expiry/deletion events from ending a newer use; superseded internal clocks are cleaned after successful posting. Failed activation compensates newly created clocks, previous clock state, costs, form switches and trackers.

Only the active GM reconciles expired/deleted clocks into persistent active/cooldown flags. Native clock projections suppress expired bonuses immediately while that update is pending. Ready/canvas-ready reconciliation handles persisted expired clocks without restarting them. Existing untimed records are untouched. Native duration callbacks refresh existing actor and item views without writing source data. New owned copies discard copied runtime clocks while retaining their bonus definitions and timer configuration.

<a id="ability-timers-sources-and-validation"></a>
### Sources and validation

The current website `js/abilities.js` was checked for separate duration/cooldown counters, per-actor turn advancement and cost-safe activation. Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) remains the cost/scaling authority. No universal duration or recovery formula is invented. Foundry's installed v14.365 Active Effect schema/registry supplies timing and expiry; deprecated duration aliases are not used.

Portable tests cover defaults, projections, immediate expiry suppression, independent End/cooldown, pending owner-turn expiry, Status without bonuses, manual/full-form corrections, active-GM reconciliation, stale activation events, failed posting/partial clock creation rollback, new-copy cleanup and no-encounter preflight. Existing action/resource/consumable/form tests remain green.

Offline checks use actual v14.365 fields, typed bonus changes and the native duration methods/expiry registry with document/calendar/network adapters. They verify STR 18→21→18, an independent 2-round cooldown ending before a 3-round bonus, exact failed-post source restoration, fresh IDs, owner/observer templates and hidden clocks. Editor/Abilities/Status previews cover 760/390/340px with no horizontal overflow and 44px controls within changed views.

Not tested in a running world: native server persistence and actor re-preparation, synchronization across GM/player clients, synthetic token actors, live clock controls, hooks during reconnect and live focus/autosave. User checklist: restart Foundry and refresh browsers; use the example above, End early, switch timed forms, edit notes during countdown, correct cooldown to 0, reload, and try a minute-based duration with game-time advancement. Verify passive and older manual abilities still behave as before. Installation and offline checks never edit world/actor data.

Uses recharge, resource regeneration/rest configuration, form loadouts and final live sheet validation remain before moving into combat resolution, spell effects or modules. Explicitly notify the user at that transition.

<a id="effects-forms"></a>
## Bonuses, forms and Status

Create an ability or equipment item, then add signed bonuses on its own editor. Forms are created with **Abilities → Add form**, with a fixed Form editor. **Use** pays the recorded costs and replaces the previous form; **End** or **Base form** ends it freely. Ordinary active abilities remain independent. Consumable bonuses apply from their use card and appear only in Status while active. Forms can use [resource-threshold prompts](ABILITIES-FORMS.md#consumables-triggers). Bonus records use native Foundry v14 Active Effects internally; players do not create standalone effects from the character sheet.

**Status** is a live list of active sources, not their definitions. An inactive ability, unequipped item, disabled bonus or suppressed/expired effect is absent. Multiple active bonuses from one item are summarized once under its name. Ability End ends that source, while equipment and passive bonuses open their source editor and cannot be ended independently from Status. Native active conditions are also shown. The list does not invent unsettled condition rules or automatic durations.

<a id="effects-forms-sheet-scope"></a>
### Sheet scope

- Supported simple bonuses: all eight stat scores, Armor Rating, Natural Evasion, movement per AP, Mana/Holy power maxima and existing custom-resource maxima. Negative amounts are penalties. Custom resources use stable IDs, so renaming one keeps its effect link.
- Bonuses apply before derived calculations. Modifiers, milestone diamonds, armor calculations, scaling resource maxima and ability AP previews use the resulting scores. Earned stat points remain part of the base. Effective scores show at rest; editing reveals the base. Existing teal/gold/purple states remain.
- Source tooltips identify active adjustments on affected stats, resources and core totals. Status shows active source names and their changes; inactive definitions remain on their ability/equipment editors.
- Health damage and resource expenditure stay stored separately. Switching forms changes current/max by the same amount without refilling expenditure or writing the displayed stat into its base. AP, reactions and Wonder current amounts remain manual; changing their maxima does not refill them.
- Core overrides replace the calculated result. Resource maximum overrides replace the base before stored and effect bonuses. A form maximum sets the final resource cap. Extra defense/movement corrections edit stored bonuses independently of effects.
- Movement adds its bonus after the normal AGL-based rate and cannot go below zero. A final movement override replaces that result.

Equipment and ability bonuses live on their source Items; ability Use pays recorded costs and enables bonuses. Optional durations/recovery are implemented. [Form loadouts](ABILITIES-FORMS.md#form-loadouts) add portraits, saved gear and row visibility; attack/damage casting remains later work. See [item bonuses and actions](ABILITIES-FORMS.md#item-bonuses-actions). Native advanced changes remain editable in Foundry's editor and are preserved by the simple editor. Managed item bonuses are suppressed unless the item is equipped or its ability is passive/active. Unrelated native transferred effects retain their existing behavior.

<a id="effects-forms-data-and-compatibility"></a>
### Data and compatibility

No existing actor or item fields are renamed or removed. Ability `system.kind` gains a `form` choice; activation uses the existing `system.effectsActive` field. Effects store v14 `system.changes` entries (`type: "add"`, `phase: "initial"`, priority 20) and namespaced source flags. Saved actor-owned adjustments/forms from older sheets appear under Abilities, with edit/Use/End/remove controls. They remain stored as they were: no automatic conversion, duplicate application or world migration. Their inactive definitions do not appear in Status. New ones use native Ability Items.

Foundry applies effects once during preparation; the sheet never applies their changes itself. The friendly editor preserves advanced rows and unchanged fractional values. Stale editor changes, permission loss and cancelled updates report errors. A per-actor queue serializes form switches. Switching deactivates other Form abilities and saved actor forms; failed switching/posting compensates the previous selection and payments. Base form does not end ordinary buffs.

Removing a custom resource leaves its managed effect row dormant rather than recreating an incomplete resource. The editor labels that missing target so it can be retargeted or removed. This guard applies only to effects created by this feature; unrelated native advanced effects retain Foundry behavior.

<a id="effects-forms-sources"></a>
### Sources

- [Notion Stats](https://app.notion.com/p/351c72092efb81baaae9c21636d2dee4): current scores, modifiers, milestones and Health scaling.
- [Notion Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6): current INT/FTH × (level + 2) resource maxima.
- Worlds Beyond website `js/abilities.js` and `js/status.js`: forms with abilities, source-owned bonus definitions and an active-status summary that ends the originating ability. Notion remains authoritative for the underlying calculations; the user's requested source/Status organization takes precedence over website layout.

<a id="effects-forms-validation"></a>
### Validation

Portable `node --test` covers active-only Status, grouped source bonuses, saved definitions in Abilities, form switching/refunds/Base, independent buffs, permissions, stale editors, cancellation, source keys and advanced/fractional preservation. Offline checks with installed v14.365 fields exercise native changes between base and derived preparation, strict Handlebars templates, editable/read-only controls, source escaping, base immutability, maxima and preserved expenditure. These checks do not launch or change a live world.

Still to check in Foundry:

1. Add two Form abilities and an independent active ability; add positive/negative bonuses on their item sheets. Use the ability, switch forms and return to Base. Verify one form is active, the ordinary buff stays active, and Status shows only active sources. End a buff from Status and check its row disappears and its base returns.
2. Verify effective stat color, base editing/clearing, milestones, armor and movement. Edit an Extra correction while its effect is active; switch off and check the correction remains separate.
3. Spend Health/Mana/custom points before switching. Check expenditure remains, overrides still win, and a renamed/deleted custom resource behaves as described.
4. Reload, reopen editors, resize/narrow the sheet and test a player owner/read-only observer. Check scrolling, autosave, source tooltips, native advanced editor and transferred item effects. Existing actors should open without migration.

<a id="form-loadouts"></a>
## Form loadouts

Forms can remember a portrait and equipped gear from the character's shared inventory. They can also choose which ability and resource rows appear. Existing forms keep their current behavior until configured. Stat changes still belong in the form's Bonuses section.

<a id="form-loadouts-token-transformation"></a>
### Token transformation

Form loadout includes optional token art, width/height in grid squares, art scale and transformation seconds beside the portrait settings. `tokenImg` defaults blank; `tokenWidth`, `tokenHeight` and `tokenScale` default null; `transitionSeconds` defaults 0. Blank fields leave that aspect unchanged. Zero seconds applies immediately. Geometry, scale and timing explicitly retain decimals (for example scale 1.15 and 1.5 seconds); ordinary character numbers still use whole-number presentation.

Linked actors update their prototype and every active linked token. Each token retains its own Base appearance, footprint, scale and alignment offsets in the restore receipt. Synthetic actors update only their exact unlinked token. End/Base, expiry and form deletion restore the owned overrides, including previously changed tokens on other scenes. Manual movement during a form is preserved. Tokens inheriting an already transformed prototype use its recorded Base. Fields a form never overrides remain free for manual changes.

For an unlinked map token, double-click the token and use its own sheet. The Actors sidebar character is a different document and deliberately does not change unlinked token artwork. A 2×2 footprint uses width 2 and height 2; art scale changes the image inside that footprint.

The Ability editor uses one scrolling panel and restores open disclosures before native focus/scroll restoration. Equipment preset changes keep the checkbox in place instead of jumping to the end of the editor. A browser regression using the installed v14 mixin verifies checkbox focus, open state and identical vertical position after replacement at 1280/1000/760 px.

Each even integer width/height change centers that axis; odd or fractional changes keep its top-left grid anchor. Base reverses the accumulated alignment offsets, so sequential form switches and later movement do not introduce drift. Native rollback restores exact pre-switch values immediately and suppresses the failed form's bonuses through its restored activation state. Resource-triggered forms call this same path.

Foundry v14's [TokenAnimationData](https://foundryvtt.com/api/v14/interfaces/foundry.types.TokenAnimationData.html) includes width, height and texture scale. [TokenAnimationOptions](https://foundryvtt.com/api/v14/interfaces/foundry.types.TokenAnimationOptions.html) supports duration in milliseconds and the native fade transition. Installed build 365's animation implementation was inspected for these fields and texture transitions. The system passes those native options; no animation module or midpoint swap is required.

While a token animates, v14 interpolates its prepared `width`, `height` and `texture` values; the stored `_source` already holds the final values. Plans, restore receipts and the post-update check read the stored source. Reading prepared values right after an animated update made every placed-token transformation look cancelled and roll back.

An unlinked token's actor shows the sidebar actor's flags with the token's own flags merged on top, and it can't remove sidebar keys. Token actors therefore read and verify only the receipt stored on their own token (`token.delta`). Before this change, a transformed sidebar actor leaked its receipt into its unlinked tokens, so their form switches failed with "The form's portrait or restore state was not retained."

Restore receipts and equipment presets use native `ForcedReplacement` operations. Deleted inventory IDs are pruned from all form presets and Base equipment snapshots; receipt verification uses v14's key-order-independent `foundry.utils.equals`. Failed switches restore gear, token appearance, activation/bonus state, costs and the prior receipt using the existing compensation transaction.

Offline validation: 408 portable tests cover geometry/anchoring, fractional settings, linked/synthetic targets, native animation options, triggers, deleted equipment, key order and failed-switch compensation/bonus suppression. Installed v14.365 fields and operators verify defaults, exact save/reload, observer controls and replacement semantics. The Form editor was inspected at desktop/window widths 1280/1000/760 px with scrolling and exact 1.15/1.5 values. Live Roman validation and removal of the old macro follow installation; that macro is retained until the replacement works.

<a id="form-loadouts-configure-a-characters-form"></a>
### Configure a character's form

1. Open **Abilities → your form → Form loadout**. Enter a Portrait path, or change the character header portrait while that form is active. Blank uses the remembered Base portrait. This changes the Actor portrait; map-token artwork is separate.
2. Choose **Copy current gear**, or select items and enable **Use saved equipment**. An enabled empty selection stows all equippable items. Leaving it off shares Base gear. Existing hand rules resolve conflicting weapon/shield choices; missing/deleted IDs are ignored.
3. Under **Abilities shown / Resources shown**, uncheck rows to keep that form's sheet compact. New items/resources default to shown. Forms themselves and active abilities remain reachable so they can be switched/ended. **Show all** reveals hidden rows for editing, including for observers.
4. **Use** pays the existing recorded costs and switches to the form. Equipped-item changes made while a saved preset is active are remembered when leaving it. **End / Base form**, native expiry and deleting the active form restore Base gear and portrait. Editing a portrait or visibility does not reset unsaved equipped-item changes.

Visibility is organization, not a new game rule: hiding abilities does not end bonuses or disable passives, and hiding a resource does not stop recovery or block costs. Globally hidden Mana/Holy power remain globally hidden. Status continues to list active sources. Configure a form's numeric effects on its Bonuses editor, rather than relying on row visibility to suppress them.

The same Item records, shots, quantities, uses, cooldowns and resource expenditure are shared across forms. Switching never creates another inventory or writes effective stats into their base. Gear/form bonuses continue to use native Active Effects and the existing maximum/expenditure policy. Base is free and does not end ordinary buffs. Equipped changes while sharing Base gear remain Base changes.

<a id="form-loadouts-compatibility-and-implementation"></a>
### Compatibility and implementation

Additive `Ability.system.loadout` fields: `portrait` (blank), `gearEnabled` (false), and Boolean maps `equipment`, `abilities`, `resources` (empty). Equipment keys and ability references are embedded Item IDs; resource keys are Mana/Holy power or stable custom-resource IDs. An omitted visibility key means shown. Configure these character-specific references on the owned copy after moving a form between characters. Saved actor-owned legacy forms stay usable without automatic conversion.

`flags.worlds-beyond.formLoadoutState` holds the current configured form ID, Base portrait/equipment and whether the prior form used a gear preset. It is created on an intentional configured switch, not on ordinary rendering or when using unconfigured forms. The actor's existing action queue coordinates Use/End/Base. The reversible action restores costs, flags, portrait and gear after a failed post/update, including partial gear batches. An internal compensation flag bypasses hand normalization only while restoring the exact prior equipment snapshot. No data-model fields are renamed or removed.

Each loadout write and compensation receives a fresh Foundry operation object. v14 adds `parentUuid` to embedded Item requests; reusing that object for a subsequent Actor update incorrectly addresses the Actor as its own embedded document. Fresh operations also prevent prior trigger snapshots leaking into later switches. Internal loadout writes do not evaluate resource triggers.

Native timer/manual/deletion hooks reconcile physical loadouts through the active GM (the owner handles changes when no GM is active). Internal paid-switch updates suppress duplicate hook work. Reload/canvas-ready reconciliation can finish an expired saved loadout. These hooks do not poll or advance time. Existing linked/unlinked Actor identities remain distinct; changing a token actor affects that copy.

<a id="form-loadouts-sources-and-checks"></a>
### Sources and checks

Consulted the current website `js/abilities.js`, `js/equipment-profiles.js`, `js/resources.js` and `index.html`: one inventory, per-form equipment profiles, portrait links, shared/default visibility and on-demand configuration. The current Notion Game Systems search did not provide a general transformation/loadout rule; these are configurable character records. No automatic form powers, equipment creation or new transformation costs are inferred. Existing Notion-based stats, costs, triggers and hand rules remain authoritative.

Portable tests cover paid switches, remembered/empty presets, new/deleted items, hand conflicts, failed posting, partial/ignored equipment batches, End/Base, expiry/deletion, inherited gear, portrait/visibility edits, no-op legacy defaults and hook authority. Offline actual v14.365 TypeDataModel fields, native hand normalization and strict owner/observer templates verify gear switches, base stats and exact fractional balances, escaped text, row filtering, Show all and source stability. An isolated browser checks editor/character at 760/390/340 px for scrollability, no horizontal overflow and 44 px new controls; narrow previews were inspected.

Not yet tested in the running world: autosave/focus, image picker, real owned-document/socket lifecycle, timer expiry, multiple players and linked/unlinked actors. Before merging, restart Foundry and refresh player browsers. Make two forms with different gear/portraits and bonuses. Spend AP/Health/resources and shots, then Use/switch/End/Base, reload while transformed and test expiry. Change gear while transformed and confirm it returns on the next activation. Try a portrait edit, an empty preset and deleting a referenced item. Test Show all, owner/observer and narrow sheets. Check costs are paid once, unchanged balances/counters persist, Base returns correctly and independent buffs stay active.

After this step is user-validated, the remaining character-sheet gate is the final validation pass in ROADMAP.md. Broader combat, spell visuals and module integration remain separate work.

<a id="consumables-triggers"></a>
## Consumables, overflow and form triggers

These are opt-in character customizations requested by the user. They do not add a universal overflow/transformation rule to Worlds Beyond. Existing characters, consumables and manually selected forms retain their previous behavior.

<a id="consumables-triggers-consumables"></a>
### Consumables

Open a consumable and choose **Restore → Health, Mana, Holy power or an available custom resource**. Enter an **Amount or dice**, such as `20` or `2d6+2`. The unit is points or a percentage of the target's maximum, not its current balance. Custom resource links use stable IDs; names never silently select a different pool. Missing/hidden targets are identified and cannot consume an item. World Items can reference standard resources; choose custom pools on the character's owned copy.

**Bonuses → Add bonus** uses the same signed stat/defense/movement/resource-maximum editor as abilities. Carrying the consumable does not grant its bonuses. Leave restoration blank for a pure stat tonic, or combine restoration with bonuses. One restoration target and multiple bonus records are supported per item.

**Use** spends the item and its existing potion AP cost and posts the roll/card. **Apply benefits** applies its restoration and bonuses together to the user. Applied copies are native actor-owned Active Effects, grouped by that use in Status. They last until their configured Bonus duration expires or they are ended there, and survive deleting or using up the original item. Blank duration keeps manual End. Different uses have independent groups and stack; there is no unrequested stacking restriction. End disables every bonus from that use without changing the item's definition. They are not added to the Abilities list. See [native durations and compact bonus hints](EQUIPMENT.md#potion-durations); targeted ally application remains later work.

Restoration preserves expenditure/fractions and caps at the normal maximum unless overflow is enabled. If no restoration is possible and no bonuses are configured, Use spends nothing; a previously paid card refunds its recorded item/AP cost once if the pool became full before Apply. A stat tonic remains useful at full Health: its bonuses apply and its cost remains paid. Partial healing reports the amount actually restored. Failed application compensates restoration and created bonuses and leaves the paid card retryable. If partial bonus cleanup itself fails, End the remaining group in Status before retrying; the card does not duplicate an active group. Old cards lacking cost receipts still require manual refunds.

<a id="consumables-triggers-overflow"></a>
### Overflow

Enable **Resource → Settings → Allow over maximum** to let Restore/Recover and consumables gain beyond the normal cap. Health has **Adjust values → Allow Health over maximum**. Defaults are false, so existing healing/full-pool refunds and caps are unchanged. Manual Current corrections stay unrestricted regardless of this setting.

The normal maximum remains unchanged. Blood can show `105 / 100`, or `105%` in percentage display; the fill meter stops visually at 100%. Spending uses the existing minimum floor. Fill and configured long-rest recovery return to the normal maximum. Stat scaling and final maximum overrides keep their existing math.

<a id="consumables-triggers-form-triggers"></a>
### Form triggers

On a native Form Item, expand **Trigger**. Choose a resource, comparison and threshold in points. A blank threshold follows the resource's current maximum. New Add form records default to **Ask first** and **Ask to end**, with no resource selected until configured. Older forms default to Manual. Manual, Automatic, and Ask first remain configurable; ending can Ask to end, Keep active or End automatically.

For the user's Blood example:

1. Set Blood's normal maximum to 100 and enable Allow over maximum.
2. On the form, choose Ask first, Blood, Above, threshold 100 (or blank to follow its maximum), and Ask to end.
3. Raising Blood from 100 to 105 asks whether to enter the form. Accepting uses the normal form activation and its configured costs; leave entry costs blank for a free transformation. Cancelling pays nothing.
4. Dropping to 100 or below asks whether to end the transformation. Declining keeps it active. Accepting ends it for free. Unrelated updates below the threshold do not repeat the question.

Triggers detect crossings, not a condition that continuously forces a form. Manually ending above the threshold does not re-enter on the next unrelated edit; drop back and cross again to re-arm. While a prompt is open, the current value and permissions are checked again before paying. Multiple matching forms ask which one to enter instead of charging for several switches. Missing pools stay dormant, with no deletion or rebinding. A failed cost/payment reports the problem and preserves the triggering resource; it does not force a transformation.

The initiating owner executes the hook once. An actor queue serializes activation with payments, and trigger-generated cost updates plus internal loadout/timer writes are excluded from recursive triggering. Each operation's before-snapshot is consumed once, including batches that emit several Item callbacks, so the same crossing cannot queue repeated prompts. Actor/resource updates (including Current edits, Spend/Restore/Recover, rest, Health changes and consumable restoration) and trigger-setting edits are observed. No render/load writes or canvas movement hooks are added. Derived maximum changes caused only by equipping gear or adding an effect are not independent trigger events in this implementation. Portrait/gear/visibility loadouts are documented in [FORM-LOADOUTS.md](ABILITIES-FORMS.md#form-loadouts); a general event/condition editor remains later work. Old actor-owned saved forms remain usable but need a new native Form Item to use this trigger editor; no automatic conversion is run.

<a id="consumables-triggers-data-and-sources"></a>
### Data and sources

All changes are additive: resource/Health `allowOverflow` (false); consumable `restoreTarget` (health) and `restoreUnit` (points); Ability `trigger` settings. The existing `healingDice` text remains the amount/formula storage, so old items continue to heal Health. Consumable definitions use native `system.changes`, transfer false, and namespaced source flags. Applied copies use a namespaced per-use group ID. No existing field is renamed or removed.

Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) supplies unchanged stat scaling and expenditure behavior; [Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73) supplies the existing potion cost. The website's current `js/abilities.js` and `js/resources.js` informed source-owned effects, manual forms and stable custom resource IDs. Overflow and prompt behavior follow the user's explicit customization request.

<a id="consumables-triggers-validation"></a>
### Validation

Portable tests cover all restoration targets, fractions, old full-Health behavior/refunds, overflow without a cap change, buff-only/mixed consumables, partial creation rollback, Status grouping/ending after source deletion, exact threshold boundaries, prompt acceptance/cancellation, stale prompts, re-arming, independent ending, simultaneous forms, payments and single-client authority. Offline installed v14.365 fields and strict owner/observer templates verify defaults, saved-source immutability, Blood 105/100, native STR +3 taking 18 to 21/+4, trigger schemas and escaped names. Headless editor previews check phone/desktop widths; these use a simplified frame, not a live Foundry world.

Live checks: use Health/Mana/custom tonics and pure stat tonics; apply at full pools, remove the original item, End grouped bonuses, test refunds/failures and reload. Exercise 100→105→100 with both prompts, declining exit, re-crossing, a pending prompt while values change, multiple forms, two connected owners/GM and an unlinked token. Check scroll, autosave and native document lifecycle after restarting Foundry and refreshing browsers.

<a id="item-bonuses-actions"></a>
## Item bonuses and combat actions

Equipment/ability stat bonuses, forms under Abilities, active-only Status, Command AP and potion AP. Opportunity attacks are deferred again at the user's request; no separate React control or movement prompt is included.

<a id="item-bonuses-actions-equipment-bonuses"></a>
### Equipment bonuses

Open a Weapon, Armor or Shield Item and choose **Bonuses → Add bonus**. Open its bonus, choose a target such as Strength score and enter 3. The native Active Effect is stored inside that Item and transfers to its owning actor only while equipped. Stowing or removing the item removes its contribution; re-equipping restores it. Equipped quantity does not multiply bonuses. Stat bases are never rewritten.

Targets are all eight scores, Armor Rating, Natural Evasion, movement/AP, Mana/Holy power maxima and existing custom-resource maxima. Negative amounts are penalties. Modifiers, milestones, defenses and scaling resource maxima use the resulting score. Existing teal/gold/purple stat presentation and final manual overrides remain.

The same Item can have multiple bonus records and multiple adjustments in each record. Bonuses can be disabled individually or removed with confirmation. World Items/compendiums carry their native embedded effects when copied; no second actor-effect copy is created. Custom resource IDs stay explicit and missing targets remain dormant.

<a id="item-bonuses-actions-ability-bonuses-and-use"></a>
### Ability bonuses and Use

On an Ability Item, use **Bonuses → Add bonus**, for example Dexterity score +2. A **Passive** ability applies enabled bonuses while owned. Other types apply them while `effectsActive` is true.

On the character's Abilities tab:

- **Use** checks and pays the recorded AP cost during a started encounter. It uses the selected current stat discount and existing half-base cap. Resource costs and tracked uses are also paid. Percentage costs use the resource maximum and keep fractional points internally; negative resource minima remain valid spending floors. Mana/Holy power must be enabled before paid use. Passive abilities and End/Base remain free; manual activation corrections remain available.
- Use starts the recorded cooldown and enables the ability's self bonuses. Reaction-type abilities also spend one reaction in combat. Missing resources, insufficient AP/resources/uses, remaining cooldown or an unavailable reaction report an error before activation. Existing editable trackers allow corrections.
- **End** disables the self bonuses without charging or refunding costs. Rapid repeated Use on an already active bonus ability does not pay twice or end it. Abilities without bonus records stay usable as repeated actions rather than becoming toggles.
- The Item's **Bonuses active (manual correction)** checkbox can correct activation without making a payment. Individually disabled bonus records remain disabled. Passive ability changes use the normal type selector; their bonuses do not need Use.

Costs use the pre-activation resource maximum/stat. Health damage and resource expenditure survive bonus changes. Failed document/chat operations compensate AP, resources, reaction, uses, cooldown and activation; failed compensation requests manual correction. Durations remain free text, cooldown countdown/recovery and uses recovery remain manual. This step does not add targeted buff delivery, ability attacks/damage/saves, templates or animations. Newly dropped active abilities start inactive; passive abilities still apply normally.

<a id="item-bonuses-actions-forms-and-status"></a>
### Forms and Status

**Add form** opens a fixed Form editor. **Add ability** offers only Active, Passive, Reaction and Other; Form is not a second route in that dropdown. Both retain their existing native stored fields. Add bonuses and optional entry costs there. Use replaces the previous form; End or Base form returns to base without refunding entry costs. Ordinary buffs remain enabled. Failed switching/posting restores previous forms and payments. Optional portraits and gear/visibility loadouts are implemented for validation in FORM-LOADOUTS.md. Saved actor-owned forms/adjustments remain accessible under Abilities, without conversion or changes merely from opening a sheet; they retain their earlier cost-free toggles. New definitions use Ability Items, not standalone actor effects.

The **Status** tab lists currently active sources only, grouped once per ability/equipment item. Power appears after Use and disappears after End; disabled bonuses, inactive abilities, stowed equipment and suppressed/expired effects are hidden. End on an active ability row ends its source; equipment/passive rows open their source instead. There is no Add status/effect or inactive catalog here. No unsettled bleeding/burning/status rules or token-condition automation is invented.

Managed item bonuses alone use the new equipped/ability gate. Unrelated native effects retain their existing transfer/suppression behavior. Expired or disabled native effects remain inactive.

<a id="item-bonuses-actions-opportunity-attacks"></a>
### Opportunity attacks

Deferred. The separate React button and opportunity attack mode are removed. When combat work resumes, the user's requested design is a prompt when a creature moves away from someone with an equipped weapon and an available reaction. Trigger, reach, Flicker and movement handling will be addressed together then. Ordinary attacks retain their existing AP behavior.

<a id="item-bonuses-actions-command"></a>
### Command

**Character → Command** selects an ally. It costs a fixed **5 own AP**, without CHA discount and without paying from another Command grant. It offers **2 + CHA modifier**, capped at **5** (no positive grant below zero). The ally receives the higher of their remaining grant and the new amount, never their sum.

Select **Character** for the Actors sidebar sheet or **Token copy** for its separate unlinked encounter actor. Sidebar characters appear first; token copies include scene/ID context. The card and notice identify the recipient. A lower offer retaining an older higher balance says so explicitly. See [recipient identity and regression checks](COMBAT.md#command-delivery).

The main Action Points number includes remaining Command AP, with a green **Includes N Command AP** breakdown. It is not added to the normal maximum, and receiving it never changes or refills stored own AP. Normal attacks, reloads, potions and ability AP payments use it first on the ally's turn. Pending grants are labeled for the ally's turn; off-turn payments cannot spend that portion and explain why when insufficient own AP remains. Manually editing the displayed total corrects own AP while preserving Command; unchanged saves preserve exact hidden fractions. Adjust values includes a separate Command AP correction. The native AP token bar remains the ordinary AP pool.

The grant is ready for the current turn if received then, otherwise the next incoming turn. A pending grant survives that turn's normal refill; it clears at the following turn start. Long rest clears it. This adapts the website's separate grant/fresh-turn tracking to Foundry's combat hook rather than allowing the refill to erase it.

The commander posts a grant card after paying. If they own the recipient, delivery is attempted immediately. Otherwise the active GM handles it from the native create-message hook. Without an active GM, or if delivery fails, the recipient owner/GM uses **Receive Command AP** on the card. A per-recipient message receipt makes retries idempotent without requiring the recipient to edit another player's ChatMessage. Delivery failure keeps the paid offer claimable; it does not refund a successful offer and permit a second free grant. Failure to post the offer refunds the commander. Hidden combatants are excluded from player selection. Target eligibility as an ally remains a table decision.

<a id="item-bonuses-actions-potions-and-ap"></a>
### Potions and AP

Using a Potion in a started combat spends **5 AP adjusted by DEX**, bounded to **3–7**, and one item. Eligible Command AP pays first. Outside combat it costs no AP. Other consumable kinds retain their prior behavior. Healing dice still post the existing confirmation card; healing is not silently applied. Insufficient AP leaves quantity unchanged, and posting/update failure restores payment and quantity.

Healing consumables at full Health (including a manually corrected value above the maximum) say **You are at full health. Nothing was spent.** No dice, item or AP is spent. If another heal fills Health between Use and Apply, the card refunds the original item and recorded own/Command AP portions once. Failed refunds compensate their partial changes and leave the card retryable. Successful partial healing shows the amount actually restored and keeps its paid cost. The card records payment deltas; refunds add those deltas instead of resetting balances to old snapshots. Older pre-receipt cards or deleted source items require manual cost restoration; no unknown cost is guessed. This covers healing consumables; ability healing/casting remains deferred.

<a id="item-bonuses-actions-sources-and-formatting"></a>
### Sources and formatting

- [Notion Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73): potion cost, DEX item-action discount, half-base cap, fixed Command cost and non-stacking grant.
- [Notion Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c): Command grant and use on the ally's turn.
- [Notion Defenses](https://app.notion.com/p/406c72092efb81088e3be6e9d3b2c44d) and [Agility](https://app.notion.com/p/351c72092efb812cae19fb7713e9e76b): later opportunity attack/Flicker rules; not automated here.
- Website `js/abilities.js`, `js/status.js`, `js/combat-core.js`, `js/character-core.js` and `js/encounter-actions.js`: source-owned effects, active-status summaries, forms within Abilities, cost preflight, separate Command AP, spending grants first and turn freshness. Notion remains authoritative; unrelated website stat/milestone discrepancies are not ported.
- Formatting references: [D&D5e's native effect guide](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide) and [Nimble's item activation/effect editor](https://nimble-co.github.io/FoundryVTT-Nimble/documentation/homebrew/activations.html). These informed source-owned bonus sections, compact named rows and distinct activation controls. Their rules, field names and implementation are not copied.

<a id="item-bonuses-actions-data-and-validation"></a>
### Data and validation

Additive fields: Ability `system.effectsActive` (false); Actor `system.command.value` (0) and `fresh` (false). Ability kind also accepts `form`. Item Active Effects use existing v14 `system.changes`, `transfer: true`, and namespaced `managed`/`itemBound` flags. Recipient `flags.worlds-beyond.commandClaims` records delivered message UUIDs. Existing data fields are not renamed or removed and no world migration is run.

Portable tests cover equipment/ability gates, active-only grouped Status, saved definition compatibility, native item-effect creation, form switches/refunds/Base, permissions/stale editors, activation payments/refunds/cooldowns, percentage fractions, reaction abilities, potion costs/refunds, separate AP spending, Command ownership/delivery/retry/non-stacking/failure, native turn rollover and existing regressions. Offline installed v14.365 data fields and strict templates verify the sword +3 STR / ability +2 DEX examples through equip/active/passive/removal, effective modifiers and unchanged bases. A document adapter is used offline; this is not a live native document-lifecycle test. The five-tab populated Chromium preview checks desktop/phone widths with a simplified frame.

User checks after restarting Foundry and refreshing browsers:

1. Create a +3 STR sword bonus; equip/stow/delete/copy it. Check teal effective score, base editing, modifiers, milestones, source labels and resource maxima.
2. Create +2 DEX on an active ability, set costs/uses, Use/End and repeat as Passive. Check costs, cooldown correction, source removal, reload and a native world/compendium drop.
3. Check that equipment has no React button, forms live in Abilities and Status has no inactive definitions/creator. Use/End Power and switch forms/Base; verify only active sources appear, bases return, costs/refunds are correct and ordinary buffs remain. Check saved forms from earlier sheets too.
4. Command between two owned actors, then two player owners with an active GM and without one. Test delivery retry, no stacking, payment priority, pending/active turn grants, next-turn expiry and long rest. Check unlinked token actors.
5. Use potions in/out of combat with DEX bonuses/penalties, insufficient AP and Command AP. Confirm quantity, healing confirmation and balances.
6. Check read-only sheets, item editors, five tabs and phone layout. Native multi-client lifecycle, actual server permissions/GM hooks, real drops and UI rendering remain for live validation. The assistant did not access or edit live actor/world data.

Form loadouts can specify a final maximum for Mana, Holy power and custom resources. Entering, switching or ending a form keeps current points when applying or clearing that cap. A blank trigger threshold uses the resource maximum outside forms.

## Separate combat duration

Ability Active duration and consumable Bonus duration offer **Rounds in combat**. For example, enter 5 Minutes and 6 combat rounds. A use outside a started encounter starts the game-time duration, and a use during combat starts the round duration. Blank combat rounds uses the main duration; 0 keeps manual End during combat. The selected clock stays with that use, including after the encounter starts or ends.
