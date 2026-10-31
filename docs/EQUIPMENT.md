# Equipment: item records and sheets

This first part of roadmap step 3 adds weapon, armor and shield Item types, ApplicationV2 item sheets and a character equipment list. Add items from the character sheet or drop them from Foundry's Items directory. Open an item's name to edit it, toggle Equipped, or Remove it after confirmation. Existing `gear` items retain their original data model and sheet and remain visible in the list.

## Sources and scope

Checked 2026-10-31 against Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) and [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de).

Each type has its own registered model: `WeaponData`, `ArmorData` and `ShieldData`. Their common base contains description, quantity, slots, cost and equipped state; name/image are native Item fields. Only weapons have weapon fields; only armor has armor type, worn piece, Armor Rating and Evasion; only shields have Armor Rating and Block die. Existing `gear` has no new model attached.

Weapon data uses these stable keys for later attack automation:

- `family`: one of `balanced` (default, melee only), `heavy`, `finesse`, `paragon`, or `none` (standard ranged weapon with no special family). These are mutually exclusive choices, not duplicate property flags.
- `ranged`: independent boolean, default false. Set it explicitly for ranged weapons, including ranged Paragon weapons. Never infer it from family, numeric range, weapon name or the Thrown flag.
- `properties`: boolean keys `light`, `twoHanded`, `versatile`, `strapped`, `reach`, `mount`, `thrown`.
- `signature`: boolean keys `sweep`, `hook`, `stagger`, `disarm`, `entangle`, `puncture`, `sunder`, `bleed`, `pierceThrough`, `bulwark`, `quickdraw`, `concealed`, `silent`, `loud`.
- `range.normal` and `range.long`: numbers in feet, default 0. `loading`: numeric shots before reloading, default 0 for none. Range and Loading are represented by these numeric fields rather than redundant flags.
- `damage`, `versatileDamage` and `damageType` remain text. Description accepts custom rules text. Properties/signatures are checkboxes and the family is a dropdown. Flags default to false and are saved explicitly, including when unchecked.

### Weapon rule contract for step 4

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

The first item-record part was tested and merged. Equipped armor/shields now contribute to defenses and effective AGL: see [armor calculations](ARMOR-CALCULATIONS.md). Inventory capacity and weapon attack automation remain later steps. Property and signature automation belongs to the attack step; a full weapon catalog, equipment-derived defenses and inventory capacity remain subsequent equipment parts. Generic gear is preserved without attaching a new schema to it. No existing actor fields are renamed or removed.

When automating armor next, follow the current Notion details: the heaviest piece determines armor type, only light armor gives its light-piece Evasion bonuses, heavy movement costs 10 ft per square (20 ft difficult), and heavy armor's AGL reduction is capped at 3. Arm guards do not double their AR when worn on both arms. These effects are not approximated by this PR.

## Validation

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
