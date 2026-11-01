# Stat generation and level-up points

Version 0.16.0 adds **Roll & assign** and **Stat points** above the eight attributes. Both are draft windows: only Apply/Save writes to the character. Closing cancels the draft. The existing score fields remain editable.

## Sources

- [Notion: Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4), read 2026-11-01: roll **2d6 + 1d12 eight times**, assign freely; levels **4, 8, 12, 16 and 19** grant **4 points each**, at most **2 to one stat per award**. Natural advancement reaches 28; magic may exceed it.
- Current website [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html) and [js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), read 2026-11-01: independent result slots, assigning/swapping scores, rolling one or filling the pool, editable per-award allocations and optional help. The interface is rebuilt in ApplicationV2; the website files are unchanged.
- The website's older Health/Mana advancement history conflicts with current Notion's current-stat formulas. This feature ports stat generation/awards only; existing Foundry Health and other derived values keep the current Notion calculations.

## Behavior and data

The generator uses Foundry's dice engine without posting to chat. Roll one fills the first blank; Roll remaining fills blanks; Reroll eight replaces a full draft. Typed scores can replace any result. A destination change swaps assignments so each result is used once, including equal totals. Blank results leave their stat unchanged. Apply establishes the selected new base scores and clears their manual-edit/reset flags; awards, gear and Active Effects still add afterward. Manual/lore exceptions remain possible through typed scores and ordinary sheet corrections. Draft roll results are not saved on close.

The additive `system.advancement` schema stores `level4`, `level8`, `level12`, `level16` and `level19`, each with the eight stat keys and zero initial points. No existing field is removed or renamed. Existing actors gain zero allocations and retain all current scores. If a player already included an award in a manually entered base, correct that base before recording it here; old scores cannot identify which points were previously added by hand.

`prepareBaseData` adds earned allocations before Foundry applies initial Active Effects; derived stats, modifiers, milestones, armor, Health and pools therefore use the augmented scores. Prepared totals never overwrite stored base scores. The existing effective-at-rest/base-while-editing behavior and teal/gold/purple states remain: awards are automatic additions, and clearing a manual edit keeps them. Resource spending and damage deficits are not reset by saving scores or points.

Each earned award may spend up to four integer points, up to two in one stat. The guided + controls stop at natural 28, using bases and awards without gear/effects; direct manual corrections remain available. Save revalidates the draft and ownership. Award changes can be undone with minus or Reset award. Lowering a level **suspends** higher awards without deleting choices; raising it restores them. This intentionally preserves corrections rather than copying the website's destructive level-down behavior. There are no extra awards at 20 or later.

Stat/award/level changes elsewhere invalidate an open draft rather than silently overwriting newer data. Unrelated resource changes do not invalidate it. Local duplicate Apply actions are serialized; the update writes absolute base scores or allocation counts, never repeated increments. This is a correction-friendly sheet, not a cross-client locking or audit system.

## Validation

Run `node --test`. Rules tests cover thresholds, per-award budgets, natural cap, suspending/re-enabling awards, assignments and partial/typed score updates. Adapter tests cover dice generation, failure recovery, permissions, stale drafts, duplicate saves and allocation-only writes. Local checks against Foundry 14.365's real data model and strict Handlebars cover form compatibility, new/old actors, derived values, manual reset plus effects, preserved pools, and generation/award templates at levels 1/4/8/19 in editable/read-only states.

The PR records actual live checks and remaining limits. Before merging:

1. Restart Foundry and refresh player browsers. Open both controls above Attributes. Check compact layouts, keyboard controls, optional help and footer scrolling.
2. In a test character, roll one, type another score, fill the remaining results, swap destinations and Apply. Confirm the assigned bases and modifiers. Cancel a second draft and confirm no changes.
3. At level 4, spend two points each in two stats; verify a third point in either stat and a fifth overall are unavailable. Remove/reset points and save. Reach 8, 12, 16 and 19 to confirm separate awards. Level 20 adds no award.
4. Verify gear/effects still add, clearing a manual edit preserves awarded points, and dropping/re-raising level suspends/restores later choices. Check the cap with gear pushing an effective score beyond 28.
5. Verify existing manually entered scores before recording old awards, save/reload persistence, current spent resources, player permissions, and both linked/unlinked actors. No in-world test should overwrite an existing character's bases merely to exercise generation.
