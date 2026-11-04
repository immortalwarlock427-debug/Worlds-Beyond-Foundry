# Resources and recovery

Manage optional Mana, Holy power and custom resources in Details. Custom resources can scale from any stat or use manual maxima; clearable maximum overrides set the final cap, and minimum overrides define the spending floor. Optional overflow allows values above the cap. Points/percentage display keeps internal fractional balances. One hex color produces a solid bar; two produce a gradient.

Recovery is configurable per resource/ability. Automatic turn recovery stops at the effective maximum and preserves existing overflow. Manual Recover and Restore can exceed the maximum when overflow is enabled. See the [desktop audit](CHARACTER-SHEET-AUDIT.md) for the shared release gate. Detailed rules, settings and historical validation notes follow.


## Contents

- [Character resource pools](#resources)
- [Uses and resource recovery](#recovery)


<a id="resources"></a>
## Character resource pools

<a id="resources-bar-colors"></a>
### Bar colors

In **Details → Resources → a pool's Settings**, use **Color (hex)** for a solid bar and **Gradient end (optional)** for a second color blended left to right. This works on Mana, Holy power and every custom pool, including percentage and overflow displays. **Details → Core bar colors** offers the same fields for Health, AP, Reactions and Wonder on Character.

Use `#6FD6FF`, `6FD6FF`, or a short code such as `#ABC`. Codes save as uppercase six-digit hex. One valid color in either field gives a solid fill; two give a gradient. Clear both to return to the existing theme. Inputs validate hex values and the renderer only emits validated colors. Custom fills take precedence over the theme's overflow tint; the actual total/percentage and Character's Above maximum label still communicate overflow. These settings style sheet bars; native map-token bars retain Foundry's own colors.

Each resource gains additive `barColors.start` and `barColors.end` text fields, both initially blank. Existing field names/calculations remain intact. The two settings are shared across forms with the pool itself, survive hiding/reloading/rests and never change current, maximum, minimum, spent points or recovery. Unchanged color fields are omitted from full-sheet saves. The website's current `css/sheet.css` was rechecked; custom hex/gradient colors are the user's requested presentation extension.

Validation: portable tests cover short/long codes, solid/gradient/default selection, malformed color rejection, safe rendering, clearing and unchanged/source preservation. Actual v14.365 schema and sheet-form adapters verify blank defaults, read-only fields, normalized color-only saves/reload and exact fractional Health/AP/Mana/custom balances. Ninety isolated browser states at 1120/1000/760/390/340 px cover owner/observer/empty sheets, expanded settings, prior tab behavior and narrow layouts; computed paints match on Character and Details, and native hex input validity is checked. Live autosave, multi-client updates and actual phones remain for user validation after restart/refresh.

Optional **Allow over maximum** now permits gains above the normal cap, with resource-threshold form prompts. Manual current corrections remain unrestricted. Defaults retain capped restoration. See [consumables, overflow and form triggers](ABILITIES-FORMS.md#consumables-triggers) for setup, data and validation.

Version 0.22.0 includes optional mana/holy-power pools and stable custom resource trackers, with any-stat scaling, whole-number points/percentage display and clearable final minimum/maximum overrides. Internal fractional points are retained. The user confirmed the 0.20.0 base pools work. This remains sheet-first work; combat development is paused.

<a id="resources-sources"></a>
### Sources

Read 2026-11-01: Notion [Magic System](https://www.notion.so/351c72092efb81ad8887d6ab65b8cab6), [Intelligence](https://www.notion.so/351c72092efb81fd8861d6d5d5b12eb4) and [Faith](https://www.notion.so/351c72092efb813a8dcdf9dbae517e29). Mana uses current INT × (level + 2); holy power uses current FTH × (level + 2). When a maximum increases, current increases by the same amount. These pages do not prescribe a regeneration rate, so none is invented.

The current website's `js/resources.js` and `js/character-core.js` were consulted for optional visibility, named custom pools, stable identifiers, action amounts, manual totals, recovery, percentage meters and per-pool rest settings. Forms/ability costs remain outside this step. Foundry supports independent mana and holy power visibility, allowing either, both or neither. Long-rest refill follows the user's existing instruction to restore resources, with custom-pool opt-out as on the website. Any-stat scaling uses the user's explicit extension of the standard formula; no formula editor or custom multiplier is introduced.

The user's follow-up requests final caps instead of additive-only controls and an editable minimum. They clarified that a minimum of −20 must allow Spend to take a zero balance to −5. These are per-pool manual settings, not new global game rules. The website UI was rechecked for this refinement. Module suggestions remain deferred; none is installed or required here.

<a id="resources-sheet-behavior"></a>
### Sheet behavior

- Open **Resources → Manage** to show mana, show holy power or add a custom resource. Magic pools begin hidden so existing non-casters keep a compact sheet. Hiding a pool preserves its balance/settings and pauses automatic turn recovery; long rest follows its Fill on long rest setting.
- Cards show current/maximum, an action amount and **Spend / Restore / Fill**. The action amount is remembered per pool. Spend cannot take the balance below the configured minimum (normally zero); direct Current edits remain unrestricted finite corrections, including values below minimum and above maximum. Clearing Current fills that pool. Restore caps at the maximum but preserves an already above-maximum manual correction; Fill deliberately replaces it with the maximum.
- Every optional/custom pool has **Settings → Maximum override**. It replaces the selected base maximum. Bonuses apply to the overridden base. For example, an automatic 126 with override 80 has maximum 80, not 206. Explicit zero is supported. Clear it to restore the selected source. The placeholder previews that source. The Maximum bonus field shows the stored bonus. Active effects can contribute additional bonuses. Clear a legacy bonus by setting it to zero.
- **Minimum override** sets the empty bar and the spending floor. Blank means zero, and negative or positive floors are supported. With minimum −20, spending 5 from 0 results in −5; spending below −20 is rejected. Changing minimum never clamps an existing balance, changes expenditure or refills the pool. Values below minimum from manual edits or maximum changes remain correctable with Current/Restore/Fill. A zero-point Spend is a no-op.
- Custom **Settings → Maximum from** offers Manual maximum or any of STR/DEX/VIT/AGL/INT/WIS/CHA/FTH. A selected stat uses its current effective score × (level + 2), plus any saved bonus. This includes earned points, effects and armor's effective AGL penalty when applicable. For another scaling rule, choose Manual maximum and enter the total in Maximum override. The saved pre-override manual maximum is retained while a stat or override is selected; clearing the override restores it in manual mode. There are no multiplier or formula fields.
- Custom settings also retain name, recovery amount and Fill on long rest. Blank names display as Resource. Removal asks for confirmation and removes only that resource's balance/settings.
- All resource cards have **Settings → Display: Points / Percentage** and a fill meter. Points remain the underlying balance. Percentage mode shows/edits position between minimum (0%) and maximum (100%); hover over the figure for whole points and minimum. For −20..100, 40 points is 50%. At the normal minimum of zero this is the previous current/maximum calculation. Spend, Restore and recovery amounts always mean points. Points, percentages and numeric entries floor to whole numbers in the interface. Internal fractional balances remain exact: 120.4 displays as 120, then 119.9 as 119. Switching display or submitting an untouched floored total never rewrites expenditure. The meter's geometry retains precision and clamps its visual fill to 0–100, preserving manual corrections outside the limits. See [whole-number handling](SHEET.md#number-display).
- If maximum is not greater than minimum, percentage is undefined: the figure shows —% and Settings provides Current points instead. Balances and entered limits are preserved, including when a stat decrease makes the maximum fall below a configured minimum. Clearing Current still fills the pool. A zero maximum with a negative minimum has a valid range and percentage.
- A positive recovery amount adds **Recover +X** on any optional pool. Recover on own turn optionally applies it at the beginning of that character’s turn in a started encounter. Default is off. Fill on long rest is configurable for every optional pool. See [recovery settings](RESOURCES.md#recovery) for limits, persisted receipts and validation.
- Long rest retains Health/AP/reaction/Wonder behavior and fills each magic/custom pool whose rest setting is on (default on). Opted-out custom balances, settings, overrides and use-history flags stay unchanged.
- Mana and holy power are available as native token bars. Existing prototype/token bar choices remain unchanged. Minimum-aware meters are on the sheet; Foundry's native map token bars retain their standard zero-based visualization, and token-bar corrections remain unrestricted point edits. Custom pools are sheet trackers in this step.

Long-rest and resource buttons use the existing local actor action queue; sheet submissions join that queue so a blurred edit can finish before a following button action. This does not coordinate simultaneous clients. Whole-sheet forms omit unchanged prepared totals, avoiding accidental refills when editing a stat or maximum. No messages are posted by resource management.

<a id="resources-data-and-maximum-changes"></a>
### Data and maximum changes

All model additions have defaults. `system.mana` and `system.holyPower` contain `enabled`, `spent`, `bonus`, `amount`, `maxOverride`, `minOverride`, `display`, and derived non-persisted `value`/`max`/`min`. Custom resources use `system.customResources.<16-character-id>` with `name`, `baseMax`, `scaleStat`, `display`, `maxOverride`, `minOverride`, `spent`, `bonus`, `amount`, `regen`, `refillOnRest`, and derived `value`/`max`/`min`. New overrides default to null, leaving old maxima/balances unchanged and minimum zero. Existing pools default to manual maximum and points display; no saved balances, IDs or base maxima are reset. IDs are stable as names change; future ability/effect references can use them. Additions/removals write individual field paths, not the entire collection. Removal uses Foundry v14's native ForcedDeletion operator.

Only points spent are stored. Current = maximum − spent. Increasing INT from 21 to 23 at level 1 changes a pool with 10 spent from 53/63 to 59/69; removing the effect restores 53/63. Level changes, manual maximums and custom bonuses use the same rule. Loading/preparing/rendering never writes balances or accumulates bonuses.

Example: Blood scaled from VIT 18 at level 4 has a maximum of 108. With 27 spent it shows 81/108 or 75% at minimum zero. At level 8 it becomes 153/180 (85%), preserving the 27 points spent rather than preserving the percentage. Switching back to Manual maximum with no final override restores the remembered manual cap, still preserving expenditure. A deliberate percentage edit uses the minimum and maximum resulting from the submitted form; unchanged percentages do not become point edits when a limit/stat changes. Display units are interpreted from the original rendered form even when Display is changed in the same submission.

The same expenditure-preserving policy applies when maximums decrease; a maximum below the amount spent can display a negative current total. This follows the sheet's correction-friendly deficit approach rather than erasing expenditure or silently clamping stored values. Direct correction, Restore, Fill and rest remain available. New actors/pools start full (zero spent). Automatic maxima floor at zero.

No existing fields are renamed/removed; no migration or world-data rewrite runs on load. AP/reactions, token attacks, defenses and equipment are unchanged; optional recovery hooks are described in RECOVERY.md. The wider roadmap now records the user's sheet-first order and defers combat integration.

<a id="resources-validation"></a>
### Validation

All 227 `node --test` cases pass. Resource tests cover formulas, all eight scaling stats, manual fallback, zero/clear/final overrides, stat/level transitions, expenditure/reload stability, minimum-aware percentage conversions/rounding/display toggles/degenerate ranges, point-based actions, negative/positive spending floors, unrestricted corrections, independent balances, stable add/remove IDs, whole-sheet/current+limits edits, long rest opt-outs, serialization, ownership and cancelled updates. Real v14.365 schema/strict Handlebars checks cover earned points/effects before maxima, maximum override calculations, empty fields clearing to null, legacy defaults, source immutability, deletion operators, escaped editable/read-only cards/selects, percentage fallback and mana/holy token bar edits. Existing schema/template, inventory and stat-setup regression checks remain in place. The limit and whole-number refinements were checked offline with Foundry's actual model/template libraries; no live user data was accessed and the new controls still need user testing inside Foundry.

Before merging, restart Foundry and refresh player browsers. Enable each magic pool, spend points, change INT/FTH or level and reload. Try zero and clear maximum overrides. For Blood, choose VIT, set a lower final maximum, set minimum −20, correct Current to 0 and spend 5: expect −5, with spending stopped at −20. Test points/percentage modes and clearing both limits. Add/rename a custom pool, set recovery, test its buttons and remove only after confirming. Test opted-in/out long-rest pools, current+limits corrections, player permissions, token bars, linked/unlinked actors and narrow/mobile layout. Actual gameplay recovery and multi-client timing need in-world validation.

<a id="recovery"></a>
## Uses and resource recovery

Recovery is optional. Existing abilities keep manual uses; existing pools keep their balances and long-rest settings. No automatic regeneration rate is invented.

<a id="recovery-configuration"></a>
### Configuration

- In an ability's **Uses & cooldown**, set Maximum uses and **Reset uses**: Manual, Long rest, New combat or Own turn. Long rest also refills New combat/Own turn uses; starting combat also refills Own turn uses. Unlimited uses stay unlimited. Recovery notes remain descriptive text.
- In any Mana, Holy power or custom pool's **Settings**, enter a Recovery amount in points. **Recover +N** applies it once manually. **Recover on own turn** opts into that gain when the character's turn begins in a started encounter. Default is 0/off. Hiding Mana/Holy power pauses their automatic turn recovery.
- **Fill on long rest** is now available for Mana and Holy power as well as custom pools. Its existing default is on. Hidden magic pools still follow this setting on rest. Health, AP, reactions and Wonder retain their existing full-rest behavior.

Recovery uses the ordinary resource limits: it retains fractional points internally, caps gains unless Allow over maximum is enabled, and leaves corrections/settings intact. For example, 89.5 Mana with recovery 5 becomes 94.5 internally and displays 94. A Blood pool at 97.5/100 with overflow enabled can recover to 102.5.

Uses recovery does not end active bonuses/forms, reset cooldowns or advance world time. These have separate clocks. This is one editable uses counter per ability, rather than separate outside-combat allowances. Manual corrections remain available.

<a id="recovery-foundry-behavior-and-data"></a>
### Foundry behavior and data

Only the active GM performs automatic encounter/turn recovery. Native combatant actors are used, including unlinked tokens. Adding a participant to a started encounter applies its configured New combat reset. A session flag is assigned in the native combat-start update; persisted actor receipts prevent duplicate hook events/reconnects from repeating recovery. Moving backward does not grant it again; moving forward beyond the last processed turn does. Restarting an ended encounter creates a new session. There is no automatic recovery outside started encounters.

Updates share the actor action queue with sheet edits and payments. Ability use resets compensate if a later update fails; resource gains and the event receipt commit together in the final Actor update. Failures report the actor and remain retryable. This is local client serialization, not a distributed transaction across simultaneous GMs.

Additive fields: `system.uses.resetOn` on Ability Items (default `manual`), and `regen` (0), `autoRecover` (false), `refillOnRest` (true) on magic pools. Custom pools retain their existing `regen`/`refillOnRest` paths and gain `autoRecover`. Runtime receipts use `flags.worlds-beyond.recovery` and combat session flags. No saved fields are renamed or removed; loading/rendering does not reset trackers.

<a id="recovery-sources-and-validation"></a>
### Sources and validation

Consulted the website's current `js/resources.js` and `js/abilities.js` for manual recovery, rest settings and use-reset policies. Notion's [Magic System](https://www.notion.so/351c72092efb81ad8887d6ab65b8cab6) prescribes INT/FTH × (level + 2), without a universal regeneration rate. These controls configure individual records and do not introduce a new global rule. Foundry v14.365's native combat lifecycle was inspected locally; `combatStart` precedes the saved update, so the new session is written in that update instead.

Portable tests cover policy selection, finite/unlimited uses, fractional gains, overflow, hidden/manual pools, rest opt-out, repeated/rewound turns, reconnect/session receipts and compensation after failed item/actor updates. Offline native v14 schemas and strict Handlebars checks verify defaults, existing trackers, whole-number presentation, out-of-combat Command totals and owner/read-only rendering. Headless layout checks cover 760/390/340 px widths with 44 px recovery controls.

Not yet exercised in the running world: the new controls, live combat hooks, socket persistence, multiple clients, player permissions, token actors and real mobile focus/scrolling. Before merging, restart Foundry and refresh player browsers. Configure one ability for each reset mode, spend uses, test long rest/start/next turn, and check an unchanged manual ability. Spend Mana, set recovery 5/on, advance its own turn and verify only one gain. Test overflow Blood, hidden Mana, long-rest opt-out and an unlinked token. Confirm cooldowns, active forms and base stats remain as configured.

A form maximum replaces the resulting cap while that form is active. The change preserves current points, including overflow, and percentage display uses the active cap. Ordinary stat, level and equipment changes still preserve points spent.
