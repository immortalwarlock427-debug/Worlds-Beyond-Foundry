# Block reaction

This is the first defense interaction in roadmap step 5. The user confirmed start-of-turn refills work before authorizing it.

## Sources

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d), read 2026-11-01: Block dice + STR, shield dice, equipment requirements, reaction cost, ally protection, damage order and Overwhelming Force.
- The website's current [Block controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), read 2026-11-01, informed the Block action and equipment reminders. Notion remains the rules authority. Foundry uses its own dialog/chat APIs and keeps manual corrections available.

## Behavior

- Click **Block** under **Worn armor and corrections**. The default formula uses the existing Foundry-free `blockDice` calculation and the character's prepared STR modifier, including automatic effects.
- Base dice are 1d4, adding one die at levels 5/10/15/20. The largest equipped shield's Block die replaces d4 for every die. Without a shield the roll uses d4; arm guards or a held weapon still allow Block.
- The formula is editable. `@mod` is the current STR modifier. Rare-metal multipliers and other special adjustments are manual; for example `(2d8 * 2) + @mod` multiplies the dice before adding STR. Fast Roll is also manual: replace two dice with `(1d8 * 2) + @mod` when applicable.
- **Spend 1 reaction** defaults on when this actor is in a started combat, including an unlinked token's own actor. Otherwise it defaults off. Checked spending requires one available reaction; players can correct the pool or untick it to roll without spending. Block spends no AP.
- The chat card contains a native Foundry roll and whether a reaction was spent. It respects public, GM, blind and self visibility. Blind rolls disable interactive dice.
- Dice and rendering failures do not spend reactions. A failed chat post refunds a spent reaction. A failed refund explicitly asks for manual correction. Actions share the existing local actor queue with attacks, reloads and consumables.
- Equipment eligibility and ally distance remain reminders. Version 0.18.0 adds [linked weapon attack cards](LINKED-DEFENSES.md), including spent Block use per incoming hand; standalone sheet rolls retain manual association. Apply Resistance first, then Armor Rating, then subtract Block from the remaining damage and change Health manually. Fully blocking the remainder also stops effects that require cutting into the defender. Account for Overwhelming Force's half-damage floor when applicable.
- No actor/item schema fields changed. Chat messages record the actor, reaction kind and spending choice in a system flag; linked messages also retain incoming context. Linked spending uses the additive actor flag documented above.

## Validation

Automated adapter tests cover default dice and prepared STR, dialog defaults/cancellation, all four chat modes, blind interaction, optional spending, invalid formulas, failures and refunds, final-reaction double clicks, unchanged Health/AP/Wonder and owner permissions. Existing pure Block tests cover level scaling and equipped shield selection.

Templates were compiled locally with Foundry's bundled Handlebars. Foundry was not used to open a live sheet, roll dice, exercise sockets across clients or inspect phone layout. Local queues do not coordinate simultaneous actions from separate clients.

Test the installed branch before merging:

1. Restart Foundry and refresh player browsers. Open a character and find **Block** below the armor corrections.
2. At level 1 without a shield, check `1d4 + @mod`; equip a shield and check its die replaces d4. At level 5 check two dice. Change STR and confirm the new modifier appears in the result.
3. Cancel the dialog and confirm no roll or resource change. Outside combat, roll with spending unticked; reactions should stay unchanged. In combat, spending should default on and consume exactly one reaction, leaving AP/Health/Wonder unchanged.
4. With zero reactions, checked spending should report the empty pool. Correct the pool or untick spending to roll. Check an edited formula, including a negative STR modifier if appropriate.
5. Try public, GM, blind and self modes from a player and GM browser. Confirm only the intended audience sees the result. Check a narrow sheet and dialog.
6. Apply blocked damage manually, then advance the turn and verify reactions refill as before. For unlinked tokens, verify the token actor's own reaction pool changes.
