# Uses and resource recovery

Recovery is optional. Existing abilities keep manual uses; existing pools keep their balances and long-rest settings. No automatic regeneration rate is invented.

## Configuration

- In an ability's **Uses & cooldown**, set Maximum uses and **Reset uses**: Manual, Long rest, New combat or Own turn. Long rest also refills New combat/Own turn uses; starting combat also refills Own turn uses. Unlimited uses stay unlimited. Recovery notes remain descriptive text.
- In any Mana, Holy power or custom pool's **Settings**, enter a Recovery amount in points. **Recover +N** applies it once manually. **Recover on own turn** opts into that gain when the character's turn begins in a started encounter. Default is 0/off. Hiding Mana/Holy power pauses their automatic turn recovery.
- **Fill on long rest** is now available for Mana and Holy power as well as custom pools. Its existing default is on. Hidden magic pools still follow this setting on rest. Health, AP, reactions and Wonder retain their existing full-rest behavior.

Recovery uses the ordinary resource limits: it retains fractional points internally, caps gains unless Allow over maximum is enabled, and leaves corrections/settings intact. For example, 89.5 Mana with recovery 5 becomes 94.5 internally and displays 94. A Blood pool at 97.5/100 with overflow enabled can recover to 102.5.

Uses recovery does not end active bonuses/forms, reset cooldowns or advance world time. These have separate clocks. This is one editable uses counter per ability, rather than separate outside-combat allowances. Manual corrections remain available.

## Foundry behavior and data

Only the active GM performs automatic encounter/turn recovery. Native combatant actors are used, including unlinked tokens. Adding a participant to a started encounter applies its configured New combat reset. A session flag is assigned in the native combat-start update; persisted actor receipts prevent duplicate hook events/reconnects from repeating recovery. Moving backward does not grant it again; moving forward beyond the last processed turn does. Restarting an ended encounter creates a new session. There is no automatic recovery outside started encounters.

Updates share the actor action queue with sheet edits and payments. Ability use resets compensate if a later update fails; resource gains and the event receipt commit together in the final Actor update. Failures report the actor and remain retryable. This is local client serialization, not a distributed transaction across simultaneous GMs.

Additive fields: `system.uses.resetOn` on Ability Items (default `manual`), and `regen` (0), `autoRecover` (false), `refillOnRest` (true) on magic pools. Custom pools retain their existing `regen`/`refillOnRest` paths and gain `autoRecover`. Runtime receipts use `flags.worlds-beyond.recovery` and combat session flags. No saved fields are renamed or removed; loading/rendering does not reset trackers.

## Sources and validation

Consulted the website's current `js/resources.js` and `js/abilities.js` for manual recovery, rest settings and use-reset policies. Notion's [Magic System](https://www.notion.so/351c72092efb81ad8887d6ab65b8cab6) prescribes INT/FTH × (level + 2), without a universal regeneration rate. These controls configure individual records and do not introduce a new global rule. Foundry v14.365's native combat lifecycle was inspected locally; `combatStart` precedes the saved update, so the new session is written in that update instead.

Portable tests cover policy selection, finite/unlimited uses, fractional gains, overflow, hidden/manual pools, rest opt-out, repeated/rewound turns, reconnect/session receipts and compensation after failed item/actor updates. Offline native v14 schemas and strict Handlebars checks verify defaults, existing trackers, whole-number presentation, out-of-combat Command totals and owner/read-only rendering. Headless layout checks cover 760/390/340 px widths with 44 px recovery controls.

Not yet exercised in the running world: the new controls, live combat hooks, socket persistence, multiple clients, player permissions, token actors and real mobile focus/scrolling. Before merging, restart Foundry and refresh player browsers. Configure one ability for each reset mode, spend uses, test long rest/start/next turn, and check an unchanged manual ability. Spend Mana, set recovery 5/on, advance its own turn and verify only one gain. Test overflow Blood, hidden Mana, long-rest opt-out and an unlinked token. Confirm cooldowns, active forms and base stats remain as configured.
