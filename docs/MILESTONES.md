# Milestone details

Use **Attributes → Milestones** for the full reference, or tap/click a milestone diamond to open that stat with the chosen rule expanded. Each stat has its 21 and 28 milestones, a current score and an Unlocked/Requires state. Filter between stats or All stats. Details expand on click, touch or keyboard; longer rules stay out of the character sheet.

This reference is a native v14 DocumentSheetV2 window tied to the actor, so actor refreshes update its values. It uses a non-form root, no named data inputs and no document submit writes. Owners and read-only viewers can filter and open rules. Native permissions still govern access. Reopening a diamond reuses the actor's reference window, expands the requested rule and scrolls it into view; disclosure and scroll state otherwise use native Handlebars synchronization.

## Rules and calculations

- All 16 milestones use the current effective score, including earned points, effects and armor penalties. Reaching 21/28 gains the milestone; dropping below it loses it. Unlock state is derived, never saved as a separate flag.
- The reference includes timing, full mechanical rules, source links and the general out-of-combat rule: once-per-combat becomes once per long rest, and once-per-round becomes uses equal to the stat modifier per long rest. Indomitable's status-negation limit is distinguished from its separate below-zero stabilization roll; Sixth Sense's question limit is separate from its passive warning.
- Current previews include Parry's DEX roll and ally reach, Indomitable's VIT roll against DC 12, Adamantine Body's VIT contribution, Surge's 2 free movement AP expressed at the final movement rate, Stratagem's INT bonus, Wisdom rolls, Commanding Presence's target DC and Unassailable Self's source-level threshold. Wonder's displayed maximum respects its existing override.
- Already implemented passives remain unchanged: Adamantine Body replaces the VIT modifier with floor(VIT / 2) in AR at current VIT 28; AGL 21/28 each adds a reaction maximum; Defy Fate upgrades the existing Wonder check/save behavior at FTH 21. Final overrides still win. Regression checks cover these passives rather than duplicating their calculations in the reference.
- Other entries are rules/previews only. Uses, AP payments, attacks, movement, status negation, GM checks, vision and conditional advantages are resolved manually. In particular, Surge does not inflate normal AP, Eyes of Truth does not modify token vision, and no new combat action or automatic lifecycle is introduced. Listed AP costs reproduce the source; this window does not calculate or pay action costs.

No actor/item fields are added, renamed or removed. No saved bases, resource balances, effects or ability records are written by this feature.

## Source review

The website's current `js/app.js`, `js/abilities.js`, `index.html` and `css/sheet.css` were consulted for expandable milestone details, names and the navy/brass palette. Two website rules are stale relative to Notion: its STR 21 entry is Devastate, and its Commanding Presence DC is 10 + twice CHA. This implementation follows the current Notion pages: **Titan's Might pushes 15 ft** (or attempts prone), and **Commanding Presence uses DC 12 + CHA modifier**. Singularity uses Notion's declared weapon-attack wording; no website-only dual-hand rule is introduced here.

Authoritative pages reviewed:

- [General Stats](https://app.notion.com/p/351c72092efb81baaae9c21636d2dee4) and [Stats Explained](https://app.notion.com/p/351c72092efb81e89505f5950939e031).
- [Strength](https://app.notion.com/p/351c72092efb81bc9c1dc28707e48241), [Dexterity](https://app.notion.com/p/351c72092efb8132b174eb48b029c4ab), [Vitality](https://app.notion.com/p/351c72092efb813e9ab9c1193bdcbb47), [Agility](https://app.notion.com/p/351c72092efb812cae19fb7713e9e76b).
- [Intelligence](https://app.notion.com/p/351c72092efb81fd8861d6d5d5b12eb4), [Wisdom](https://app.notion.com/p/351c72092efb8126bbbaf6116a2b38a3), [Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c), [Faith](https://app.notion.com/p/351c72092efb813a8dcdf9dbae517e29).

## Validation

`node --test` covers all 16 records, exact unlock boundaries, effective rather than stored scores, current modifiers and preview values, out-of-combat descriptions, passive recalculation, source immutability, local filtering, window reuse, focused disclosure, no-op submission and read-only access to reference controls.

Offline checks with installed Foundry v14.365 fields and strict Handlebars templates cover earned points, native effects gaining/losing milestones, Adamantine AR/reaction changes, current CHA DC, all/focused references, safe non-submit buttons, unchanged character form fields and source data. Native DocumentSheetV2 registration/permission handling and Handlebars disclosure/scroll synchronization were inspected in installed v14.365 source.

No live Foundry world or computer UI was used, per the user's preference to test the interface themselves. Check after restarting:

1. Open Milestones and filter All/each stat. Tap a locked and unlocked diamond; check the chosen rule opens and the window scrolls/resizes on desktop and phone. Test keyboard focus and disclosure controls.
2. Keep the reference open while changing a score or toggling a form/effect across 21/28. Check its state and current previews refresh. Check earned-point and heavy-armor effects on unlocks.
3. Verify VIT 28 AR, AGL reaction maxima and FTH 21 Wonder still work with clearable overrides. Check Titan's Might says 15 ft and Commanding Presence displays 12 + current CHA modifier.
4. Test an owner and a read-only observer; filtering, reading and closing should work without enabling character edits. Reopen/reload and confirm no resources, bases or usage counts changed from reading rules.
