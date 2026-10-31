# Worn armor and shield calculations

Second equipment part, version 0.5.2. The user tested and merged PR #6 before authorizing this change. Rules were checked against Notion [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de) and [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) on 2026-10-31. Inventory capacity, backpacks and stack accounting remain the next equipment part, followed by the catalog.

## Behavior

- Equipped armor and shields add their entered AR to the existing VIT rule. Light armor adds its entered Evasion bonuses only if the heaviest worn armor is light. Medium/heavy suppress those item bonuses; shields alone do not set armor type.
- Heavy armor reduces effective AGL by armor-piece AR above 3, capped at 3. Shield AR does not increase this penalty. Effective AGL drives its modifier, milestones, reaction maximum, Natural Evasion and movement per AP. The entered score is preserved, and equipping/unequipping never writes a stat change to the database. Penalties are recalculated from that score on every preparation and cannot compound.
- Stat rows match the website's single-field behavior: show the effective score normally, switch to the base while focused for editing, then restore the effective score on blur. No extra Base/Effective row is visible. Automatic increases and decreases both use website teal (#5DB6AA); direct edits use website brass/gold (#D6A85C); manually edited stats that also have an automatic adjustment use purple (#B99AE8), as clarified by the user.
- Editing changes the base; additions still apply. For base 21 with +2, typing 22 saves base 22 and displays 24 in purple. Removing the effect reveals base 22 in gold. With no manual edit, removing an adjustment restores the unchanged original score and normal color.
- A new boolean `stats.<key>.manual` records future deliberate sheet edits. Existing values load unchanged and are not retroactively guessed to be manual. Merely focusing, blurring or submitting another field does not mark/edit a stat. Display-only `statScores` inputs are removed from submission; only intentional edits update source stats. This prevents adjusted values from being baked into the base.
- Heavy movement costs 10 ft per square and 20 ft in difficult terrain. These costs are displayed separately from feet per AP. Automatic map/AP spending remains roadmap step 8.
- With heavy armor and STR below 21, the sheet reminds the player that attacks, Dodges and AGL saves have disadvantage. The AGL roll dialog also shows a reminder; select disadvantage manually. Attack/Dodge automation remains later work. STR 21 removes this reminder, not the AGL penalty or movement cost.
- Shield Block dice are displayed for future reaction rolls, without adding Block automation.
- Each equipped armor record represents one worn piece; a leg-guard record is a complete pair. Quantity does not multiply worn contributions. Separate arm-guard records use their highest single AR once, rather than double it. Their descriptive special effects remain separate for later ability handling. Other duplicate worn pieces contribute as entered and are flagged for manual review; equipping is not restricted. All equipped shields contribute as entered; hand limits are not enforced.

## Existing data and corrections

`bonuses.armor` and `bonuses.evasion` are preserved as extra additions to the new item totals. **Clear any old manually entered equipment totals after equipping the same items, or they will be counted twice.** The sheet labels these as extra corrections. Final `overrides.armorRating`, `overrides.evasion`, movement and reaction overrides still replace complete results as before.

New nullable `overrides.armorAgilityPenalty` allows correction of just the armor penalty; blank restores automatic, explicit zero disables it. `system.equipment` and stat `effective` values are prepared context, not saved fields. No existing fields are renamed/removed, no world migration or data rewrite runs, and current Health/AP/reactions/Wonder values are not reset on equip. Reaction maximum may change while a spent current value stays fixed, consistent with existing pool behavior.

## Validation

`node --test` includes full light/heavy sets, mixed armor, shield AR exclusion from the heavy penalty, armor AR thresholds/cap, STR 20/21, explicit zero correction, arm-guard AR, paired-record quantity behavior, unequipped gear and effective-AGL core numbers. Local checks using installed Foundry 14.365 data classes verify repeated preparation, original stat persistence, milestone restoration after unequipping, and strict character/item/dialog template compilation. Modified-stat tests cover focus/input/blur, no-change submission, the 21 + 2 → edit 22 → display 24 example, and manual provenance. Actual model/template checks cover the single-field layout, structured manual state and unchanged saved bases.

Codex has not checked this in a running world: item updates triggering re-preparation across clients, Active Effect interaction, linked/unlinked tokens, actual sheet layout and phone use still need live validation.

- [ ] Restart Foundry and refresh browsers. Confirm version 0.5.2. Clear old manual armor totals if those totals are now represented by equipped items.
- [ ] Equip a light chest (1 AR), arm guards/pants/leg guards (+1 NE each): expect armor AR 1 and light NE +3. Add a medium helmet: NE item bonus becomes zero; unequip it: +3 returns.
- [ ] Equip a heavy set totaling 6 AR and a plate shield (1 AR, 1d10 Block). At base AGL 21, expect effective AGL 18, +2 modifier, one automatic reaction, 14 NE, 15 ft/AP and total AR 7 plus the VIT contribution. The sole AGL field must show 18 in teal; focusing it shows base 21 for editing. Blurring without typing restores 18 without changing the stored score.
- [ ] Change armor AR from 3 through 7: penalty 0/1/2/3/3. Changing shield AR must not change the penalty. Set penalty override to 0 and clear it again. Check final core-number overrides still work.
- [ ] At STR 20, inspect the heavy disadvantage warnings and AGL dialog; at 21, warnings disappear. Movement costs remain 10/20 ft per square.
- [ ] Unequip/re-equip repeatedly, edit an owned item's AR/type, reload, and check from another client and an unlinked token. No penalty should accumulate or refill current pools. Test a temporary AGL effect too.
- [ ] Inspect duplicate worn pieces, separate arm-guard records, read-only sheets and narrow screens. Correct unusual/custom equipment totals with the existing correction fields.

Wait for the user's test before the inventory/capacity part.

## Website reference

Inspected the current website `js/app.js` score refresh/focus handlers and `css/sheet.css` `.score.geared`, `.manual` and `.ability-adjusted` styles before this presentation change. Reference: [website source](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), [palette/styles](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/css/sheet.css). Purple is the user's requested third state, added to distinguish manual-plus-automatic changes. Website files are not edited.
