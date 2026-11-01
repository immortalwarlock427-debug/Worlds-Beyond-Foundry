# Review of the inventory, catalog and attack additions

Reviewed merged main through PR #13 (`c3804fe`) on 2026-11-01. Claude added inventory/consumables, catalog import, single/dual weapon attacks, loading/reload and live disadvantage controls. The baseline suite had 94 passing tests. Review included the new models, preparation/registration, catalog import, rule helpers and attack/consumable action handlers. This was a source/test review, not a running-world or exhaustive security audit.

## Findings fixed in 0.9.2

1. Attack/reload/consumable handlers called ChatMessage.create without `messageMode`, so the selected GM/blind/self mode was not applied. They now capture the selected mode before asynchronous work and pass Foundry v14's creation option. Blind rolls disable interactive evaluation. Damage replies continue to copy the source audience instead of using today's chat setting. Hidden damage/healing content exposes no controls and cannot be acted on through these handlers.
2. Damage and consumable-healing cards marked themselves used before successful dice/Health updates, without recovery. Damage now prepares the roll and content before marking the card, and restores its previous flag if posting fails. Healing restores eligibility if its Health update fails. Flag snapshots are cloned to survive in-place document updates.
3. AP, shots or consumable quantity could remain spent after a failed chat post or intervening update. Successful resource changes now register compensating updates, run in reverse on failure. A cancelled update stops the action. If recovery also fails, an explicit warning asks for manual correction instead of reporting a successful refund.
4. Paragon stat choice took precedence over Thrown, offering STR for a custom thrown Paragon weapon. The user's clarified rule and Notion's Thrown rule require DEX for thrown attacks. Thrown now takes precedence; ranged Paragon still offers STR or DEX.

Local queues serialize attacks/reloads/consumable actions by actor and damage by source message, preventing rapid local clicks from spending the same resources twice or posting duplicate damage. These are not server transactions: concurrent actions from separate clients, manual edits during recovery and disconnects can still require correction. Wonder retains its existing separate queue. No schema migration, catalog refresh, new gameplay restriction or existing field change is introduced.

## Validation and next work

Tests now exercise the action handlers: all four visibility modes, blind evaluation, source-audience damage replies, attack/reload/item refunds, cancelled spending, damage roll/render/post failures, healing retry, rapid duplicate clicks, insufficient AP after a queued action and failed recovery. The original rule/catalog/inventory tests remain in place. API options were verified in the installed Foundry 14.365 ChatMessage source.

Not tested by Codex in a running world: actual private/blind rendering, GM/player permissions, native dice interactions, chat rerender during recovery, cross-client updates and combat tracker behavior.

Before adding combat flow, test:

- [ ] Restart Foundry and refresh browsers; confirm version 0.9.2.
- [ ] Attack, reload and use a healing consumable with public/GM/blind/self chat modes from GM/player clients. Confirm audience and hidden totals/actions. Follow-up damage keeps its source audience after changing the chat setting.
- [ ] Verify ordinary attacks still spend AP/shots exactly once; two-Light-weapon attacks retain one AP cost and separate damage buttons.
- [ ] Use a consumable and apply healing once. Confirm quantity and Health changes are correct and the second click does nothing.
- [ ] Try repeated fast damage/action clicks. Reload and confirm used flags and resources remain correct.

The user merged and approved these review fixes. Start-of-turn AP/reaction refill is now implemented in [TURN-REFILLS.md](TURN-REFILLS.md), awaiting testing before reaction actions and Command. Drinking-potion AP integration also remains future combat-flow work; this review preserves the current consumable gameplay costs.
