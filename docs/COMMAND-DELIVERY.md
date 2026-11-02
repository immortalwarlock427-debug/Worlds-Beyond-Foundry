# Command recipients and AP

**Character → Command** now lists sidebar characters first, labeled **Aldrich · Character**. Unlinked encounter actors remain separately selectable as **Aldrich · Token copy · Scene · token ID**. Linked combatants do not duplicate their sidebar actor. Selection carries the exact recipient UUID; the card, success notice and Receive tooltip identify which character/copy receives the offer.

Previously, encounter actors came first and every option showed only the name. That allowed a Command meant for the sidebar sheet to reach a separate same-name token copy. Foundry's ActorDelta can preserve the token's separate Command balance while continuing to inherit ordinary AP changes from the sidebar actor. This reproduces the user's screenshots: the token reports 17 + 5 = 22 while the sidebar shows 17; after spending 6 ordinary AP on the sidebar, the token reports 11 + 5 = 16 while the sidebar shows 11. Offline native v14.365 ActorDelta merge checks reproduce this behavior. The user's exact live token data was not inspected or changed.

## Amount and spending

Notion's [Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c) specifies a fixed 5-own-AP cost and a grant of 2 + CHA modifier, capped at 5. With +0 CHA, the new offer is **2**. Repeated grants keep the highest remaining amount instead of adding. If a recipient already has 5, the notice now says **offered 2 Command AP; kept existing 5**, distinguishing the new offer from that older balance. There is no new 5-AP grant from +0 CHA.

For the chosen character at 17 ordinary AP, a fresh 2-AP grant displays **19 / 17**, with **Includes 2 Command AP**. A 6-AP ability payment uses 2 Command + 4 ordinary AP, leaving **13 / 17**. The normal maximum stays 17. Outside combat the grant is usable immediately; during combat it is usable on the recipient's own turn. The website's AP payment code was rechecked for spending the separate grant first; no payment formula changed here.

Owned-recipient delivery verifies the saved balance and receipt. The active GM handles cross-owner delivery; the recipient can retry from chat. Invalid/cancelled offers report errors, and Receive buttons update only after actual receipt. Previously received cards do not refill spent grants. Old cards retain their original recipient; this update never transfers old grants or rewrites saved balances.

## Validation and user check

`node --test`: **342 passed**. New regressions cover same-name sidebar/token choices with an existing 5-point token grant, exact UUID selection, +0 CHA offering 2, explicit token selection, linked-actor deduplication, retained-higher notices and spending 2 Command before 4 ordinary AP outside combat/on the recipient's turn.

Offline actual v14.365 schemas, native ActorDelta merge and strict templates reproduce the mismatch, then verify 19/17 → 13/17 on the chosen sidebar character while the token remains independent. Document updates/network use adapters. Isolated browser checks at 760/390/340 px confirm the sidebar option is selected by default, token labels differ, and the 44 px picker has no horizontal overflow. No live actor data was modified.

Not yet confirmed in the running world: the corrected picker, socket delivery, cross-owner permissions and live spending. Restart Foundry and refresh player browsers. Make a new offer and select **Aldrich · Character** for the Actors sidebar sheet. Confirm the card names Character, the notice says received 2, the sheet shows 19/17, and a 6-AP ability leaves 13/17. If testing the map copy instead, select its Token copy entry and open that exact token's sheet. An older 5-point grant remains until spent, expired or manually corrected using the existing controls; it is not erased on load.
