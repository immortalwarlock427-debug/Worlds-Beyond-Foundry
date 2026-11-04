# Equipment, inventory and consumables

Use native Item records, the Items directory and the Worlds Beyond Catalog. The sheet groups equipped gear and consumables, shows their bonuses and provides compact actions. Currency tracks gc and pc (1 pc = 1,000 gc).

During started combat, equipping/stowing weapons, shields and armor costs DEX-adjusted 2 AP (1–3); Quickdraw weapons are free. An automatic hand-gear swap pays once. Outside combat these controls are free. Direct Equipped edits remain manual corrections. Consumable restoration and forms are also covered in [Abilities and forms](ABILITIES-FORMS.md).

New catalog thumbnails use lightweight WebP; existing image links remain usable. Fonts are bundled for offline use. See the [desktop audit](CHARACTER-SHEET-AUDIT.md) for current validation; implementation and historical checks follow.


## Contents

- [Equipment: item records and sheets](#equipment)
- [Worn armor and shield calculations](#armor-calculations)
- [Inventory, consumables and Block dice](#inventory)
- [Equipment catalog](#catalog)
- [Equipment artwork](#equipment-art)
- [Potion durations and item bonus hints](#potion-durations)


<a id="equipment"></a>
## Equipment: item records and sheets

This first part of roadmap step 3 adds weapon, armor and shield Item types, ApplicationV2 item sheets and a character equipment list. Add items from the character sheet or drop them from Foundry's Items directory. Open an item's name to edit it, toggle Equipped, or Remove it after confirmation. Existing `gear` items retain their original data model and sheet and remain visible in the list.

<a id="equipment-currency"></a>
### Currency

Equipment has editable Gold coins (gc) and Platinum coins (pc) balances, with a combined value in gc. The user confirmed **1 pc = 1,000 gc** on 2026-11-02. The Notion Game Systems/Equipment Rules pages were checked; this denomination/conversion rule comes from that explicit clarification. The website's current Equipment markup and navy/brass styling were consulted for placement and presentation.

`system.currency.gc` and `system.currency.pc` are nonnegative integer fields, initially 0. Existing characters receive those defaults through the native data model; no existing fields are renamed or removed. Coin counts save with the actor and stay shared across forms. The total is computed for display in the Foundry-free `module/currency.mjs`; it is not another saved balance. Typed decimals round down through the existing numeric-control handler. Clearing a field restores 0. Observers see both balances and the total with disabled controls.

Denominations stay as entered, including 1,500 gc alongside 2 pc (3,500 gc total). This tracker adds no automatic exchange, purchasing, item-price deduction, transfer, inventory weight or rest recovery.

Validation: all 388 portable tests pass, including conversion math, frozen-balance presentation and decimal/unchanged form submissions. Native v14.365 fields verify zero defaults on older data, currency-only updates, save/reload and clear-to-zero while preserving earned stats, fractional Health/AP/Mana and Notes. Strict templates cover 48 owner/observer/tab contexts; original controls/text remain with only the new currency section added. An isolated native-mixin browser preview checks 192 states at desktop/window widths 1280/1000/880/760 px: correct amounts/totals, disabled observer controls, no overflow/clipped input values and restored Equipment focus/scroll. The desktop Equipment screenshot was inspected. Actual world autosave, socket permissions and player-client refresh remain for the user's live validation after restarting Foundry.

<a id="equipment-sources-and-scope"></a>
### Sources and scope

Checked 2026-10-31 against Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) and [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de).

Each type has its own registered model: `WeaponData`, `ArmorData` and `ShieldData`. Their common base contains description, quantity, slots, cost and equipped state; name/image are native Item fields. Only weapons have weapon fields; only armor has armor type, worn piece, Armor Rating and Evasion; only shields have Armor Rating and Block die. Existing `gear` has no new model attached.

Weapon data uses these stable keys for later attack automation:

- `family`: one of `balanced` (default, melee only), `heavy`, `finesse`, `paragon`, or `none` (standard ranged weapon with no special family). These are mutually exclusive choices, not duplicate property flags.
- `ranged`: independent boolean, default false. Set it explicitly for ranged weapons, including ranged Paragon weapons. Never infer it from family, numeric range, weapon name or the Thrown flag.
- `properties`: boolean keys `light`, `twoHanded`, `versatile`, `strapped`, `reach`, `mount`, `thrown`.
- `signature`: boolean keys `sweep`, `hook`, `stagger`, `disarm`, `entangle`, `puncture`, `sunder`, `bleed`, `pierceThrough`, `bulwark`, `quickdraw`, `concealed`, `silent`, `loud`.
- `range.normal` and `range.long`: numbers in feet, default 0. `loading`: numeric shots before reloading, default 0 for none. Range and Loading are represented by these numeric fields rather than redundant flags.
- `damage`, `versatileDamage` and `damageType` remain text. Description accepts custom rules text. Properties/signatures are checkboxes and the family is a dropdown. Flags default to false and are saved explicitly, including when unchecked.

<a id="equipment-weapon-rule-contract-for-step-4"></a>
#### Weapon rule contract for step 4

Verified against Weapons Explained edited **2026-10-31 21:55:20 UTC**, including the updated melee-only definition of Balanced. The website is not the source for these classifications. Attack automation remains the next roadmap step; these records preserve the distinctions it must read.

| Weapon classification | Data | Attack stat | Damage modifier | Natural crit | Missing-stat disadvantage |
| --- | --- | --- | --- | --- | --- |
| Balanced melee | `ranged: false`, `family: balanced` | STR or DEX | Single chosen modifier | 20 | None |
| Heavy | `family: heavy` | STR | Double STR modifier | 20 | STR below 21 |
| Finesse | `family: finesse` | DEX | Single DEX modifier | 18–20 | DEX below 21 |
| Paragon, melee or ranged | `family: paragon`, explicit `ranged` flag | STR or DEX | Double chosen modifier | 18–20 | Either STR or DEX below 21 |
| Standard ranged | `ranged: true`, `family: none` | DEX | Single DEX modifier | 20 | None |

Ordinary bows/crossbows, Revolver, Sling, Blowgun, Dart and Net use `ranged: true, family: none`. Warbow and Arbalest use `ranged: true, family: paragon`. Dart and Net additionally have `properties.thrown: true`; a weapon can be both ranged and Thrown.

Chakram uses `ranged: false, family: finesse, properties.thrown: true`. Its melee family remains Finesse even when thrown: a thrown attack uses DEX and still requires 21 DEX to avoid its family disadvantage. A Dagger is `ranged: false, family: balanced, properties.thrown: true`, not a ranged-family weapon. Later attack handling must receive an explicit melee/ranged/thrown attack mode; throwing does not mutate the saved weapon's family or ranged flag.

Armor records identify light/medium/heavy and the five worn pieces: chest, pants, arm guards, helmet and leg guards as a pair. Numeric corrections remain unrestricted. This pre-merge equipment schema restructure is explicitly requested while no saved items exist; no migration from the earlier prototype equipment schema is supplied. Actor fields and generic gear are unchanged.

The first item-record part was tested and merged. Equipped armor/shields now contribute to defenses and effective AGL: see [armor calculations](EQUIPMENT.md#armor-calculations). Inventory capacity and weapon attack automation remain later steps. Property and signature automation belongs to the attack step; a full weapon catalog, equipment-derived defenses and inventory capacity remain subsequent equipment parts. Generic gear is preserved without attaching a new schema to it. No existing actor fields are renamed or removed.

When automating armor next, follow the current Notion details: the heaviest piece determines armor type, only light armor gives its light-piece Evasion bonuses, heavy movement costs 10 ft per square (20 ft difficult), and heavy armor's AGL reduction is capped at 3. Arm guards do not double their AR when worn on both arms. These effects are not approximated by this PR.

<a id="equipment-validation"></a>
### Validation

`node --test` covers item creation on the correct actor, ownership, equip/unequip, per-type schema separation, boolean property/signature keys, numeric range/loading, explicit ranged/family/Thrown examples, family selection, checked/unchecked sheet context, readable summaries and existing character/roll behavior. Local checks with the installed Foundry 14.365 fields verify defaults, save/reload of structured flags and numeric values (including false and zero), invalid family/non-numeric rejection, and all three strict Handlebars sheet branches including escaped user text and read-only checkbox rendering.

Not tested in a running world by Codex: actual creation dialogs and registration, sheet rendering/scrolling, native drag/drop, owned-item editing and rerendering, removal confirmation, permissions across clients, or phone layout. Browser local-file preview remains blocked.

Before the next equipment part:

- [ ] After installation of merged main (or an explicitly requested test branch), restart Foundry and refresh browsers. Confirm version 0.4.1 and that existing characters, Health, pools and rolls still work.
- [ ] Add a weapon on a character. Select a family, check properties and signatures, and enter numeric normal/long ranges and loading. Close/reopen and reload; confirm values persist. Uncheck properties/signatures and set numeric values to zero, then reload and confirm they stay cleared. Check the Ranged weapon flag independently: use None + Ranged for an ordinary bow, Paragon + Ranged for Warbow/Arbalest, and Finesse + Thrown without Ranged for Chakram. Confirm armor/shield sheets contain only their own fields.
- [ ] Add armor for each worn piece, including paired leg guards; enter AR/Evasion. Add a shield with Block die. Equip/unequip: the flag should update on the character and item sheet while existing manual core numbers remain unchanged.
- [ ] Create a world item through Items → Create Item; confirm readable type names and the appropriate sheet. Drop it onto a character and verify the owned copy can be edited independently.
- [ ] Confirm old gear is listed and opens its existing sheet. Remove an item: cancel must preserve it; confirming removes only the chosen owned item.
- [ ] Check an observer view and a phone-width sheet: fields and mutation buttons are disabled as appropriate, names remain readable, controls are reachable and descriptions display as plain text.

Wait for the user's validation before adding equipment calculations and the catalog.

<a id="equipment-combat-equipment-changes"></a>
### Combat equipment changes

The sheet Equip/Stow buttons cost 2 AP adjusted by DEX (1–3 AP) for weapons, shields and armor while that actor is in a started encounter. The user confirmed armor and shields share this cost on 2026-11-03. A swap pays once, including automatically stowed conflicting hand gear. Quickdraw weapons cost 0 AP to draw, stow or swap to. Outside combat, the buttons are free.

Item-sheet Equipped edits remain manual corrections. Form presets use the form ability's existing cost. Failed gear updates restore AP and affected equipment. No new armor timing rule is inferred.

Validation: 418 Node tests passed, including DEX limits, Quickdraw, insufficient AP, outside-combat use and failure after a conflicting weapon was stowed. Live Foundry/server testing remains part of the final audit.

<a id="armor-calculations"></a>
## Worn armor and shield calculations

Second equipment part, version 0.5.3. The user tested and merged PR #6 before authorizing this change. Rules were checked against Notion [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de) and [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) on 2026-10-31. Inventory capacity, backpacks and stack accounting remain the next equipment part, followed by the catalog.

<a id="armor-calculations-behavior"></a>
### Behavior

- Equipped armor and shields add their entered AR to the existing VIT rule. Light armor adds its entered Evasion bonuses only if the heaviest worn armor is light. Medium/heavy suppress those item bonuses; shields alone do not set armor type.
- Heavy armor reduces effective AGL by armor-piece AR above 3, capped at 3. Shield AR does not increase this penalty. Effective AGL drives its modifier, milestones, reaction maximum, Natural Evasion and movement per AP. The entered score is preserved, and equipping/unequipping never writes a stat change to the database. Penalties are recalculated from that score on every preparation and cannot compound.
- Stat rows match the website's single-field behavior: show the effective score normally, switch to the base while focused for editing, then restore the effective score on blur. No extra Base/Effective row is visible. Automatic increases and decreases both use website teal (#5DB6AA); direct edits use website brass/gold (#D6A85C); manually edited stats that also have an automatic adjustment use purple (#B99AE8), as clarified by the user.
- Editing changes the base; additions still apply. For base 21 with +2, typing 22 saves base 22 and displays 24 in purple. Removing the effect reveals base 22 in gold. With no manual edit, removing an adjustment restores the unchanged original score and normal color.
- Clearing the score removes the manual edit and restores its saved pre-edit base while keeping all active additions/penalties. New nullable `stats.<key>.resetValue` captures that base on the first edit and retains it across repeated edits/reloads. On clear, `manual` becomes false and `resetValue` clears; the visible score remains teal if an automatic adjustment is still present. For older manual edits made before reset history was recorded, the fallback is the system default 12; their earlier base cannot be reconstructed.
- A new boolean `stats.<key>.manual` records future deliberate sheet edits. Existing values load unchanged and are not retroactively guessed to be manual. Merely focusing, blurring or submitting another field does not mark/edit a stat. Display-only `statScores` inputs are removed from submission; only intentional edits update source stats. This prevents adjusted values from being baked into the base.
- Heavy movement costs 10 ft per square and 20 ft in difficult terrain. These costs are displayed separately from feet per AP. Automatic map/AP spending remains roadmap step 8.
- With heavy armor and STR below 21, the sheet reminds the player that attacks, Dodges and AGL saves have disadvantage. The AGL roll dialog also shows a reminder; select disadvantage manually. Attack/Dodge automation remains later work. STR 21 removes this reminder, not the AGL penalty or movement cost.
- Shield Block dice are displayed for future reaction rolls, without adding Block automation.
- Each equipped armor record represents one worn piece; a leg-guard record is a complete pair. Quantity does not multiply worn contributions. Separate arm-guard records use their highest single AR once, rather than double it. Their descriptive special effects remain separate for later ability handling. Other duplicate worn pieces contribute as entered and are flagged for manual review; equipping is not restricted. All equipped shields contribute as entered; hand limits are not enforced.

<a id="armor-calculations-existing-data-and-corrections"></a>
### Existing data and corrections

`bonuses.armor` and `bonuses.evasion` are preserved as extra additions to the new item totals. **Clear any old manually entered equipment totals after equipping the same items, or they will be counted twice.** The sheet labels these as extra corrections. Final `overrides.armorRating`, `overrides.evasion`, movement and reaction overrides still replace complete results as before.

New nullable `overrides.armorAgilityPenalty` allows correction of just the armor penalty; blank restores automatic, explicit zero disables it. `system.equipment` and stat `effective` values are prepared context, not saved fields. No existing fields are renamed/removed, no world migration or data rewrite runs, and current Health/AP/reactions/Wonder values are not reset on equip. Reaction maximum may change while a spent current value stays fixed, consistent with existing pool behavior.

<a id="armor-calculations-validation"></a>
### Validation

`node --test` includes full light/heavy sets, mixed armor, shield AR exclusion from the heavy penalty, armor AR thresholds/cap, STR 20/21, explicit zero correction, arm-guard AR, paired-record quantity behavior, unequipped gear and effective-AGL core numbers. Local checks using installed Foundry 14.365 data classes verify repeated preparation, original stat persistence, milestone restoration after unequipping, and strict character/item/dialog template compilation. Modified-stat tests cover focus/input/blur, no-change submission, the 21 + 2 → edit 22 → display 24 example, and manual provenance. Actual model/template checks cover the single-field layout, structured manual state and unchanged saved bases.

Codex has not checked this in a running world: item updates triggering re-preparation across clients, Active Effect interaction, linked/unlinked tokens, actual sheet layout and phone use still need live validation.

- [ ] Restart Foundry and refresh browsers. Confirm version 0.5.3. Clear old manual armor totals if those totals are now represented by equipped items.
- [ ] Equip a light chest (1 AR), arm guards/pants/leg guards (+1 NE each): expect armor AR 1 and light NE +3. Add a medium helmet: NE item bonus becomes zero; unequip it: +3 returns.
- [ ] Equip a heavy set totaling 6 AR and a plate shield (1 AR, 1d10 Block). At base AGL 21, expect effective AGL 18, +2 modifier, one automatic reaction, 14 NE, 15 ft/AP and total AR 7 plus the VIT contribution. The sole AGL field must show 18 in teal; focusing it shows base 21 for editing. Blurring without typing restores 18 without changing the stored score.
- [ ] Change armor AR from 3 through 7: penalty 0/1/2/3/3. Changing shield AR must not change the penalty. Set penalty override to 0 and clear it again. Check final core-number overrides still work.
- [ ] At STR 20, inspect the heavy disadvantage warnings and AGL dialog; at 21, warnings disappear. Movement costs remain 10/20 ft per square.
- [ ] Unequip/re-equip repeatedly, edit an owned item's AR/type, reload, and check from another client and an unlinked token. No penalty should accumulate or refill current pools. Test a temporary AGL effect too.
- [ ] Inspect duplicate worn pieces, separate arm-guard records, read-only sheets and narrow screens. Correct unusual/custom equipment totals with the existing correction fields.

Wait for the user's test before the inventory/capacity part.

<a id="armor-calculations-website-reference"></a>
### Website reference

Inspected the current website `js/app.js` score refresh/focus handlers and `css/sheet.css` `.score.geared`, `.manual` and `.ability-adjusted` styles before this presentation change. Reference: [website source](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), [palette/styles](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/css/sheet.css). Purple is the user's requested third state, added to distinguish manual-plus-automatic changes. Website files are not edited.

Reset check: base 21 +2 → edit to 22 → effective 24 (purple) → clear → base 21 +2 = 23 (teal). Verify the same with an armor penalty, explicit zero, repeated edits and reload.

<a id="inventory"></a>
## Inventory, consumables and Block dice

Third equipment part, version 0.6.1. Rules checked against Notion [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) and [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) on 2026-10-31.

<a id="inventory-rules"></a>
### Rules

- Capacity is 10 + STR modifier. The Backpack checkbox adds 6. `overrides.inventorySlots` replaces the total; blank restores automatic.
- Most items take 1 slot. Shields and Two-handed weapons take 2.
- Items per slot sets stacking. Ammunition and potions use 5. Slots used = ⌈carried quantity ÷ items per slot⌉ × slots per item.
- Worn armor and weapons or shields in hand take no slots. An equipped record covers one worn or held copy, so 3 equipped daggers on one record carry 2 in the inventory.
- Going over capacity shows the overage in red. Nothing is blocked, because Notion sets no penalty for it.
- Block dice: 1d4 plus one die every 5 levels (2d4 at 5th, 5d4 at 20th). An equipped shield sets the size of every die, and the largest equipped shield wins. The sheet shows the formula with the STR modifier. Block rolling is still roadmap step 5.

<a id="inventory-consumables-and-miscellaneous-items"></a>
### Consumables and miscellaneous items

- **Consumable** items have a kind (Potion, Ammunition or Other), optional healing dice and start at 5 per slot. **Use one** on the character sheet spends one and posts a chat card. Healing dice are rolled then, and the card's button applies the healing to the owner, stopping at full Health. Health already corrected above maximum is left alone. With none left, the sheet says so and spends nothing. Ported from the website's `UseConsumable` command.
- **Miscellaneous** items are carried gear with quantity, slots, stacking and cost. They can't be equipped.
- Old **Gear** items still load with no data model and count 1 slot per quantity. Recreate them as Miscellaneous to use stacking.
- The heavy-armor AGL penalty stays capped at 3, as Notion says. Stronger materials raise AR but not the penalty past 3.

<a id="inventory-data-changes"></a>
### Data changes

All additions have defaults, so existing actors and items load without a migration.

- Items: new `perSlot` (default 1). New shields start at 2 `slots`. **Shields created before 0.6.0 keep the 1 slot they were saved with; change them to 2 by hand.**
- Weapons: a new weapon with Two-handed checked starts at 2 slots. Toggling Two-handed moves slots between 1 and 2 only while the slot size still matches the old default, so a hand-edited slot size is kept. The sheet submits every field on each change, so the check compares against saved values (fixed in 0.6.1 after the user found the toggle did nothing).
- New item types `consumable` and `misc`. Neither has an `equipped` field.
- Actors: new `inventory.backpack` (default false) and `overrides.inventorySlots` (default blank).
- Legacy `gear` items have no data model. They count 1 slot per quantity.
- `system.carrying` and `system.block` are prepared values, not saved fields.

<a id="inventory-validation"></a>
### Validation

`node --test` covers capacity with positive/negative STR, backpack, override including zero, slot sizes, stacking boundaries, equipped extras, legacy gear, overage and Block dice across levels and shields. Both sheet templates were rendered with Foundry's own Handlebars build.

Not yet checked in a running world:

- [ ] Restart Foundry and refresh browsers. Confirm version 0.6.1.
- [ ] STR 18 (+3): expect 13 slots. Check Backpack: 19. Set override 0, then clear it.
- [ ] Add a shield: 2 slots, 0 once equipped. Make a weapon Two-handed: 2 slots; uncheck: 1. Set a weapon's slots to 3 by hand, toggle Two-handed: stays 3.
- [ ] Arrows, quantity 21, items per slot 5: 5 slots.
- [ ] Equip a dagger record with quantity 3: "2 slots for extras".
- [ ] Fill past capacity: the total turns red and shows the overage. Equipping still works.
- [ ] Add a consumable: 5 per slot, no Equipped box. Quantity 6: 2 slots. Healing dice 2d4+2, take some damage, Use one: quantity drops, card rolls, button heals and stops at max. Click again: disabled. At quantity 0: warning, nothing spent.
- [ ] Add a miscellaneous item: counts toward slots, no Equipped box.
- [ ] Level 1 with no shield: Block 1d4, "another Block die at level 5". Level 5 with a plate shield (1d10): 2d10. Unequip the shield: 2d4.
- [ ] Phone width: the inventory row wraps without horizontal scrolling.

<a id="catalog"></a>
## Equipment catalog

Last equipment part, version 0.7.0. Transcribed from Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) (edited 2026-10-31 21:55 UTC) and [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de) (edited 2026-10-31 06:15 UTC).

<a id="catalog-contents"></a>
### Contents

- 53 weapons in four folders: 26 one-handed melee, 12 two-handed melee, 10 ranged, 5 Paragon.
- 13 armor pieces: every filled cell of the Notion armor table. Light has no helmet and medium has no pants, so those don't exist.
- 4 shields: Wooden, Chain, Scale, Plate.

Each weapon's description holds the Notion text of its signature properties until they're automated in step 4. Classifications follow the contract in [EQUIPMENT.md](EQUIPMENT.md#equipment): Paragon weapons use `family: paragon` (Warbow and Arbalest also `ranged`), ordinary ranged weapons use `family: none` + `ranged`, and Chakram, Dagger, Javelin etc. stay melee with Thrown. Two-handed weapons and shields take 2 slots.

Every catalog entry now has distinct artwork: 63 fitting stock images and seven user-supplied illustrations. Existing automatic icons and matching placeholders update in the normal sheet/directory views without resetting catalog data; custom images are preserved. See [artwork sources and display scope](EQUIPMENT.md#equipment-art).

<a id="catalog-how-it-gets-into-foundry"></a>
### How it gets into Foundry

Compendium packs are LevelDB folders, which can't be built here without a build step. Instead the catalog lives as data in `module/catalog.mjs`, and Foundry builds the pack itself:

- On load, the active GM is asked once per catalog version to import it into a **world** compendium, "Worlds Beyond Catalog". Declining doesn't ask again for that version.
- **Configure Settings → Worlds Beyond → Import or refresh catalog** runs it any time. So does `game.worldsBeyond.importCatalog()`.
- Items use fixed ids, so a refresh updates them in place instead of duplicating. A refresh resets catalog items to the Notion values. Items you add to the pack yourself and copies already on characters are untouched.

To change the catalog: edit Notion, update the tables in `module/catalog.mjs`, bump `CATALOG_VERSION`. The GM gets the refresh prompt on the next load.

<a id="catalog-validation"></a>
### Validation

`node --test` checks table sizes, unique 16-character ids, every key against the item models, the EQUIPMENT.md classification examples, Notion's full-set armor totals and shield values.

Not yet checked in a running world:

- [ ] Restart Foundry, refresh browsers, open the world as GM. Confirm version 0.7.0 and accept the import prompt. The Compendium tab shows "Worlds Beyond Catalog" with six folders.
- [ ] Open a Greatsword, Katana, Crossbow, Warbow and Net from the pack: family, Ranged, properties, signatures, ranges, loading, slots and description match Notion.
- [ ] Drag a Plate Shield and a heavy armor set onto a character. Equip them: AR, AGL penalty and Block dice update. Inventory slots update when unequipped.
- [ ] Run Import or refresh catalog from Configure Settings: the notice says 0 added, 70 refreshed, and there are no duplicates.
- [ ] As a player, open the compendium and drag an item onto your own character.

<a id="equipment-art"></a>
## Equipment artwork

Version 0.17.1 assigns a unique image path to every one of the 70 catalog entries: **63 stock matches and 7 user-supplied illustrations**. Copies of the same item intentionally use the same artwork. Custom/non-catalog items and consumable categories keep their existing fallback behavior.

<a id="equipment-art-user-supplied-artwork"></a>
### User-supplied artwork

The user supplied these seven AI-created PNG illustrations on 2026-11-01. They are copied unchanged into `icons/`; no cropping, resizing or regeneration was applied.

| Item | Source filename → installed filename |
| --- | --- |
| Chakram | Ornate Golden Steel Chakram.png → chakram.png |
| Rapier | Ornate Golden-Hilted Rapier.png → rapier.png |
| Urumi | Ornate Ribbon Blade in Motion.png → urumi.png |
| Lance | Ornate Silver and Gold Fantasy Lance.png → lance.png |
| Blowgun | Ornate Blowgun and Crimson Darts.png → blowgun.png |
| Chain Shield | Weathered Viking Chainmail Shield.png → chain-shield.png |
| Scale Shield | de4fbd0c-8d26-4013-a7e8-19e57f08deef.png → scale-shield.png |

All seven former SVG placeholders remain available for compatibility with saved URLs. Matching named catalog items resolve those old placeholder paths to the new PNGs in the views below. There are no remaining artwork requests.

<a id="equipment-art-source-and-selection"></a>
### Source and selection

Stock images are bundled with the user's Foundry VTT 14.365 installation under `resources/app/public/icons/`. The system references `icons/...` URLs; it does not copy or redistribute the stock files. The current website equipment interface was consulted, and selected artwork was visually reviewed in local galleries rather than chosen only by filename.

Related weapons no longer share one automatic image: four crossbow variants, three bows, axes, hammers, swords, polearms and daggers each have distinct paths. Iron Fan and Kusarigama use the actual stock fan and chain-sickle; Katar uses a punch-dagger image. Armor varies by weight and location; arm guards use bracers. Some stock art is stylized rather than a literal historical illustration.

<a id="equipment-art-existing-items-and-custom-images"></a>
### Existing items and custom images

`itemIcon` resolves an empty/generic image, the exact former automatic default, or the matching old placeholder for the same named catalog item to its new artwork. A different saved image is preserved, including a user-selected stock image. Renamed/non-catalog items with explicit images are preserved. An intentional choice identical to that item's old automatic default or placeholder cannot be distinguished from the old default and receives the new display image.

Character inventory rows, item-editor previews, the native Items directory and Item compendium contents use the resolver. Native directory hooks change thumbnails only; they do not restyle Foundry's sidebar or update documents/index entries. The image-path field still represents the saved image. Other modules or native art popouts that read the saved `img` directly can show the original until the user explicitly changes it.

New catalog imports use the new image paths. `CATALOG_VERSION` stays unchanged so an art update does not trigger a catalog refresh that resets edited compendium rules. No refresh or item replacement is required for the normal inventory/directory views. No actor/item fields, IDs, quantities, rules or saved image paths are migrated, and custom art is not overwritten.

<a id="equipment-art-checks"></a>
### Checks

- `node --test` verifies all 70 paths are unique, exactly seven supplied PNGs, appropriate stock categories, old-default/placeholder recognition, custom stock/file preservation, renamed items and display-only world/compendium updates.
- Local checks verify every referenced asset exists, the 42 prior strict form/template cases and populated inventory rows still pass, and all 16 stat-setup contexts remain compatible.
- Selected stock assets were visually reviewed across the full catalog. The seven supplied illustrations fill the remaining gaps; their copied files are hash-verified against the originals.
- The PR records live Foundry checks and remaining limits. Restart Foundry and refresh player browsers; compare the native Items directory, compendium contents, inventory rows and editor previews. Confirm custom art remains chosen and gameplay values are unchanged. Native art popouts and third-party item browsers are outside this display pass.

<a id="equipment-art-optimized-artwork-and-offline-fonts"></a>
### Optimized artwork and offline fonts

Seven user-supplied illustrations now load as 512 px WebP (quality 88): 203,490 bytes combined, versus 11,038,289 bytes for the original PNGs, a 98.2% reduction in these thumbnail downloads. The original PNGs and SVG placeholders remain available for existing direct links. Exact former system PNG paths resolve to WebP in the system's image views even after an item is renamed; custom world art remains chosen. This reduces client downloads, not repository archive size, because compatibility originals are retained.

The theme's six font weights are bundled under `fonts/` with their OFL licenses. No Google Fonts runtime connection is required. The files are loaded by local `@font-face` rules; see [font provenance](../fonts/README.md).

Validation: all seven resized images were opened as a contact sheet and checked for retained framing/detail. Node tests cover old PNG/SVG references, renamed items and custom artwork preservation. Live Foundry thumbnails and refreshed-player font loading remain part of the desktop audit.

<a id="potion-durations"></a>
## Potion durations and item bonus hints

Consumable stat bonuses can now expire. The timer is configured on the consumable, while applied copies use Foundry v14's native Active Effect duration and expiry registry. No module or separate wall-clock timer is required. Existing untimed potions and already-applied bonuses retain manual End until edited; no migration runs.

<a id="potion-durations-use"></a>
### Use

- Add the consumable's bonuses, then expand **Bonus duration** and enter a whole count plus Rounds, Minutes or Hours. Blank or 0 lasts until manually ended. There is no universal potion duration imposed by the system.
- **Use** snapshots the bonus definitions and configured duration into its chat card, and pays the usual item/AP cost. **Apply benefits** begins the clock, applies the bonuses and any instant restoration, and groups the active copies in Status. Changing or deleting the original item afterward does not change this use.
- Rounds need a started encounter containing the drinker. A count of 3 expires at the start of the drinker's turn three rounds after application. It does not expire on whoever happened to be taking a turn when Apply was pressed. Round configuration is checked before Use spends anything and again on Apply. If the encounter ends before Apply, that card remains retryable with no partial restoration; start an encounter to apply its snapshotted round duration.
- Minutes/hours follow **Foundry world time**, including supported time advancement and any encounter time progression configured in Foundry. Waiting in real time does not move this clock. Use game-time advancement for out-of-combat timed potions. A GM must be connected for Foundry's native expiry persistence.
- Status shows the native remaining-time label and retains End for early removal. Expiry suppresses the copied bonuses and removes the active Status entry; base stats and stored expenditure stay unchanged. It does not undo instant healing, refund the potion/AP, or modify the item definition. Each use remains independent.

Inventory rows show enabled bonus definitions as compact signed hints, e.g. **+3 STR**, **+2 DEX** or **+1 AR**. Stowed gear still advertises its configured bonus; its equipped button and tooltip distinguish whether it is active. Disabled bonus sets are omitted. Custom maximum bonuses use the current resource name. Consumables also show their configured duration; the chat card shows the actual bonuses rather than a count of bonus sets. Restoration hints name their target, including Mana/Blood and percentage units. Longer hints remain available through the item tooltip/editor.

<a id="potion-durations-data-and-implementation"></a>
### Data and implementation

Consumables add `system.bonusDuration.value` (nullable integer, default null) and `units` (default rounds). Applied copies get native v14 `duration.value`, `duration.units`, `duration.expiry`, `duration.expired` and `start` data on Apply. These are the v14 fields, not the deprecated v13 duration aliases. Rounds use `turnStart` expiry associated with the drinker's combatant; time-based units expire on time advancement. Earlier chat cards without duration data remain untimed.

`CharacterActor.onUpdateEffectDurations` rerenders existing views so countdowns stay current, without writing data. Foundry's existing registry and active GM handle expiry persistence and native effect preparation. The system does not replace Foundry's global expiry policy or restyle its sidebar. Clearing a consumable duration affects future Use cards; editing an already-applied timer remains available through its native effect editor.

The current website `js/status.js` informed compact signed modifier labels and remaining-time presentation. Notion [Equipment Rules](https://app.notion.com/p/40ac72092efb81588f50ea19ac0ab5e4) remains the gear rules authority. User-configured potion timing implements the explicit request; no new potion/class rule or combat action is invented.

<a id="potion-durations-validation"></a>
### Validation

Portable tests cover legacy/cleared durations, whole counts, compact enabled bonuses and resource hints, card snapshots, Apply-time starts, per-use grouping, native expiry hiding, no-encounter preflight, an encounter ending before Apply and preservation of the existing paid-card rollback behavior. The character duration callback refreshes views without actor writes.

Offline checks use actual installed v14.365 duration fields plus the native combat/time duration methods and expiry registry, with document/calendar/network adapters. A 3-round timer counts 3→1→expired on the drinker's turn; another actor's turn cannot expire it. Minutes/hours remain active just before their exact game-clock deadline and expire at it. Strict owner/observer templates check values, escaping, hints, passive legacy behavior and read-only controls. Headless previews cover the editor, Equipment and Status at 760/390/340px with no horizontal overflow and at least 44px controls within the changed views.

Not tested in a running world: native document persistence, GM/player synchronization, effect re-preparation after expiry, clock controls, live dice/card interactions, unlinked tokens and live scrolling. After restarting Foundry and refreshing browsers, make a +3 STR potion with 3 rounds, Apply, advance the drinker's turns, and confirm the effective stat returns to base and Status disappears. Repeat with game-time minutes, End early, two independent uses and a deleted original item. Check stowed/equipped gear hints and older untimed cards. Offline checks and installation never access or alter saved world/actor data.

Ability duration/cooldown/recovery automation, form loadouts and final sheet validation are still later sheet work. Combat resolution, spell visuals and module installation remain deferred; notify the user before that transition.

## Body slots

The Equipment tab includes a body diagram with Head, Chest, Arm guards, Pants and Leg guards. Select a slot to choose an owned armor item or leave it empty. The catalog's arm and leg guard records represent each paired slot. Equipping another item for the same slot stows the previous record through the same native item update, including form presets and item-sheet edits. Mixed armor weights on different slots remain supported. Combat swaps use the existing AP cost once.
