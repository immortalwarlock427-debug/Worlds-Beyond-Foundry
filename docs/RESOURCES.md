# Character resource pools

Version 0.21.0 includes optional mana/holy-power pools and stable custom resource trackers, now with any-stat scaling and points/percentage display. The user confirmed the 0.20.0 base pools work. This remains sheet-first work; combat development is paused.

## Sources

Read 2026-11-01: Notion [Magic System](https://www.notion.so/351c72092efb81ad8887d6ab65b8cab6), [Intelligence](https://www.notion.so/351c72092efb81fd8861d6d5d5b12eb4) and [Faith](https://www.notion.so/351c72092efb813a8dcdf9dbae517e29). Mana uses current INT × (level + 2); holy power uses current FTH × (level + 2). When a maximum increases, current increases by the same amount. These pages do not prescribe a regeneration rate, so none is invented.

The current website's `js/resources.js` and `js/character-core.js` were consulted for optional visibility, named custom pools, stable identifiers, action amounts, manual totals, recovery, percentage meters and per-pool rest settings. Forms/ability costs remain outside this step. Foundry supports independent mana and holy power visibility, allowing either, both or neither. Long-rest refill follows the user's existing instruction to restore resources, with custom-pool opt-out as on the website. Any-stat scaling uses the user's explicit extension of the standard formula; no formula editor or custom multiplier is introduced.

## Sheet behavior

- Open **Resources → Manage** to show mana, show holy power or add a custom resource. Magic pools begin hidden so existing non-casters keep a compact sheet. Hiding a pool preserves its balance/settings; it still refills on long rest.
- Cards show current/maximum, an action amount and **Spend / Restore / Fill**. The action amount is remembered per pool. Spend requires enough points; direct Current edits remain unrestricted finite corrections, including zero, negative and above-maximum values. Clearing Current fills that pool. Restore caps at the maximum but preserves an already above-maximum manual correction; Fill deliberately replaces it with the maximum.
- Magic **Settings** has a clearable final maximum override and additive Extra maximum. Explicit zero is supported. Clearing the override restores the stat/level calculation, including the additive bonus. Earned stat points and Active Effects on INT/FTH are included.
- Custom **Settings → Maximum from** offers Manual maximum or any of STR/DEX/VIT/AGL/INT/WIS/CHA/FTH. A selected stat uses its current effective score × (level + 2), plus any existing Extra maximum. This includes earned points, effects and armor's effective AGL penalty when applicable. For another scaling rule, choose Manual maximum and enter the total yourself. The saved manual maximum is retained while a stat is selected. There are no multiplier or formula fields.
- Custom settings also retain name, additive Extra maximum, recovery amount and Fill on long rest. Zero manual maximum is supported. Blank names display as Resource. Removal asks for confirmation and removes only that resource's balance/settings.
- All resource cards have **Settings → Display: Points / Percentage** and a fill meter. Points remain the underlying balance. Percentage mode shows/edits current as a fraction of maximum; hover over the figure for exact points. Spend, Restore and recovery amounts always mean points. Switching display or submitting an untouched rounded percentage never rewrites expenditure. Percentages display to two decimal places; only the meter's visual fill is clamped to 0–100, preserving manual negative/excess corrections.
- At a zero maximum, percentage is undefined: the figure shows —% and Settings provides Current points instead. This preserves zero/excess balances without division by zero. Clearing the current field still fills the pool.
- A positive custom recovery amount adds **Recover +X**, applying that amount once up to maximum. This is manual recovery; no combat hook, automatic turn tick, timer, spell cost, cooldown or AP spending is added.
- Long rest retains Health/AP/reaction/Wonder behavior, resets magic expenditure, and fills each custom pool whose rest setting is on. Opted-out custom balances, settings, overrides and use-history flags stay unchanged.
- Mana and holy power are available as native token bars. Existing prototype/token bar choices remain unchanged. Custom pools are sheet trackers in this step.

Long-rest and resource buttons use the existing local actor action queue; sheet submissions join that queue so a blurred edit can finish before a following button action. This does not coordinate simultaneous clients. Whole-sheet forms omit unchanged prepared totals, avoiding accidental refills when editing a stat or maximum. No messages are posted by resource management.

## Data and maximum changes

All model additions have defaults. `system.mana` and `system.holyPower` contain `enabled`, `spent`, `bonus`, `amount`, `maxOverride`, `display`, and derived non-persisted `value`/`max`. Custom resources use `system.customResources.<16-character-id>` with `name`, `baseMax`, `scaleStat`, `display`, `spent`, `bonus`, `amount`, `regen`, `refillOnRest`, and derived `value`/`max`. Existing pools default to manual maximum and points display; no saved balances, IDs or base maxima are reset. IDs are stable as names change; future ability/effect references can use them. Additions/removals write individual field paths, not the entire collection. Removal uses Foundry v14's native ForcedDeletion operator.

Only points spent are stored. Current = maximum − spent. Increasing INT from 21 to 23 at level 1 changes a pool with 10 spent from 53/63 to 59/69; removing the effect restores 53/63. Level changes, manual maximums and custom bonuses use the same rule. Loading/preparing/rendering never writes balances or accumulates bonuses.

Example: Blood scaled from VIT 18 at level 4 has a maximum of 108. With 27 spent it shows 81/108 or 75%. At level 8 it becomes 153/180 (85%), preserving the 27 points spent rather than preserving the percentage. Switching back to Manual maximum restores the remembered manual cap, still preserving expenditure. A deliberate percentage edit uses the maximum resulting from the submitted form; unchanged percentages do not become point edits when a maximum/stat changes.

The same expenditure-preserving policy applies when maximums decrease; a maximum below the amount spent can display a negative current total. This follows the sheet's correction-friendly deficit approach rather than erasing expenditure or silently clamping stored values. Direct correction, Restore, Fill and rest remain available. New actors/pools start full (zero spent). Automatic maxima floor at zero.

No existing fields are renamed/removed; no migration or world-data rewrite runs on load. AP/reactions, token attacks, defenses, equipment and world turn processing are unchanged. The wider roadmap now records the user's sheet-first order and defers combat integration.

## Validation

`node --test` covers formulas, all eight scaling stats, manual fallback, zero/clear overrides, stat/level transitions, expenditure/reload stability, percentage conversions/rounding/display toggles/zero caps, point-based actions, negative/excess corrections, action caps, independent balances, stable add/remove IDs, whole-sheet/current+max edits, long rest opt-outs, serialization, ownership and cancelled updates. Real v14 schema/strict Handlebars checks cover earned points and effects before maxima, legacy scaling/display defaults, source immutability, deletion operators, escaped editable/read-only resource cards and selects, zero-max point fallback and mana/holy token bar edits. Existing schema/template, inventory and stat-setup regression checks remain in place; the PR records live checks and limits.

Before merging, restart Foundry and refresh player browsers. Enable each magic pool, spend points, change INT/FTH or level and reload. Try zero and clear maximum overrides. Add/rename a custom pool, set recovery, test its buttons and remove only after confirming. Test opted-in/out long-rest pools, current+maximum corrections, player permissions, token bars, linked/unlinked actors and narrow/mobile layout. Actual gameplay recovery and multi-client timing need in-world validation.
