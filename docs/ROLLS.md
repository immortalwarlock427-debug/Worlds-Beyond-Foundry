# Rolls and Wonder

Roadmap step 2 adds check/save choices, advantage/disadvantage, readable chat cards, Wonder spending and a Wonder-only long-rest refill. It does not add attack automation or a general rest system.

## Rules and sources

Checked on 2026-10-31 against Notion [Faith](https://www.notion.so/351c72092efb813a8dcdf9dbae517e29) and [Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4):

- Wonder rerolls non-attack d20 rolls. Automatic uses are the FTH modifier, with negative modifiers giving zero uses; uses return on a long rest.
- At current FTH 21, Defy Fate turns a failed check or save into a success when Wonder is used. Initiative continues to reroll. This is included now because postponing it to the abilities step would give high-Faith characters the wrong Wonder behavior. The player declares failure; there is no automatic DC check.
- FTH 28 Miracle remains part of the later abilities step.

The website's [js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js) was inspected at blob `f3b2c49a553b6b720011bbe45f06e63bb8bc7706`: advantage keeps the higher of two d20s, disadvantage the lower, and Wonder retains the original roll mode and modifier. Foundry's dice engine implements those rolls; its chat log preserves the history. No website files are changed.

## Behavior and data

- Existing character fields are unchanged. New `system.wonder.value` starts at `null` (full), `maxOverride` at `null` (automatic), and `max` is derived and not persisted. Old characters acquire defaults on load. A spent value, including zero, survives unrelated edits and reloads. Blank current/refill restores full; blank max override restores the rule. Manual corrections remain unrestricted, including negative or above-max values.
- Click a stat abbreviation, choose check/save and dice, then Roll. Closing the dialog does nothing. Public, GM, blind and self roll modes use Foundry v14's `messageMode` API.
- Visible cards show the kept die, original bonus/penalty and total (for example, `9 + 4 bonus = 13`). Advantage/disadvantage list both dice and the kept higher/lower result. The underlying Foundry formula still uses `kh1` (keep highest one) or `kl1` (keep lowest one), but card rendering replaces that notation with readable text. Existing system cards also get this display when rendered again; hidden results are untouched.
- Use Wonder from a supported chat card. It posts a new result without editing the original; the new result replaces the old for play. Rerolls keep the original formula/modifier and exact whisper/blind audience. Defy Fate retains the original dice as context and clearly marks the declared success.
- Native combat-tracker initiative rolls carry their combat/combatant identity. Wonder updates that combatant's initiative after posting. If it no longer exists or the tracker update fails, the new total remains in chat with a warning to apply it manually. Linked and unlinked token speakers resolve through Foundry's speaker lookup.
- Only an actor owner who can see a result gets the action. At the user's request, spending now requires at least one current use and each result may use Wonder only once. The new reroll is independently eligible. Buttons show `Wonder used` or `No Wonder uses left` and refresh on actor/chat updates. Manual pool corrections remain editable; negative values left from the previous release are not silently changed. Restore Wonder or correct that value before using it again.
- `flags.worlds-beyond.wonderUsed.<messageId>` records consumed results on the speaker actor alongside the pool decrement. This survives reloads, refills and deletion of the replacement chat message, and does not require the player to edit a GM-authored initiative message. Existing reroll messages' `previousMessageId` links also identify already-used older results. Deleted pre-fix history cannot be reconstructed.
- Local actions for one actor are serialized. Simultaneous changes from separate clients are not a server-side transaction and can still require manual correction; this is not an anti-cheat system.
- Failed roll/card preparation spends nothing. If posting fails after spending, refund the use and clear its consumed flag. If that refund fails, tell the player to restore one use manually and make a new roll because the original remains marked used.
- Generic `/roll` messages, old messages without system metadata and third-party macro rolls have no Wonder button. This step covers system check/save cards and new native combat-tracker initiative rolls. Other non-attack rolls can be rerolled manually and their Wonder uses corrected on the sheet.

## Validation

`node --test` covers formulas, readable die/bonus breakdowns (including ties and negative/zero bonuses), Wonder/Defy Fate boundaries, zero/manual pools, cancellation, original modifiers and audience, initiative updates, spending/refund failures, repeat-use rejection, chained rerolls, persisted consumed flags, legacy rerolls, local concurrent clicks, mounted button refresh, refill and unchanged sheet submissions. Adapter tests use stubs and do not prove a live Foundry session works.

Additional local checks used the installed Foundry **14.365** TypeDataModel/field classes: old-character defaults, derived fields excluded from saved data, spent-zero persistence and refill. The sheet, dialog and chat templates compiled with the installed Handlebars library, including escaped text and native dice markup. v14 API usage was checked against the installed Foundry source. Browser preview was blocked for local files; no live world, visual layout or multiplayer validation was performed by Codex.

In-world checklist before moving to equipment:

- [ ] Restart Foundry, refresh player browsers, and open an existing character. Confirm existing stats, Health and pools remain intact; inspect desktop and phone widths.
- [ ] Roll a normal check, an advantage check and a disadvantage save. Confirm die + bonus = total and both advantage/disadvantage dice with the kept value. Expand dice details and confirm native tooltips still work. Cancel the dialog and confirm no new message.
- [ ] Set FTH 18: expect 2 Wonder uses. Use Wonder, check the new result and decrement, change an unrelated stat and reload. Restore Wonder: expect 2, with Health/AP/reactions unchanged. Check current/max manual overrides including zero and clearing.
- [ ] Use Wonder on result A: A must show `Wonder used`. Use Wonder on its new result B: B becomes used and result C appears. At zero, C must show `No Wonder uses left`. Refill: only C becomes usable; A/B remain used after reload. Repeat on a GM-rolled initiative message as the owning player.
- [ ] Set FTH 21: use Wonder on a failed check/save and confirm declared success without another dice roll. Initiative must still reroll.
- [ ] Roll initiative from the combat tracker, use Wonder and confirm its total updates. Repeat with linked and unlinked tokens; confirm their own pools change. If combat is deleted, the new result should warn that it needs manual application.
- [ ] Check public, GM, self and blind modes from separate player/GM views. Wonder must preserve the original audience even after changing the chat roll mode; hidden results must not expose totals or actions.
- [ ] Check owner versus observer views, rapid clicks, fresh/reloaded chat history and narrow screens. Native dice tooltips and controls must remain usable.

Wait for the user's Foundry validation before starting the equipment step.
