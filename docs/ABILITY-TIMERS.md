# Ability durations and cooldowns

Ability Items now support optional native Foundry v14 clocks for active duration and cooldown. Their existing costs, restoration, bonuses, uses and form selection keep their rules. This is character-sheet tracking; it adds no damage casting, targeting, spell visuals or module dependency.

## Configure

- Expand **Active duration** on a non-passive Ability or Form and enter a whole count with Rounds, Minutes or Hours. Blank or 0 keeps manual End. A descriptive timed ability/form can be tracked even without numeric bonuses.
- Under **Uses & cooldown**, enter Cooldown (rounds) and enable **Count cooldown automatically**. It starts an independent native round clock on Use. With that checkbox off, the existing editable remaining-round counter stays manual.
- The original **Duration notes** text is preserved and remains descriptive. Existing text such as `3 rounds` is not silently converted; existing abilities default to untimed/manual cooldowns. New timer settings apply to the next activation, not a running clock.

A form duration is an explicit automatic ending, independent of its resource-trigger exit prompt. Leave Active duration blank on a transformation intended to remain until manual End or a resource-trigger prompt.

Use validates clocks before dice/payment. Round clocks require a started encounter containing the actor. Rounds expire at the start of that actor's turn after the configured number of rounds, even when Use happened during another actor's turn. Minutes/hours use Foundry world time; waiting in real time does not advance them. Use minutes/hours without automatic round cooldown for out-of-combat timed abilities. As with native potion timers, a connected active GM persists expiry.

## Active state and costs

Use starts the chosen clocks along with its payment, restoration and bonuses. Duration expiry ends the active ability/form and suppresses its bonuses, returning effective stats to their bases plus other sources. It does not undo healing, refund costs, reset uses or clear a still-running cooldown. End and Base form stop the active-duration clock early; a cooldown continues independently. Switching forms also stops the old form's duration.

For example, use a +3 STR ability with a 3-round duration and a 2-round automatic cooldown. At the actor's turn two rounds later, its cooldown is ready but the bonus is still active. One round later, the bonus ends. An active ability still offers End rather than another paid Use; end it before activating again if you want to refresh it.

Abilities shows a compact active/cooldown line; Status shows the active source and duration remaining. Pure cooldowns are not statuses, and internal clock records never appear as editable bonus definitions. Active forms/abilities without numeric bonuses still appear in Status and can be ended. Passive bonuses remain continuous while owned and have no activation clock.

If a native round duration reaches zero before the owner's expiry event, it waits for that event; cooldown stays unavailable until then. Foundry's native expiry policy remains unchanged, including compatibility with its delete-on-expiry option. Early End, expiration and reopening the sheet never charge again.

## Corrections and persistence

Deliberately editing **Cooldown remaining** detaches that running automatic clock and uses the entered manual count. Turning automatic cooldown off preserves its current count as manual. Deliberately toggling **Bonuses active** detaches its duration clock and keeps the chosen manual active state. Editing unrelated fields preserves both running clocks. A later Use starts configured clocks again; manual corrections do not disable future timer configuration.

Clocks persist as native Item-owned, non-transferring Active Effects with no changes and a namespaced timer-kind flag. Additive `activeDuration` settings, `cooldown.automatic` (false) and `timers.durationId/cooldownId` references keep them separate from bonus definitions. No existing actor/item field is removed or renamed. Fresh IDs per activation prevent late expiry/deletion events from ending a newer use; superseded internal clocks are cleaned after successful posting. Failed activation compensates newly created clocks, previous clock state, costs, form switches and trackers.

Only the active GM reconciles expired/deleted clocks into persistent active/cooldown flags. Native clock projections suppress expired bonuses immediately while that update is pending. Ready/canvas-ready reconciliation handles persisted expired clocks without restarting them. Existing untimed records are untouched. Native duration callbacks refresh existing actor and item views without writing source data. New owned copies discard copied runtime clocks while retaining their bonus definitions and timer configuration.

## Sources and validation

The current website `js/abilities.js` was checked for separate duration/cooldown counters, per-actor turn advancement and cost-safe activation. Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) remains the cost/scaling authority. No universal duration or recovery formula is invented. Foundry's installed v14.365 Active Effect schema/registry supplies timing and expiry; deprecated duration aliases are not used.

Portable tests cover defaults, projections, immediate expiry suppression, independent End/cooldown, pending owner-turn expiry, Status without bonuses, manual/full-form corrections, active-GM reconciliation, stale activation events, failed posting/partial clock creation rollback, new-copy cleanup and no-encounter preflight. Existing action/resource/consumable/form tests remain green.

Offline checks use actual v14.365 fields, typed bonus changes and the native duration methods/expiry registry with document/calendar/network adapters. They verify STR 18→21→18, an independent 2-round cooldown ending before a 3-round bonus, exact failed-post source restoration, fresh IDs, owner/observer templates and hidden clocks. Editor/Abilities/Status previews cover 760/390/340px with no horizontal overflow and 44px controls within changed views.

Not tested in a running world: native server persistence and actor re-preparation, synchronization across GM/player clients, synthetic token actors, live clock controls, hooks during reconnect and live focus/autosave. User checklist: restart Foundry and refresh browsers; use the example above, End early, switch timed forms, edit notes during countdown, correct cooldown to 0, reload, and try a minute-based duration with game-time advancement. Verify passive and older manual abilities still behave as before. Installation and offline checks never edit world/actor data.

Uses recharge, resource regeneration/rest configuration, form loadouts and final live sheet validation remain before moving into combat resolution, spell effects or modules. Explicitly notify the user at that transition.
