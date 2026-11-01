# Start-of-turn resources

First small part of roadmap step 5, version 0.10.1. Checked on 2026-11-01 against Notion [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73) and [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d). AP is available each turn, and reactions explicitly return at the start of your turn. The website's `js/encounter-actions.js` `startTurn` also restores the current actor's AP; Foundry supplies the encounter lifecycle here.

## Behavior

- Starting combat refills the first character's AP and reactions. Advancing to another character, wrapping a round or advancing a one-character encounter refills the incoming character to its current prepared maxima, including manual maxima and effective-AGL reaction milestones.
- Already-full pools are left alone, without a write or warning. If a refill is needed, only `system.ap.value` and `system.reactions.value` are updated, together. Written refill values are numbers captured at that time. An already-full pool retains its existing stored value (including the full-pool `null` sentinel). Health, Wonder, mana/custom pools, loaded shots, quantities, overrides and stats are untouched.
- The handler uses native `combatTurnChange`, which the installed Foundry 14.365 source emits after the active GM finishes turn-start effects. Only `game.user.isActiveGM` writes the update, preventing each connected client from refilling separately. One GM must be connected for automatic refills; otherwise correct pools manually.
- A round/turn must move forward, and the event's combatant/round/turn must still match the current combat. Setup, ordinary page load, initiative-only edits/reordering, rewind and ended combat do not refill. If turns/rounds are jumped over, only the final current actor refills. A rewind itself does nothing; advancing forward again is a new turn start and refills again. The tracker remains editable.
- Native `combat.combatant.actor` resolves linked and unlinked token actors. The handler updates that actor directly, so an unlinked token does not refill its world actor or other tokens. Multiple combatants sharing a linked actor share that actor's resources as Foundry normally does.
- Refills share the actor action queue used for attacks/reloads/consumables. Concurrent duplicate start events on one client coalesce; queued work rechecks the turn and skips stale work if the tracker has already moved on. Current maxima are read when the update runs. This is not a server transaction with manual edits or other clients.
- Foundry can return no updated document when a diff is empty. That is accepted when the requested AP/reaction values are already satisfied; it is not automatically treated as cancellation.
- Failed or cancelled updates show a GM-facing error asking for manual correction. No success message or false refill is reported, and the native turn lifecycle is not rejected by the handler.

No data fields, Combat subclasses, UI layout, catalog contents, automatic damage or restrictions are added. Reaction spending/Block/Dodge/Parry, opportunity attacks, Command, potion AP costs and free Surge movement remain later parts of combat flow/movement. This refill does not add Surge's movement-only AP to the normal AP pool.

## Validation

`node --test` covers first turn, next turn, round wrap, a one-character encounter, current/zero maxima, active-GM gating, setup/rewind/reorder/stale events, unlinked actor resolution, duplicate concurrent events, action-queue ordering, stale queued work and failed/cancelled updates, repeated already-full rounds, empty update responses and a single depleted pool. The source of Foundry 14.365 `Combat#_manageTurnEvents` and `#_onStartTurn` was inspected to verify that the GM hook follows effect refresh.

Not tested by Codex in a running world: actual combat tracker event dispatch and timing, expiring Active Effects, cross-client propagation, GM reconnection, and native linked/unlinked token synchronization. Adapter tests use simulated events/documents and do not prove those live behaviors.

## In-world checklist

- [ ] Restart Foundry and refresh browsers; confirm version 0.10.1. Have one GM connected.
- [ ] Put two characters with spent AP/reactions in combat, plus a depleted Health/Wonder pool. Start combat: only the first character's AP/reactions refill. Advance: only the incoming character refills. Health/Wonder stay spent.
- [ ] Advance through a round and a one-character encounter. Check level-based AP, AGL 21/28 reaction maxima and overrides including zero. Spent current values should match the maximum at turn start.
- [ ] Rewind, edit initiative, switch viewed combat, and refresh the browser: no extra refill. Advancing forward starts a turn and refills again. A multi-round jump refills only the final current actor.
- [ ] Check an unlinked token: its pools refill while its base world actor and another token keep their current values. Repeat with linked tokens.
- [ ] Connect another GM and a player. Each turn must cause one refill, with updates visible to owners. Spend AP immediately after the turn change: it must remain spent.
- [ ] Test a temporary effect affecting a resource maximum that expires at turn start; the refill should use the resulting maximum. Test manual corrections after the refill.

Wait for this turn-start behavior to be tested before adding reaction actions or Command.

When testing, open the sheet belonging to the actor in the tracker. A different actor (for example Orion open while aldrich takes the turn) will not be refilled.
