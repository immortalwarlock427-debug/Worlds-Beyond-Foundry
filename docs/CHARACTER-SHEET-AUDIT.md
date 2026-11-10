# Final character-sheet audit

**Status: ready for user testing; not yet signed off.** Allow about 30 minutes for the desktop sheet pass, then a short [combined combat play-through](#combined-combat-play-through). Broader combat is already implemented; complete this audit before adding optional integrations. Deeper cases in the guides can help reproduce failures.

## Who does what

Codex reviews code, runs regressions, checks native models/templates where practical, prepares PRs and installs the exact tested commit with verified system backups. You check the real Foundry experience and report anything confusing or broken. Codex fixes those reports before calling the character sheet complete. No need to test phone layouts.

## Prepare (3 minutes)

Restart Foundry and refresh player browsers. Record the system version and the relevant automation settings. Use two disposable characters (A and B) on a test scene, with a linked token and a deliberate unlinked copy. Keep real characters for a read-only spot-check. Have one actual player join as a player; a second GM does not test player permissions.

- [ ] Record the **Link Actor Data** setting and starting Health/AP on both the Actors sidebar sheet and each token sheet. Linked tokens share the sidebar sheet; an unlinked copy tracks its own values. Check sides in the token HUD: Ally/Friendly vs Enemy/Hostile is opposition; two tokens on the same side are teammates. See [sides](COMBAT.md#positioning).

- [ ] Open an existing character: no startup errors, missing images or lost fields.
- [ ] On the two test actors, record starting HP/AP, stats and gear. Open each tab, resize the sheet normally, close/reopen it and refresh. Values persist and controls remain reachable.

## Stats, overview and identity (4 minutes)

- [ ] Edit Class/Race, leave them blank, then fill them again. Empty entries disappear from the header. Forms appear when configured; the base name can be renamed.
- [ ] Assign base STR 21 in stat setup and an equipped +3 STR bonus: the visible stat is 24 in the modified color. Type a manual base of 22: total 25 in the combined manual+modified color. Clear the manual edit: original base 21 plus gear returns. Stow the gear: the bonus disappears. Earned stat points alone keep normal base coloring.
- [ ] Open stat setup, assign typed or rolled values, and cancel once before applying. At an award level, allocation permits the recorded total with at most 2 points to one stat per award. Milestone diamonds open the reference and reflect effective scores.
- [ ] Use all four favorites, change a selection and verify it uses the source ability. Portrait framing, medallions, hit dice, bars and bottom actions remain readable.

## Resources and recovery (5 minutes)

- [ ] Add Blood scaled by VIT, then set final max 100 and min −20. Spend from 0 to −5; an automated spend below −20 is refused. Clear overrides and confirm derived values return.
- [ ] Toggle percentage display: the percent sits beside its value; fractional balances display rounded-down whole numbers. Merely saving an unrelated field must not lose a hidden fractional balance.
- [ ] Choose one bar hex color, then two for a gradient; clear them to restore the default. Enable overflow, set 105/100 and verify the value stays 105 with a readable overflow indication.
- [ ] Try manual recovery and opt-in own-turn recovery; a new turn recovers once. Disable long-rest refill for Blood and verify a long rest leaves it alone while core pools refill.
- [ ] With some missing Health, short rest with 2 hit-die uses: each roll adds VIT once, Health caps at max, and remaining uses drop by 2. A second rest shares that remaining pool. At full Health nothing is spent. Long rest refills level uses.

## Equipment, money and consumables (5 minutes)

- [ ] Add/drop catalog gear, change quantity/equip state and reopen it. Armor/AGL/defenses and inventory slots update. Two Light weapons work; a one-handed weapon plus shield works; conflicting hand gear stows. Images and compact bonus hints are visible.
- [ ] Enter 2 pc and 37 gc: total value is 2,037 gc; denominations stay as entered.
- [ ] Outside combat, equip/stow is free. In a started encounter, set DEX modifier 0: weapon, shield and armor equip/stow each cost 2 AP. A hand swap pays once; Quickdraw weapon actions are free. With no spendable AP, the change is refused without changing gear. Try a positive DEX modifier and check the cost never falls below 1 for ordinary gear.
- [ ] Use a healing potion while injured, then at full Health: successful use restores Health; the full-health attempt says so and spends no item/AP. Check a resource potion targets Blood, and a +3 STR potion shows the bonus and duration. Applied bonuses appear in Status and end/expire correctly.
- [ ] Add a Notion resistance, a custom entry and an immunity. Save/reopen and confirm the summary follows the list. Keep one resistance and one immunity to verify in combat, then remove the test entries.

## Abilities, forms and status (7 minutes)

- [ ] Add spell twice: INT gives an Active Spell with base AP 11 and Mana; FTH selects Holy power. Enter resource costs. Use with sufficient AP/pool, then insufficient AP in combat: costs are paid once or use is refused. End does not refund a successful cast. Ordinary abilities remain editable.
- [ ] Test a self-buff and restoration ability. Bonuses apply on Use, disappear on End, and never appear in Status while inactive. Uses/cooldowns and active duration update independently; manual corrections remain usable.
- [ ] Configure a form with +3 STR, portrait, token art/2×2 size, equipment preset and resource visibility. Use, switch, then End/Base: original portrait/token/gear restore, and balances/uses do not reset. Preset checkboxes keep the editor's scroll position.
- [ ] Try the same on linked tokens and on B's unlinked copy. Linked changes affect that actor's prototype/active tokens; unlinked changes affect only that token copy. Watch the transition and restoration of position/size.
- [ ] On a test form, delete a formerly snapshotted equipment item and switch again: no repeated warning or form oscillation. Failed switches must not leave a bonus active.
- [ ] Set a resource threshold above 100. Crossing upward asks to enter; crossing back asks to end. Declining leaves the form active. An unrelated edit must not repeatedly reopen the prompt.
- [ ] Set a stored Maximum bonus, then zero it. Add an effect bonus and confirm it applies to the chosen base. At 101/100 with overflow enabled, trigger a form that sets the cap to 200 with a blank Above threshold. Confirm 101/200 without oscillation, then End and confirm 101/100. Repeat on an unlinked token.

For the final read-only spot-check, Roman’s Monstrous form points to `worlds/echoes-of-the-end-ver-1/tokens/roman-solvaris-monstrous.webp`. Use a disposable copy to check the visible 2×2, scale 1.15, 1.25-second transformation. Keep the PNG and old macro until that check passes.

## Existing combat integration and persistence (6 minutes)

- [ ] Use +0 CHA Command from A to **B · Character**: spend 5 own AP, offer 2, and B's displayed total rises by 2 above its ordinary AP. A 6-AP ability uses the 2 Command first, then 4 ordinary AP. Repeating an old Receive card does not refill it. Test the separately labeled unlinked token recipient once and verify only that copy changes.
- [ ] Add test combatants, start combat and advance turns: incoming AP/reactions refill once. A normal stat roll shows die + modifier; advantage/disadvantage identifies the kept die. Wonder consumes once per result, allows a new reroll to use Wonder again, and refuses use at zero.
- [ ] Smoke-test an equipped attack, reload and the Block/Dodge/Parry dialogs. Buttons stay visible and scrollable. The automatic exchange updates Health when enabled; the sheet and manual attack-card controls still work for table rulings.
- [ ] Refresh and reopen: notes, favorites, resource settings, costs, form configuration and active effects persist. A real character looks unchanged apart from the intended features.
- [ ] If available, an owner player can edit/use their actor; an observer can read it without gaining edit controls. Report this as **not tested** if using GM only.

## Combined combat play-through

Use the disposable scene and a real player. Keep an active GM connected. Use opposing token sides, one player-owned linked combatant, and an unlinked combatant. Record each token's starting Health, AP and reactions separately from its sidebar actor. See the [automatic exchange](COMBAT.md#resolution) and [opportunity attacks](COMBAT.md#opportunity) for details.

- [ ] Start an encounter and advance through a full round. AP and reactions refill, and enabled resource recovery runs once on the incoming character's turn. A linked token and its sidebar sheet match. The unlinked token's changes stay on that copy.
- [ ] Have the player Alt-click a target with their own token selected, then resolve a normal weapon hit. Check the defender receives the prompt, can cancel or respond, and spends the correct reaction. Compare the result card with actual Health: Resistance → Armor Rating → Block → Overwhelming Force where applicable. Try a matching immunity and confirm no damage.
- [ ] Try a save/area attack and a targeted heal. Check the selected targets, save result and actual Health on each token. With Bleeding automation enabled, actual healing ends Bleeding. Test **Undo** on a disposable result and verify the card and Health agree.
- [ ] Use **Resolve by hand** on a fresh exchange. Confirm it exposes the manual controls without automatically applying damage. Leave the world's usual settings in place.
- [ ] Move within and out of an armed enemy's reach. Check movement AP, the warning, and that an accepted opportunity attack spends one reaction and no AP. The automatic exchange skips defenses for that hit. Check completed trails clear and previews still draw.
- [ ] On a disposable character, check 0 Health, the next Bleeding Out turn, stabilization and recovery. After combat, try treatment on a stabilized character: 1 Health, one result, and native waking/Trauma. Verify the other actor or token copy did not change.
- [ ] Confirm the player can use their own sheet and answer its prompts but cannot edit a character they only observe. Refresh both clients and verify saved values and forms persist. Record which linked, unlinked and permission cases were actually exercised.

## Report and sign-off

For each failure send: actor or token copy, tab/button, values before/after, expected result and any warning/screenshot. A short report such as “0.38.24, B Character, Command: 17 stayed 17 after receiving 2” is enough. You can stop at the first repeatable defect; do not keep spending real resources to reproduce it.

- [ ] No unresolved sheet defects from this checklist.
- [ ] Untested player/linked-token cases are listed explicitly.
- [ ] The combined combat play-through is recorded; any failures or cases not tested are listed.
- [ ] User approves the sheet and combat audit before optional effects/module work.
