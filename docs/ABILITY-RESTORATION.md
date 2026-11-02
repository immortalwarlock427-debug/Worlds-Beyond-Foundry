# Ability restoration

An Ability Item can now restore its user's Health or one resource when used, alongside its existing costs and numeric bonuses. This is sheet resolution for self benefits; ally targeting, damage, saves, templates and animations belong to later combat work.

## Configure and use

1. Open an owned non-passive ability or form and expand **Restoration**.
2. Choose Health, enabled Mana/Holy power or a custom resource such as Blood. Custom references use stable IDs; renamed pools keep working, deleted or hidden pools require a new selection.
3. Enter an amount or Foundry dice formula, such as `20` or `2d6+2`. Select Points or % of maximum. Blank disables restoration.
4. Use the ability from Abilities. Its navy chat card shows restoration and any roll using the selected chat visibility. Fractional balances remain internal; the restored amount displays rounded down.

Percentage restoration uses the pool's maximum before this activation's costs, bonuses or form switch. It does not use the remaining balance or the span from minimum to maximum. Normal restoration caps at maximum; a pool's explicit Allow over maximum setting permits overflow.

Pure restoration at an already full pool spends no AP, resource, reaction, use or cooldown and rolls no dice. A zero/negative roll likewise spends nothing for pure restoration. An ability that also grants an enabled bonus or enters a form can still activate at full: that other benefit and its normal costs remain meaningful. Passive abilities never automatically heal; their editor hides Restoration.

Use validates costs before rolling. Payment, restoration, use/cooldown tracking, form changes and bonus activation share the existing reversible action. Paying and restoring the same resource retains both operations: 125 maximum, 20 spent, a 10-point cost and 10% restoration leave 17.5 spent (107.5 current). A pure restoration ability cannot spend into an already full pool just to create room for its own restoration.

Restoration happens once per successful Use. Pure restoration stays ready to Use subject to its uses/cooldown. Abilities with bonuses/forms retain Use/End activation; End removes those bonuses without undoing healing or refunding a successful activation. Failed updates or chat posting roll back completed operations; a failed refund reports that manual correction is needed.

## Data and sources

The additive `system.restoration` group has `target` (default `health`), `amount` (blank formula text) and `unit` (default `points`). Existing abilities therefore gain no automatic restoration. No stored fields are renamed or removed. Restoration math is shared with consumables in Foundry-free `module/consumable-benefits.mjs`.

The website's current `js/abilities.js` was consulted for costs, owned bonuses and activation flow. Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) remains the resource-scaling authority. These editable benefits implement the user's requested customization; no new spell formula or class rule is invented.

## Validation

Portable tests cover capped healing, full/zero no-spend, buffs/forms at full, overflow, stable/missing custom pools, same-pool percentage payment, whole-number results, all four visibility modes, insufficient AP before rolling and update/post/render failures with refunds. Existing action regressions remain covered.

Offline checks load actual installed v14.365 data fields and strict Handlebars templates. Native models verify additive defaults, exact same-pool balances and rollback without source drift; owner/observer templates verify escaped labels, disabled controls and passive hiding. An isolated headless editor preview passes at 760/390/340 pixels with no horizontal overflow and visible controls at least 44 pixels. Dice and document lifecycle use adapters; this does not substitute for a running world.

Live checklist for the user: restart Foundry and refresh browsers; configure a Health heal with AP and a resource cost, test capped/full use, then restore Blood and a percentage of the same resource being spent. Combine healing with a bonus and verify End only removes that bonus. Check private/blind rolls, a form trigger crossing and an unlinked token. Confirm saves/reloads preserve balances and existing blank-restoration abilities behave as before. Installation and offline checks never edit world/actor data.
