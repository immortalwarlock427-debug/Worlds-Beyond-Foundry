# Form loadouts

Forms can remember a portrait and equipped gear from the character's shared inventory. They can also choose which ability and resource rows appear. Existing forms keep their current behavior until configured. Stat changes still belong in the form's Bonuses section.

## Token transformation

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

## Configure a character's form

1. Open **Abilities → your form → Form loadout**. Enter a Portrait path, or change the character header portrait while that form is active. Blank uses the remembered Base portrait. This changes the Actor portrait; map-token artwork is separate.
2. Choose **Copy current gear**, or select items and enable **Use saved equipment**. An enabled empty selection stows all equippable items. Leaving it off shares Base gear. Existing hand rules resolve conflicting weapon/shield choices; missing/deleted IDs are ignored.
3. Under **Abilities shown / Resources shown**, uncheck rows to keep that form's sheet compact. New items/resources default to shown. Forms themselves and active abilities remain reachable so they can be switched/ended. **Show all** reveals hidden rows for editing, including for observers.
4. **Use** pays the existing recorded costs and switches to the form. Equipped-item changes made while a saved preset is active are remembered when leaving it. **End / Base form**, native expiry and deleting the active form restore Base gear and portrait. Editing a portrait or visibility does not reset unsaved equipped-item changes.

Visibility is organization, not a new game rule: hiding abilities does not end bonuses or disable passives, and hiding a resource does not stop recovery or block costs. Globally hidden Mana/Holy power remain globally hidden. Status continues to list active sources. Configure a form's numeric effects on its Bonuses editor, rather than relying on row visibility to suppress them.

The same Item records, shots, quantities, uses, cooldowns and resource expenditure are shared across forms. Switching never creates another inventory or writes effective stats into their base. Gear/form bonuses continue to use native Active Effects and the existing maximum/expenditure policy. Base is free and does not end ordinary buffs. Equipped changes while sharing Base gear remain Base changes.

## Compatibility and implementation

Additive `Ability.system.loadout` fields: `portrait` (blank), `gearEnabled` (false), and Boolean maps `equipment`, `abilities`, `resources` (empty). Equipment keys and ability references are embedded Item IDs; resource keys are Mana/Holy power or stable custom-resource IDs. An omitted visibility key means shown. Configure these character-specific references on the owned copy after moving a form between characters. Saved actor-owned legacy forms stay usable without automatic conversion.

`flags.worlds-beyond.formLoadoutState` holds the current configured form ID, Base portrait/equipment and whether the prior form used a gear preset. It is created on an intentional configured switch, not on ordinary rendering or when using unconfigured forms. The actor's existing action queue coordinates Use/End/Base. The reversible action restores costs, flags, portrait and gear after a failed post/update, including partial gear batches. An internal compensation flag bypasses hand normalization only while restoring the exact prior equipment snapshot. No data-model fields are renamed or removed.

Each loadout write and compensation receives a fresh Foundry operation object. v14 adds `parentUuid` to embedded Item requests; reusing that object for a subsequent Actor update incorrectly addresses the Actor as its own embedded document. Fresh operations also prevent prior trigger snapshots leaking into later switches. Internal loadout writes do not evaluate resource triggers.

Native timer/manual/deletion hooks reconcile physical loadouts through the active GM (the owner handles changes when no GM is active). Internal paid-switch updates suppress duplicate hook work. Reload/canvas-ready reconciliation can finish an expired saved loadout. These hooks do not poll or advance time. Existing linked/unlinked Actor identities remain distinct; changing a token actor affects that copy.

## Sources and checks

Consulted the current website `js/abilities.js`, `js/equipment-profiles.js`, `js/resources.js` and `index.html`: one inventory, per-form equipment profiles, portrait links, shared/default visibility and on-demand configuration. The current Notion Game Systems search did not provide a general transformation/loadout rule; these are configurable character records. No automatic form powers, equipment creation or new transformation costs are inferred. Existing Notion-based stats, costs, triggers and hand rules remain authoritative.

Portable tests cover paid switches, remembered/empty presets, new/deleted items, hand conflicts, failed posting, partial/ignored equipment batches, End/Base, expiry/deletion, inherited gear, portrait/visibility edits, no-op legacy defaults and hook authority. Offline actual v14.365 TypeDataModel fields, native hand normalization and strict owner/observer templates verify gear switches, base stats and exact fractional balances, escaped text, row filtering, Show all and source stability. An isolated browser checks editor/character at 760/390/340 px for scrollability, no horizontal overflow and 44 px new controls; narrow previews were inspected.

Not yet tested in the running world: autosave/focus, image picker, real owned-document/socket lifecycle, timer expiry, multiple players and linked/unlinked actors. Before merging, restart Foundry and refresh player browsers. Make two forms with different gear/portraits and bonuses. Spend AP/Health/resources and shots, then Use/switch/End/Base, reload while transformed and test expiry. Change gear while transformed and confirm it returns on the next activation. Try a portrait edit, an empty preset and deleting a referenced item. Test Show all, owner/observer and narrow sheets. Check costs are paid once, unchanged balances/counters persist, Base returns correctly and independent buffs stay active.

After this step is user-validated, the remaining character-sheet gate is the final validation pass in ROADMAP.md. Broader combat, spell visuals and module integration remain separate work.
