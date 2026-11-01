# Effects and forms

Effects & forms on the character sheet uses native Foundry v14 Active Effects. Add an effect or form, name it, enter its source, and add signed bonuses. New records start off. Toggle independent effects freely; choosing a form disables the other forms. Base disables forms while keeping independent effects enabled. Names open the editor; removing a direct actor effect asks for confirmation. Transferred item effects are shown with their source and keep their native editor.

## Sheet scope

- Supported simple bonuses: all eight stat scores, Armor Rating, Natural Evasion, movement per AP, Mana/Holy power maxima and existing custom-resource maxima. Negative amounts are penalties. Custom resources use stable IDs, so renaming one keeps its effect link.
- Bonuses apply before derived calculations. Modifiers, milestone diamonds, armor calculations, scaling resource maxima and ability AP previews use the resulting scores. Earned stat points remain part of the base. Effective scores show at rest; editing reveals the base. Existing teal/gold/purple states remain.
- Source tooltips identify active adjustments on affected stats, resources and core totals. Rows show the named effect, source and its changes; disabled and suppressed/expired effects are identified.
- Health damage and resource expenditure stay stored separately. Switching forms changes current/max by the same amount without refilling expenditure or writing the displayed stat into its base. AP, reactions and Wonder current amounts remain manual; changing their maxima does not refill them.
- Final maximum/core overrides still replace the calculated result. Clear an override to restore calculation with active bonuses. Extra defense/movement corrections edit stored bonuses independently of effects.
- Movement adds its bonus after the normal AGL-based rate and cannot go below zero. A final movement override replaces that result.

This step manages sheet bonus sets. Ability execution, payments, automatic durations/recovery, form portraits and gear loadouts remain later work. Native advanced changes remain editable in Foundry's editor and are preserved by the simple editor. Native item-transfer and suppression behavior is retained; equipping is not a new requirement for transferred effects.

## Data and compatibility

No existing actor or item fields are renamed or removed. The additive actor field `system.bonuses.movement` defaults to zero. Effects store v14 `system.changes` entries (`type: "add"`, `phase: "initial"`, priority 20). `flags.worlds-beyond` stores `managed`, `kind` (`effect` or `form`) and a descriptive `source`. Existing or advanced effects are not converted.

Foundry applies effects once during preparation; the sheet never applies their changes itself. The friendly editor preserves advanced rows and unchanged fractional values. Stale editor changes, permission loss and cancelled updates report errors. Form selection submits the complete selection through one embedded-document batch; a per-actor local queue serializes rapid actions.

Removing a custom resource leaves its managed effect row dormant rather than recreating an incomplete resource. The editor labels that missing target so it can be retargeted or removed. This guard applies only to effects created by this feature; unrelated native advanced effects retain Foundry behavior.

## Sources

- [Notion Stats](https://app.notion.com/p/351c72092efb81baaae9c21636d2dee4): current scores, modifiers, milestones and Health scaling.
- [Notion Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6): current INT/FTH × (level + 2) resource maxima.
- Worlds Beyond website `js/abilities.js`: named forms, independent effects and stat/defense/movement/resource-maximum targets. Notion remains authoritative for the underlying calculations.

## Validation

Portable `node --test` covers target keys, source labels, deleted resources, full form selections, independent effects, rapid actions, permissions, stale editors, cancellation, advanced/fractional row preservation and correction binding. Offline checks with installed v14.365 fields exercise native changes between base and derived preparation, strict Handlebars templates, editable/read-only controls, source escaping, base immutability, maxima and preserved expenditure. These checks do not launch or change a live world.

Still to check in Foundry:

1. Add two forms and an independent effect; edit names, sources and multiple positive/negative bonuses. Switch forms, toggle the independent effect and return to Base. Verify only one form is active and the independent effect stays enabled.
2. Verify effective stat color, base editing/clearing, milestones, armor and movement. Edit an Extra correction while its effect is active; switch off and check the correction remains separate.
3. Spend Health/Mana/custom points before switching. Check expenditure remains, overrides still win, and a renamed/deleted custom resource behaves as described.
4. Reload, reopen editors, resize/narrow the sheet and test a player owner/read-only observer. Check scrolling, autosave, source tooltips, native advanced editor and transferred item effects. Existing actors should open without migration.
