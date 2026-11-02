# Form loadouts

Forms can remember a portrait and equipped gear from the character's shared inventory. They can also choose which ability and resource rows appear. Existing forms keep their current behavior until configured. Stat changes still belong in the form's Bonuses section.

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

Native timer/manual/deletion hooks reconcile physical loadouts through the active GM (the owner handles changes when no GM is active). Internal paid-switch updates suppress duplicate hook work. Reload/canvas-ready reconciliation can finish an expired saved loadout. These hooks do not poll or advance time. Existing linked/unlinked Actor identities remain distinct; changing a token actor affects that copy.

## Sources and checks

Consulted the current website `js/abilities.js`, `js/equipment-profiles.js`, `js/resources.js` and `index.html`: one inventory, per-form equipment profiles, portrait links, shared/default visibility and on-demand configuration. The current Notion Game Systems search did not provide a general transformation/loadout rule; these are configurable character records. No automatic form powers, equipment creation or new transformation costs are inferred. Existing Notion-based stats, costs, triggers and hand rules remain authoritative.

Portable tests cover paid switches, remembered/empty presets, new/deleted items, hand conflicts, failed posting, partial/ignored equipment batches, End/Base, expiry/deletion, inherited gear, portrait/visibility edits, no-op legacy defaults and hook authority. Offline actual v14.365 TypeDataModel fields, native hand normalization and strict owner/observer templates verify gear switches, base stats and exact fractional balances, escaped text, row filtering, Show all and source stability. An isolated browser checks editor/character at 760/390/340 px for scrollability, no horizontal overflow and 44 px new controls; narrow previews were inspected.

Not yet tested in the running world: autosave/focus, image picker, real owned-document/socket lifecycle, timer expiry, multiple players and linked/unlinked actors. Before merging, restart Foundry and refresh player browsers. Make two forms with different gear/portraits and bonuses. Spend AP/Health/resources and shots, then Use/switch/End/Base, reload while transformed and test expiry. Change gear while transformed and confirm it returns on the next activation. Try a portrait edit, an empty preset and deleting a referenced item. Test Show all, owner/observer and narrow sheets. Check costs are paid once, unchanged balances/counters persist, Base returns correctly and independent buffs stay active.

After this step is user-validated, the remaining character-sheet gate is the final validation pass in ROADMAP.md. Broader combat, spell visuals and module integration remain separate work.
