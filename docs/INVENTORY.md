# Inventory, consumables and Block dice

Third equipment part, version 0.6.1. Rules checked against Notion [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) and [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) on 2026-10-31.

## Rules

- Capacity is 10 + STR modifier. The Backpack checkbox adds 6. `overrides.inventorySlots` replaces the total; blank restores automatic.
- Most items take 1 slot. Shields and Two-handed weapons take 2.
- Items per slot sets stacking. Ammunition and potions use 5. Slots used = ⌈carried quantity ÷ items per slot⌉ × slots per item.
- Worn armor and weapons or shields in hand take no slots. An equipped record covers one worn or held copy, so 3 equipped daggers on one record carry 2 in the inventory.
- Going over capacity shows the overage in red. Nothing is blocked, because Notion sets no penalty for it.
- Block dice: 1d4 plus one die every 5 levels (2d4 at 5th, 5d4 at 20th). An equipped shield sets the size of every die, and the largest equipped shield wins. The sheet shows the formula with the STR modifier. Block rolling is still roadmap step 5.

## Consumables and miscellaneous items

- **Consumable** items have a kind (Potion, Ammunition or Other), optional healing dice and start at 5 per slot. **Use one** on the character sheet spends one and posts a chat card. Healing dice are rolled then, and the card's button applies the healing to the owner, stopping at full Health. Health already corrected above maximum is left alone. With none left, the sheet says so and spends nothing. Ported from the website's `UseConsumable` command.
- **Miscellaneous** items are carried gear with quantity, slots, stacking and cost. They can't be equipped.
- Old **Gear** items still load with no data model and count 1 slot per quantity. Recreate them as Miscellaneous to use stacking.
- The heavy-armor AGL penalty stays capped at 3, as Notion says. Stronger materials raise AR but not the penalty past 3.

## Data changes

All additions have defaults, so existing actors and items load without a migration.

- Items: new `perSlot` (default 1). New shields start at 2 `slots`. **Shields created before 0.6.0 keep the 1 slot they were saved with; change them to 2 by hand.**
- Weapons: a new weapon with Two-handed checked starts at 2 slots. Toggling Two-handed moves slots between 1 and 2 only while the slot size still matches the old default, so a hand-edited slot size is kept. The sheet submits every field on each change, so the check compares against saved values (fixed in 0.6.1 after the user found the toggle did nothing).
- New item types `consumable` and `misc`. Neither has an `equipped` field.
- Actors: new `inventory.backpack` (default false) and `overrides.inventorySlots` (default blank).
- Legacy `gear` items have no data model. They count 1 slot per quantity.
- `system.carrying` and `system.block` are prepared values, not saved fields.

## Validation

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
