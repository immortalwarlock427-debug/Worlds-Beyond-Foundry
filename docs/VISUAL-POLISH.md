# Chat and equipment polish

Version 0.15.0 implements the first visual-review batch: consistent system chat cards and compact equipment rows, including item artwork, equipped-state contrast and quieter removal controls. It retains the tested 0.14.0 interface cleanup that was merged into the Parry topic branch after that branch's PR had already merged to main. This PR carries that approved cleanup forward to main as well.

## Behavior

- A shared render hook themes visible Worlds Beyond roll, attack, damage, reload and consumable cards. It identifies the system card markup, so cards without attack/check flags receive the same surface. Hidden results are skipped before their HTML is inspected. Ordinary Foundry messages and native sidebar/canvas styling retain their own theme.
- Equipment is grouped under Weapons, Armor, Shields, Consumables and Gear. Empty groups are omitted; unknown/legacy item types remain in Gear. Existing inventory order is preserved inside each group.
- Desktop rows contain a stock/custom icon, a brass name link and one line of key stats, followed by compact actions. Quantity appears when useful, including zero. Names open the existing item editor; hover summaries provide additional detail. On narrow sheets the actions wrap beneath the item text to retain 44px touch targets.
- Attack/Use remain the primary actions. Reload, Equip and Remove have labeled icon controls. Equipped gear has a filled brass hand/armor/shield button and a pressed state. Remove stays muted and keeps the existing confirmation dialog.
- Native stock icons cover all catalog weapons and armor pieces/shields. New or manually refreshed catalog entries get this artwork. Existing generic SVG images get a sheet-only fallback; custom images are preserved and saved item images are not rewritten. No catalog-version bump or automatic compendium refresh runs for an art-only update.
- The system sheet/dialog scrollbars, checkboxes and radio controls use brass. The compact dice row and optional rules/help from 0.14.0 remain. Character/Equipment tabs and later Abilities/Notes views are a separate interface step after this batch is tested.
- No rules, costs, resource transitions, actor/item schemas or item IDs changed. Existing actions still resolve the original embedded item ID and enforce the same ownership/read-only behavior.

## Sources and checks

The current website's grouped equipment/consumable controls in [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html) were consulted on 2026-11-01. Artwork paths were selected from the installed Foundry 14.365 stock library; all 36 referenced stock paths were checked on disk. Foundry's own checkbox CSS variables supply the checked-state colors.

Automated tests cover all supported chat-card markers, hidden/unrelated messages, stock/custom icon selection, catalog artwork diversity, grouping legacy/zero-quantity items and preservation of their actions. Existing gameplay tests cover spending, ownership, rolls and recovery. Local checks use real Foundry data models and strict Handlebars for 42 interface cases plus populated editable/read-only rows across all item categories. Those checks retain form controls and verify item identities/actions, quantity zero, shots, name escaping and custom artwork.

The PR records live Foundry checks and their limits. Test before merging:

1. Restart Foundry and refresh player browsers. Compare an existing stat, attack/damage, reload and consumable card; each should have the same navy surface/brass headings. Ordinary chat and blind-roll visibility should behave as before.
2. Open equipment and check the grouped rows, fitting icons, key stats and existing Attack/Reload/Use actions. Click a name to open its editor.
3. Compare equipped/unequipped states. Remove should be a quieter trash control with the existing confirmation.
4. Check a narrower sheet, keyboard focus, long names, zero quantity, loaded-shot counts and a custom item image. Check the Backpack checkbox's two states and the scrollbar.
5. Keep compendium refresh optional: existing character rows already receive generic-image fallbacks. Refreshing the catalog follows the existing behavior in CATALOG.md.
