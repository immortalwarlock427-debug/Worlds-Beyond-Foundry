# Potion durations and item bonus hints

Consumable stat bonuses can now expire. The timer is configured on the consumable, while applied copies use Foundry v14's native Active Effect duration and expiry registry. No module or separate wall-clock timer is required. Existing untimed potions and already-applied bonuses retain manual End until edited; no migration runs.

## Use

- Add the consumable's bonuses, then expand **Bonus duration** and enter a whole count plus Rounds, Minutes or Hours. Blank or 0 lasts until manually ended. There is no universal potion duration imposed by the system.
- **Use** snapshots the bonus definitions and configured duration into its chat card, and pays the usual item/AP cost. **Apply benefits** begins the clock, applies the bonuses and any instant restoration, and groups the active copies in Status. Changing or deleting the original item afterward does not change this use.
- Rounds need a started encounter containing the drinker. A count of 3 expires at the start of the drinker's turn three rounds after application. It does not expire on whoever happened to be taking a turn when Apply was pressed. Round configuration is checked before Use spends anything and again on Apply. If the encounter ends before Apply, that card remains retryable with no partial restoration; start an encounter to apply its snapshotted round duration.
- Minutes/hours follow **Foundry world time**, including supported time advancement and any encounter time progression configured in Foundry. Waiting in real time does not move this clock. Use game-time advancement for out-of-combat timed potions. A GM must be connected for Foundry's native expiry persistence.
- Status shows the native remaining-time label and retains End for early removal. Expiry suppresses the copied bonuses and removes the active Status entry; base stats and stored expenditure stay unchanged. It does not undo instant healing, refund the potion/AP, or modify the item definition. Each use remains independent.

Inventory rows show enabled bonus definitions as compact signed hints, e.g. **+3 STR**, **+2 DEX** or **+1 AR**. Stowed gear still advertises its configured bonus; its equipped button and tooltip distinguish whether it is active. Disabled bonus sets are omitted. Custom maximum bonuses use the current resource name. Consumables also show their configured duration; the chat card shows the actual bonuses rather than a count of bonus sets. Restoration hints name their target, including Mana/Blood and percentage units. Longer hints remain available through the item tooltip/editor.

## Data and implementation

Consumables add `system.bonusDuration.value` (nullable integer, default null) and `units` (default rounds). Applied copies get native v14 `duration.value`, `duration.units`, `duration.expiry`, `duration.expired` and `start` data on Apply. These are the v14 fields, not the deprecated v13 duration aliases. Rounds use `turnStart` expiry associated with the drinker's combatant; time-based units expire on time advancement. Earlier chat cards without duration data remain untimed.

`CharacterActor.onUpdateEffectDurations` rerenders existing views so countdowns stay current, without writing data. Foundry's existing registry and active GM handle expiry persistence and native effect preparation. The system does not replace Foundry's global expiry policy or restyle its sidebar. Clearing a consumable duration affects future Use cards; editing an already-applied timer remains available through its native effect editor.

The current website `js/status.js` informed compact signed modifier labels and remaining-time presentation. Notion [Equipment Rules](https://app.notion.com/p/40ac72092efb81588f50ea19ac0ab5e4) remains the gear rules authority. User-configured potion timing implements the explicit request; no new potion/class rule or combat action is invented.

## Validation

Portable tests cover legacy/cleared durations, whole counts, compact enabled bonuses and resource hints, card snapshots, Apply-time starts, per-use grouping, native expiry hiding, no-encounter preflight, an encounter ending before Apply and preservation of the existing paid-card rollback behavior. The character duration callback refreshes views without actor writes.

Offline checks use actual installed v14.365 duration fields plus the native combat/time duration methods and expiry registry, with document/calendar/network adapters. A 3-round timer counts 3→1→expired on the drinker's turn; another actor's turn cannot expire it. Minutes/hours remain active just before their exact game-clock deadline and expire at it. Strict owner/observer templates check values, escaping, hints, passive legacy behavior and read-only controls. Headless previews cover the editor, Equipment and Status at 760/390/340px with no horizontal overflow and at least 44px controls within the changed views.

Not tested in a running world: native document persistence, GM/player synchronization, effect re-preparation after expiry, clock controls, live dice/card interactions, unlinked tokens and live scrolling. After restarting Foundry and refreshing browsers, make a +3 STR potion with 3 rounds, Apply, advance the drinker's turns, and confirm the effective stat returns to base and Status disappears. Repeat with game-time minutes, End early, two independent uses and a deleted original item. Check stowed/equipped gear hints and older untimed cards. Offline checks and installation never access or alter saved world/actor data.

Ability duration/cooldown/recovery automation, form loadouts and final sheet validation are still later sheet work. Combat resolution, spell visuals and module installation remain deferred; notify the user before that transition.
