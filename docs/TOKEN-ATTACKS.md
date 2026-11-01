# Token attacks and hand equipment

Version 0.19.0 adds the user's requested token-click attack shortcut and compatible equipped hand gear. It reuses weapon attacks and linked defenses; Health, token movement and damage application remain manual.

## Rules checked

Read 2026-11-01: Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48), [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) and [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73). Two Light weapons can fight together; Two-handed occupies both hands; Versatile can use either grip; Strapped occupies no hand. The user's explicit rule allows only one ordinary held weapon and permits a one-handed weapon plus a shield, including a non-Light weapon. The website's `equip`, `fits` and `attackWith` controls were consulted; Foundry retains its own dialogs and canvas.

Titan's Might audit: searched Game Systems for Titan/Might/push and fetched matching stat references. [Strength](https://www.notion.so/351c72092efb81bc9c1dc28707e48241) already says **15 ft**. Stats Explained only names the milestone; the other Titan search match is unrelated Titanium. No remaining 5 ft Titan's Might push wording was found, so no Notion edit was made. Foundry currently stores only its milestone name and does not automate the push. Weapon Hook and Reach keep their separate 5 ft rules.

## How to attack

1. In Foundry's normal token selection tool, select exactly one character token you own.
2. Click another visible token. It becomes your target and your attacker remains selected. With one equipped weapon, its normal attack dialog opens; with several, choose the equipped weapon first.
3. Confirm dice, grip, AP spending and other options, then Attack. The clicked target's exact actor/token identity and defenses are passed through even if another token was previously targeted. Normal attack/damage cards and Block/Dodge/Parry controls follow.

Alt-click, Shift-click and Ctrl/Meta-click keep normal selection behavior; click the already selected token normally, or clear selection, when selecting/moving rather than attacking. Target/ruler tools keep their original behavior. Multi-selection does not guess an attacker. Invisible targets, placement/ruler/drag workflows and unowned attackers do not open this shortcut. This does not grant permission to control, move or edit another player's token. A pending attack dialog suppresses duplicate clicks for that attacker.

No weapon equipped gives an instruction to equip one. Legacy invalid loadouts give an instruction to re-equip the intended weapon. Cancelling a chooser or attack dialog spends nothing. Attack-time checks catch weapons that were stowed/deleted or an incompatible two-hand grip before AP/shots are spent. Range, line of sight, ally/enemy intent and reach are still table decisions.

## Equipment behavior

- Two hand slots: a shield uses one; an ordinary weapon uses one; Two-handed uses both. Two held weapons must both be Light and one-handed. A non-Light one-handed weapon can still share with a shield.
- Strapped weapons do not consume a hand and can remain equipped alongside held gear, including a two-handed weapon. No additional Strapped count/forearm cap was invented. Strapped does not grant a combined two-weapon attack: that still needs a Light weapon in each hand.
- Equipping preserves the deliberately changed item first, keeps compatible gear and stows conflicts in the same Item update operation. For example, a Greatsword stows a sword/shield while keeping a Strapped crossbow; equipping a one-handed sword preserves a shield. A third Light weapon replaces one of the two already held. The user is told which items were stowed after a successful update.
- Item-sheet Equipped checkboxes and changes to Light/Two-handed/Strapped on equipped items use the same batch preflight. Armor, quantities, damage, artwork and unrelated fields remain intact. New embedded weapon/shield copies start stowed, including drops of already equipped source items; world-directory/compendium records are not changed by this rule.
- Existing actors are not rewritten when loading the world. Old invalid hand combinations stay saved until an intentional equipment edit; attacks require correcting them. Armor remains independently equippable. Inventory and defenses recompute from the resulting equipped gear as before.
- Versatile weapons are equipped as one-handed. Choosing two hands for an attack requires that second hand to be free. Stow the shield/other held weapon first; Strapped remains compatible. Weapon swaps keep their existing free/manual AP handling; Minor action/Quickdraw swap AP costs are not added here.

No actor/item schema fields were renamed, removed or added. Compatibility uses existing equipment flags/properties; there is no migration or automatic world-data cleanup. Batched updates are one client request, not a cross-client locking system.

## Validation

Automated tests cover ordinary/Light/Strapped/shield/two-hand combinations, deterministic conflict stowing, item-operation cancellation/creation and property changes, unchanged unrelated data, stale weapons, explicit target selection, equipped-only choosers, cancellation, ownership, token permission boundaries, modifier clicks and duplicate dialogs. Existing attacks, defenses, rolls and model tests run with `node --test`.

The PR records real Foundry checks and limits. Before merging, test one-handed + shield, two Light weapons, Strapped + held gear and a two-handed swap using both the inventory and item editor. Select an owned token, click an enemy/player token, and confirm the attack names that target. Check Alt-click selection, a cancelled attack, multi-selection, unlinked tokens, player permissions and phone layout. Apply damage/Health manually.
