# Bonuses, forms and Status

Create an ability or equipment item, then add signed bonuses on its own editor. Forms are Form-type Ability Items, created with **Abilities → Add form** or the ability type selector. **Use** pays the recorded costs and replaces the previous form; **End** or **Base form** ends it freely. Ordinary active abilities remain independent. Bonus records use native Foundry v14 Active Effects internally; players do not create standalone effects from the character sheet.

**Status** is a live list of active sources, not their definitions. An inactive ability, unequipped item, disabled bonus or suppressed/expired effect is absent. Multiple active bonuses from one item are summarized once under its name. Ability End ends that source, while equipment and passive bonuses open their source editor and cannot be ended independently from Status. Native active conditions are also shown. The list does not invent unsettled condition rules or automatic durations.

## Sheet scope

- Supported simple bonuses: all eight stat scores, Armor Rating, Natural Evasion, movement per AP, Mana/Holy power maxima and existing custom-resource maxima. Negative amounts are penalties. Custom resources use stable IDs, so renaming one keeps its effect link.
- Bonuses apply before derived calculations. Modifiers, milestone diamonds, armor calculations, scaling resource maxima and ability AP previews use the resulting scores. Earned stat points remain part of the base. Effective scores show at rest; editing reveals the base. Existing teal/gold/purple states remain.
- Source tooltips identify active adjustments on affected stats, resources and core totals. Status shows active source names and their changes; inactive definitions remain on their ability/equipment editors.
- Health damage and resource expenditure stay stored separately. Switching forms changes current/max by the same amount without refilling expenditure or writing the displayed stat into its base. AP, reactions and Wonder current amounts remain manual; changing their maxima does not refill them.
- Final maximum/core overrides still replace the calculated result. Clear an override to restore calculation with active bonuses. Extra defense/movement corrections edit stored bonuses independently of effects.
- Movement adds its bonus after the normal AGL-based rate and cannot go below zero. A final movement override replaces that result.

Equipment and ability bonuses live on their source Items; ability Use pays recorded costs and enables bonuses. Automatic durations/recovery, form portraits, gear loadouts and attack/damage casting remain later work. See [item bonuses and actions](ITEM-BONUSES-ACTIONS.md). Native advanced changes remain editable in Foundry's editor and are preserved by the simple editor. Managed item bonuses are suppressed unless the item is equipped or its ability is passive/active. Unrelated native transferred effects retain their existing behavior.

## Data and compatibility

No existing actor or item fields are renamed or removed. Ability `system.kind` gains a `form` choice; activation uses the existing `system.effectsActive` field. Effects store v14 `system.changes` entries (`type: "add"`, `phase: "initial"`, priority 20) and namespaced source flags. Saved actor-owned adjustments/forms from older sheets appear under Abilities, with edit/Use/End/remove controls. They remain stored as they were: no automatic conversion, duplicate application or world migration. Their inactive definitions do not appear in Status. New ones use native Ability Items.

Foundry applies effects once during preparation; the sheet never applies their changes itself. The friendly editor preserves advanced rows and unchanged fractional values. Stale editor changes, permission loss and cancelled updates report errors. A per-actor queue serializes form switches. Switching deactivates other Form abilities and saved actor forms; failed switching/posting compensates the previous selection and payments. Base form does not end ordinary buffs.

Removing a custom resource leaves its managed effect row dormant rather than recreating an incomplete resource. The editor labels that missing target so it can be retargeted or removed. This guard applies only to effects created by this feature; unrelated native advanced effects retain Foundry behavior.

## Sources

- [Notion Stats](https://app.notion.com/p/351c72092efb81baaae9c21636d2dee4): current scores, modifiers, milestones and Health scaling.
- [Notion Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6): current INT/FTH × (level + 2) resource maxima.
- Worlds Beyond website `js/abilities.js` and `js/status.js`: forms with abilities, source-owned bonus definitions and an active-status summary that ends the originating ability. Notion remains authoritative for the underlying calculations; the user's requested source/Status organization takes precedence over website layout.

## Validation

Portable `node --test` covers active-only Status, grouped source bonuses, saved definitions in Abilities, form switching/refunds/Base, independent buffs, permissions, stale editors, cancellation, source keys and advanced/fractional preservation. Offline checks with installed v14.365 fields exercise native changes between base and derived preparation, strict Handlebars templates, editable/read-only controls, source escaping, base immutability, maxima and preserved expenditure. These checks do not launch or change a live world.

Still to check in Foundry:

1. Add two Form abilities and an independent active ability; add positive/negative bonuses on their item sheets. Use the ability, switch forms and return to Base. Verify one form is active, the ordinary buff stays active, and Status shows only active sources. End a buff from Status and check its row disappears and its base returns.
2. Verify effective stat color, base editing/clearing, milestones, armor and movement. Edit an Extra correction while its effect is active; switch off and check the correction remains separate.
3. Spend Health/Mana/custom points before switching. Check expenditure remains, overrides still win, and a renamed/deleted custom resource behaves as described.
4. Reload, reopen editors, resize/narrow the sheet and test a player owner/read-only observer. Check scrolling, autosave, source tooltips, native advanced editor and transferred item effects. Existing actors should open without migration.
