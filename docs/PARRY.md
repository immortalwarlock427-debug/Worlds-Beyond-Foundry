# Parry reaction

Version 0.13.1 added Parry and keeps long roll dialogs scrollable above visible action buttons. Version 0.18.0 also opens it from [linked attack cards](LINKED-DEFENSES.md); Health changes remain manual.

## Sources and rule choices

Read on 2026-11-01:

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d): reaction use, DEX 21 and held equipment, visible physical attacks, ally protection, natural 20 eligibility and Overwhelming Force.
- Notion [Dexterity](https://www.notion.so/351c72092efb8132b174eb48b029c4ab): once each round, d20 + DEX, strictly beat the attack to negate damage and non-magical effects.
- Website [defense controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js): the Parry action, readiness reminders, ally choice and use tracking informed this dialog. Foundry uses its existing readable check/Wonder cards.

Notion is the rules authority. Availability follows the combat's **round number**. The website currently describes refreshing at the start of the character's turn and also adds DEX-modifier uses per long rest outside combat; those details are absent from the fetched Notion Parry rules. This implementation uses once per combat round, with unspent practice rolls outside combat. No additional out-of-combat use limit was inferred.

## Behavior

- Click **Parry** below Block/Dodge under **Worn armor and corrections**. The roll uses the current prepared DEX modifier. Enter an attack total, or leave it blank for manual comparison. A tie fails. Incoming natural 20s can be parried; the defender's own natural 20 does not automatically win.
- DEX 21 and a held weapon or shield are requirements. The dialog warns when the effective score is too low or no weapon/shield is marked equipped. Requirements stay reminders for this trust-based sheet; players may correct equipment or account for another ability. Spending defaults off when either requirement is missing, while deliberate spending remains available.
- Select normal, advantage or disadvantage. Heavy armor alone does not impose Parry disadvantage under the fetched rules. The usual readable d20 + modifier card, kept-die explanation and Wonder control apply.
- **Spend 1 reaction** defaults on for an eligible character in a started combat when Parry is unused. It spends one current reaction and records this combat round's Parry use in the same actor update. No AP is spent. Another spent Parry in that round reports the used state. Changing turns does not renew it; the next round number does.
- When several started combats contain the actor, the viewed combat is preferred, then the first matching combat. Uses are tracked separately by combat. Linked actors share their use; unlinked token actors keep their own flags and reaction pool.
- When opening Parry after a spent use, the dialog offers **Reset Parry use** for a correction. It clears only the current combat's current-round use, closes the dialog, and rolls nothing. It does not refund a reaction. Reopen Parry to use it again; correct the reaction pool separately when needed. Unticking spending makes a practice roll and preserves both the reaction pool and round-use record.
- **Protect an ally** changes the card's label. The ally must be reachable with 1 AP of movement and the defender moves in front of the attack. Eligibility, visibility, distance and token movement remain manual. Linked cards track spent Parry use per incoming hand in addition to the round limit; standalone sheet rolls retain manual association.
- **Overwhelming Force** preserves a successful Parry's half-damage floor in the result explanation; non-magical effects are still negated. Otherwise a successful Parry negates the damage. Apply Health changes and any effect removal manually.
- Wonder retains the original target, ally choice, DEX modifier, dice mode, combat/round and private audience. It spends no additional reaction or Parry use. FTH 21 Defy Fate declares success but preserves Overwhelming Force's floor. A new Wonder result can use Wonder again as before; its parent result cannot.
- Dice/render failures spend nothing. Failed chat posting restores both the reaction and previous use record. Failed compensation reports that reactions and Parry use need manual correction. Public/GM/blind/self visibility is preserved; blind dice disable interaction.

## Data and validation

No actor/item schema fields were renamed, removed or added. New actor flag `flags.worlds-beyond.parryUses.<combatId>` stores the last spent round for each encounter. New Parry chat messages store defense context in the existing check flag for Wonder. Availability compares stored/current round values, so advancing a round needs no actor rewrite. The dialog reads availability when opened; a roll rechecks it in the shared local actor action queue.

Automated tests cover eligibility reminders, strict comparisons, manual/zero targets, Overwhelming Force, all dice/chat modes, round-versus-turn tracking, separate combats, reset without refund, failures and compensation, competing reaction spending, practice, permissions and Wonder/Defy Fate. Local smoke checks use Foundry 14.365's real data model and bundled Handlebars for editable/read-only controls, warnings, outcomes and ordinary Block/Dodge/check regressions.

Live Foundry verification reproduced the clipped action footer in 0.13.0, then confirmed 0.13.1 keeps Roll Parry visible while scrolling to the final instructions. No roll was submitted or resource changed during that layout check. The reset button, token movement, sockets and phone layout remain untested live. The local action queue does not coordinate separate clients. A Parry already being rolled keeps the round it started in if the tracker advances while dice are pending.

Test before merging:

1. Restart Foundry and refresh player browsers. Open Parry and check Roll Parry remains visible while the instructions scroll, including in a shorter window. At DEX 21, equip a weapon or shield and check the DEX modifier and spending default. Below DEX 21 or without held gear, check warnings and unspent practice defaults.
2. Enter an attack total; Parry must beat it, including when that attack rolled a natural 20. Try a tie, a blank target and normal/advantage/disadvantage.
3. In combat, spend one reaction. Confirm AP/Health/Wonder stay unchanged. A second spent Parry in that round should report it was used. Advancing only a turn keeps it used; advancing the round makes it available, provided reactions remain.
4. Open a used Parry dialog and select Reset Parry use. Confirm it rolls nothing and does not refund a reaction; reopen and check availability. Try practice rolls without spending.
5. Protect an ally and check its label. Use Overwhelming Force and verify successful results retain the half-damage reminder. Move tokens, change Health and remove effects manually.
6. Use Wonder on a failed Parry and check target/modifier/use records persist. At FTH 21, verify Defy Fate succeeds while Overwhelming Force still applies.
7. Check private chat modes with player/GM browsers, an unlinked token's own reaction/use state, narrow layouts, and existing Block/Dodge/turn-start refill behavior.
