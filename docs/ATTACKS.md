# Weapon attacks and damage

Roadmap step 4, first part, version 0.8.0. Rules checked against Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48), [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) and [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73) on 2026-10-31, and the website's `combat-core.js` (`attackApCost`, `attackHits`, `criticalTotal`).

## Flow

1. **Attack** appears on equipped weapons. The dialog offers only the choices the weapon allows: melee or thrown, STR or DEX (with each option's AP cost), one- or two-handed grip for Versatile, long range, and Mounted with feet charged for Mount weapons.
2. The attack card shows d20 + modifier, and Hit/Miss against the **targeted token's** Natural Evasion. With no target, it shows the total to compare by hand.
3. **Roll damage** rolls on the card. A crit shows **Roll critical damage**. A natural 18–19 with Finesse/Paragon and no target shows both buttons. Each attack can roll damage once.

## Rules applied

- Stats: Balanced STR or DEX. Heavy STR. Finesse DEX. Paragon STR or DEX, melee or ranged. Ordinary ranged and every thrown attack DEX.
- AP: 10 − the attack modifier, never below 5 (a negative modifier raises it, matching the website). Spend AP is on by default. With too little AP the attack is refused and nothing is spent; untick Spend AP to roll anyway.
- Automatic disadvantage: Heavy without 21 STR, Finesse without 21 DEX, Paragon without both, Mount while not mounted, past normal range, heavy armor without 21 STR. The dialog pre-selects disadvantage and lists the reasons. The player can still change the dice, and the card says if a listed disadvantage wasn't used.
- Hit: total meets or beats Natural Evasion. A natural 20 always hits and crits. Finesse and Paragon also crit on a natural 18 or 19 that hits.
- Damage: the listed dice are rolled 1×/2×/3×/4×/5× at levels 1/5/10/15/20, with the modifier added once. Heavy and Paragon add double. Versatile in two hands uses the bracket damage and counts as Two-handed. Mount adds +1 per 10 ft charged, up to the attack modifier.
- Critical: maximum of the scaled dice + modifier, plus the dice rolled again (Notion: 2d10 + 6 → 26 + 2d10).
- Armor: with a target, the card shows how much of its Armor Rating counts. Two-handed hits ignore half, rounded down. Puncture ignores 2 more after halving. Overwhelming Force (STR 28) keeps damage at half or more. Dodge, Parry, Block and Resistance are step 5, so the card doesn't apply damage.
- Signature properties print their Notion text on the damage card as reminders.

## Not yet

- Attacking with both Light weapons (off-hand half damage, no modifier). Use two single attacks for now.
- Loading and reload tracking, ammunition use.
- Fast Roll. Foundry rolls every die anyway.
- Unarmed attacks.
- The Mounted checkbox doesn't change the pre-selected disadvantage. Switch to Normal when charging mounted.

## Validation

`node --test` (89) covers stat choices, modes, AP costs, every disadvantage reason, crit thresholds and outcomes, the scaling table, double modifiers, versatile grips, Notion's crit example, Mount caps and Armor Rating halving/Puncture, using the real catalog items. The dialog and sheet templates were rendered with Foundry's Handlebars build.

Not yet checked in a running world:

- [ ] Equip a Longsword. Attack: STR/DEX choice with AP costs, Grip choice. AP drops by the cost.
- [ ] Target a token and attack: Hit/Miss against its Natural Evasion. Roll damage: one card, the button disables afterward.
- [ ] Greatsword at STR 20: disadvantage pre-selected with the reason. At level 5: 4d6 + 2× STR mod.
- [ ] Rapier: a natural 18–19 that hits is a crit. Critical damage formula shows max + dice.
- [ ] Handaxe: Thrown option rolls with DEX. Longbow: long-range checkbox adds a reason.
- [ ] Untick Spend AP with 0 AP: still rolls. Ticked: refused with a message.
- [ ] Player client: only the owner sees the damage buttons.
