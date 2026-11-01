# Character resource pools

Version 0.20.0 adds optional mana/holy-power pools and stable custom resource trackers. This is the first task in the user's sheet-first priority order; combat work is paused.

## Sources

Read 2026-11-01: Notion [Magic System](https://www.notion.so/351c72092efb81ad8887d6ab65b8cab6), [Intelligence](https://www.notion.so/351c72092efb81fd8861d6d5d5b12eb4) and [Faith](https://www.notion.so/351c72092efb813a8dcdf9dbae517e29). Mana uses current INT × (level + 2); holy power uses current FTH × (level + 2). When a maximum increases, current increases by the same amount. These pages do not prescribe a regeneration rate, so none is invented.

The current website's `js/resources.js` and `js/character-core.js` were consulted for optional visibility, named custom pools, stable identifiers, action amounts, manual totals, recovery and per-pool rest settings. Forms/ability costs and percent meters are outside this small step. Foundry supports independent mana and holy power visibility, allowing either, both or neither. Long-rest refill follows the user's existing instruction to restore resources, with custom-pool opt-out as on the website.

## Sheet behavior

- Open **Resources → Manage** to show mana, show holy power or add a custom resource. Magic pools begin hidden so existing non-casters keep a compact sheet. Hiding a pool preserves its balance/settings; it still refills on long rest.
- Cards show current/maximum, an action amount and **Spend / Restore / Fill**. The action amount is remembered per pool. Spend requires enough points; direct Current edits remain unrestricted finite corrections, including zero, negative and above-maximum values. Clearing Current fills that pool. Restore caps at the maximum but preserves an already above-maximum manual correction; Fill deliberately replaces it with the maximum.
- Magic **Settings** has a clearable final maximum override and additive Extra maximum. Explicit zero is supported. Clearing the override restores the stat/level calculation, including the additive bonus. Earned stat points and Active Effects on INT/FTH are included.
- Custom **Settings** has name, base maximum, additive Extra maximum, recovery amount and Fill on long rest. Zero maximum is supported. Blank names display as Resource. Removal asks for confirmation and removes only that resource's balance/settings.
- A positive custom recovery amount adds **Recover +X**, applying that amount once up to maximum. This is manual recovery; no combat hook, automatic turn tick, timer, spell cost, cooldown or AP spending is added.
- Long rest retains Health/AP/reaction/Wonder behavior, resets magic expenditure, and fills each custom pool whose rest setting is on. Opted-out custom balances, settings, overrides and use-history flags stay unchanged.
- Mana and holy power are available as native token bars. Existing prototype/token bar choices remain unchanged. Custom pools are sheet trackers in this step.

Long-rest and resource buttons use the existing local actor action queue; sheet submissions join that queue so a blurred edit can finish before a following button action. This does not coordinate simultaneous clients. Whole-sheet forms omit unchanged prepared totals, avoiding accidental refills when editing a stat or maximum. No messages are posted by resource management.

## Data and maximum changes

All model additions have defaults. `system.mana` and `system.holyPower` contain `enabled`, `spent`, `bonus`, `amount`, `maxOverride`, and derived non-persisted `value`/`max`. Custom resources use `system.customResources.<16-character-id>` with `name`, `baseMax`, `spent`, `bonus`, `amount`, `regen`, `refillOnRest`, and derived `value`/`max`. IDs are stable as names change; future ability/effect references can use them. Additions/removals write individual field paths, not the entire collection. Removal uses Foundry v14's native ForcedDeletion operator.

Only points spent are stored. Current = maximum − spent. Increasing INT from 21 to 23 at level 1 changes a pool with 10 spent from 53/63 to 59/69; removing the effect restores 53/63. Level changes, manual maximums and custom bonuses use the same rule. Loading/preparing/rendering never writes balances or accumulates bonuses.

The same expenditure-preserving policy applies when maximums decrease; a maximum below the amount spent can display a negative current total. This follows the sheet's correction-friendly deficit approach rather than erasing expenditure or silently clamping stored values. Direct correction, Restore, Fill and rest remain available. New actors/pools start full (zero spent). Automatic maxima floor at zero.

No existing fields are renamed/removed; no migration or world-data rewrite runs on load. AP/reactions, token attacks, defenses, equipment and world turn processing are unchanged. The wider roadmap now records the user's sheet-first order and defers combat integration.

## Validation

`node --test` covers formulas, zero/clear overrides, stat/level transitions, expenditure/reload stability, negative/excess corrections, action caps, independent balances, stable add/remove IDs, whole-sheet/current+max edits, long rest opt-outs, serialization, ownership and cancelled updates. Real v14 schema/strict Handlebars checks cover earned points and effects before maxima, source immutability, deletion operators, escaped editable/read-only resource cards and mana/holy token bar edits. Existing schema/template, inventory and stat-setup regression checks remain in place; the PR records live checks and limits.

Before merging, restart Foundry and refresh player browsers. Enable each magic pool, spend points, change INT/FTH or level and reload. Try zero and clear maximum overrides. Add/rename a custom pool, set recovery, test its buttons and remove only after confirming. Test opted-in/out long-rest pools, current+maximum corrections, player permissions, token bars, linked/unlinked actors and narrow/mobile layout. Actual gameplay recovery and multi-client timing need in-world validation.
