# Command delivery verification

The user reported that a Command offer and Receive button appeared but Aldrich stayed at 17 AP. Command is intended to work outside combat too. A grant of 2 should display **19 / 17**, with **Includes 2 Command AP**; the normal maximum stays 17.

Owned-ally delivery now uses the validated recipient and computed amount directly after posting the paid offer. The active GM still receives cross-owner offers, and the recipient can retry from chat. Each grant verifies that its balance and receipt were retained before reporting the total. Invalid/missing metadata or cancelled delivery reports an error instead of silently returning. Older serialized numeric amounts are accepted. Mounted Receive buttons update after actual receipt, including grants applied by another client. Receipt checks retain the non-stacking/retry behavior; a previously received card cannot refill a spent grant.

These changes remove silent failure paths, but the specific native cause of the user's earlier failure has not been established. Read-only inspection of the running client's console showed no Command exception; DevTools blocked the diagnostic paste, and that protection was left in place. No characters were edited during inspection. The user must confirm delivery in the restarted client.

Tests cover direct owned delivery independent of chat flag readback, cross-owner acceptance, numeric serialization, invalid offers, ignored/cancelled updates, retry receipts and button refresh. Offline actual v14 model/template checks verify 17 own AP + 2 Command AP displays 19 while the maximum remains 17. Live socket delivery, permissions and linked/unlinked recipient selection remain user checks.

Restart Foundry and refresh clients. Make a new Command offer to Aldrich outside combat: the sender should spend 5 own AP, Aldrich should show 19/17 and a success notice should report the total. The card should say Command received. If delivery fails, use its new error text to diagnose it; don't repeatedly pay for new offers. Check the selected actor/token identity when testing unlinked tokens. Then test a player-owned ally and the grant on that ally's turn in combat.
