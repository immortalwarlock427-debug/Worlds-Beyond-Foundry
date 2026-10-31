# Equipment: item records and sheets

This first part of roadmap step 3 adds weapon, armor and shield Item types, ApplicationV2 item sheets and a character equipment list. Add items from the character sheet or drop them from Foundry's Items directory. Open an item's name to edit it, toggle Equipped, or Remove it after confirmation. Existing `gear` items retain their original data model and sheet and remain visible in the list.

## Sources and scope

Checked 2026-10-31 against Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) and [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de).

Weapon records store base/versatile damage, damage type, properties, signature properties, range and loading. Text fields accept custom rules. Armor records identify light/medium/heavy and the five worn pieces: chest, pants, arm guards, helmet and leg guards as a pair. Shield records store Armor Rating and Block die. All three store quantity, slots per item, cost, description, image and equipped state. Numeric corrections are unrestricted.

The equipped flag records what is worn/wielded. It does not yet change stats, defenses, movement, inventory capacity or rolls. Continue using the existing manual armor contributions. Property and signature automation belongs to the attack step; a full weapon catalog, equipment-derived defenses and inventory capacity remain subsequent equipment parts. Generic gear is preserved without attaching a new schema to it. No existing actor fields are renamed or removed.

When automating armor next, follow the current Notion details: the heaviest piece determines armor type, only light armor gives its light-piece Evasion bonuses, heavy movement costs 10 ft per square (20 ft difficult), and heavy armor's AGL reduction is capped at 3. Arm guards do not double their AR when worn on both arms. These effects are not approximated by this PR.

## Validation

`node --test` covers item creation on the correct actor, ownership, equip/unequip, summaries for all three types and legacy gear, and existing character/roll behavior. Local checks with the installed Foundry 14.365 fields verify defaults, zero/negative corrections, serialization/reload and all three strict Handlebars sheet branches including escaped user text. Foundry's ItemSheetV2 and native actor drop implementation were checked in the installed source.

Not tested in a running world by Codex: actual creation dialogs and registration, sheet rendering/scrolling, native drag/drop, owned-item editing and rerendering, removal confirmation, permissions across clients, or phone layout. Browser local-file preview remains blocked.

Before the next equipment part:

- [ ] Restart Foundry and refresh browsers. Confirm version 0.4.0 and that existing characters, Health, pools and rolls still work.
- [ ] Add a weapon on a character. Enter a name, damage, versatile damage, properties/signature, loading and range. Close/reopen and reload; confirm values persist.
- [ ] Add armor for each worn piece, including paired leg guards; enter AR/Evasion. Add a shield with Block die. Equip/unequip: the flag should update on the character and item sheet while existing manual core numbers remain unchanged.
- [ ] Create a world item through Items → Create Item; confirm readable type names and the appropriate sheet. Drop it onto a character and verify the owned copy can be edited independently.
- [ ] Confirm old gear is listed and opens its existing sheet. Remove an item: cancel must preserve it; confirming removes only the chosen owned item.
- [ ] Check an observer view and a phone-width sheet: fields and mutation buttons are disabled as appropriate, names remain readable, controls are reachable and descriptions display as plain text.

Wait for the user's validation before adding equipment calculations and the catalog.
