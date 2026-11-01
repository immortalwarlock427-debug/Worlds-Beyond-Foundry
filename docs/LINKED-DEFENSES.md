# Defend from weapon attack cards

Version 0.18.0 connects existing Block, Dodge and Parry dialogs to incoming weapon attacks. Health, damage mitigation and token movement remain manual.

## Sources

Checked 2026-11-01: Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d), last edited 2026-10-31. A defense kind can be used once against an attack, while another defense may follow a failed Dodge. Natural 20 attacks cannot be Dodged but can be Blocked or Parried. Parry remains once per round, and Overwhelming Force preserves its half-damage floor. Existing [Block](BLOCK.md), [Dodge](DODGE.md) and [Parry](PARRY.md) comparisons, spending and corrections are reused.

The current website's `js/app.js` incoming-attack and `useDefense` controls were consulted. Foundry keeps its compact navy/brass buttons and collapsible help. The previously documented website/Notion difference in Parry refresh timing remains unchanged: Notion's once-per-round rule is used.

## Behavior

- Visible hit or manually compared weapon-attack cards offer **Block · Dodge · Parry** below each hand. Known misses do not. Damage buttons still belong to the attacker; defense buttons belong to anyone with an owned character available. Opening or cancelling spends nothing.
- When multiple owned characters are available, choose the defender first. The attack's exact target actor, including its synthetic token actor, comes first, followed by controlled tokens, assigned character and owned world characters. Distinct unlinked tokens remain distinct choices. Dodge protects the original target; use Block/Parry for an ally or the sheet for a targeting correction.
- The existing dialog shows the incoming weapon/target and prepopulates the total. Natural 20 status prepopulates Dodge and disables its card shortcut; expanded Finesse/Paragon crits on 18–19 do not disable Dodge. Parry prepopulates Overwhelming Force and ally protection; Block preselects ally protection when appropriate. These form values stay editable for corrections. Equipment, shield/ally reach and physical visibility remain reminders.
- New attacks snapshot both hands' totals/natural dice, the attacker's STR 28 status and target actor/token UUIDs. Later stat, selection or equipment changes do not change those incoming facts. Older cards can use their saved evaluated rolls; without target/STR snapshots those details stay manual. Cards without usable totals/d20s retain sheet-based manual defenses.
- Spending marks that defense kind against the particular message and hand on the defender. The other hand, another character and another defense kind have separate use state. Unspent practice rolls do not create or clear marks. Refilling reactions, advancing combat or deleting a defense-result message does not unlock the same incoming attack.
- Reopening a used linked defense defaults to practice and offers **Reset linked [defense] use**. Reset clears only that mark, rolls nothing and refunds nothing. Parry's separate once-per-round mark retains its existing reset. Correcting both limits can require both resets; correct reactions separately if needed.
- Results show their incoming weapon/attacker/target and store the source message/hand. Dodge/Parry Wonder rerolls retain this context and the audience, spend no additional reaction and do not create another linked use. Defy Fate retains existing defense outcomes.
- Linked replies inherit public/GM/blind/self visibility from the incoming attack, even if the current roll mode has changed. A non-blind whisper's original author is retained as a recipient when necessary. Blind replies keep blind status and non-interactive dice. Invisible/deleted source attacks cannot start a linked spend. Standalone sheet defenses still use the current chat mode and manual comparison.
- Dice/render failures spend nothing; failed use marking or chat posting compensates reactions and linked/Parry marks. Failed compensation reports manual correction. Existing local queues serialize actions for one actor on one client; simultaneous actions on separate clients are not coordinated.

## Data scope

No actor/item data model changes or migrations. New actor flag `flags.worlds-beyond.defenseUses.<messageId>_<handIndex>.<kind>` records spent linked uses. New message fields are additive. Saved worlds, actor values, item data and old messages are not rewritten on load. Flags persist like Wonder history; no automatic pruning or deletion is introduced.

This step does not associate separate damage-result cards, automatically deduct Health, enforce an ordered defense chain, decide whether a prior Dodge/Parry succeeded before allowing another defense, or automate distance/effect eligibility. Players resolve those decisions, Resistance, Armor Rating, Block and Overwhelming Force in the existing rule order. Sheet-based manual defenses remain available for external rolls, area saves and corrections.

## Validation

`node --test` covers new attack snapshots, separate hands, natural 20 versus expanded crit, zero/legacy/missing rolls, defender selection and cancellation, unlinked identity, owner filtering, duplicate spending/races, resets, compensation, private audiences, Wonder and non-attacker controls. Real Foundry schema and strict Handlebars smoke checks cover unchanged standalone forms and linked variants. The PR records live checks and limits.

Before merging:

1. Restart Foundry and refresh player browsers. Make a targeted weapon attack and use its defense buttons from the defender's account. Confirm the correct character/token and total. Cancel and confirm resources stay unchanged.
2. Try a natural 20 (Dodge unavailable), an expanded 18–19 critical (Dodge available), a miss and a two-weapon attack with independent defense controls.
3. Spend Dodge, then Block against the same hand. Retry that Dodge and confirm it is used; reopen/reset for a correction without a refund. Check practice rolls and that the other hand/another defender remain independent.
4. Parry with STR 28 on the attacker; check the force flag and half-damage reminder. Check the separate round-use reset, shield/ally protection reminders and manual movement/Health handling.
5. Use Wonder and check source context, target and privacy persist with no second reaction. Try public/GM/blind/self modes, GM/player accounts, an unlinked target and a narrow window. Cross-client races, real transport failures and player/phone layouts require in-world testing.
