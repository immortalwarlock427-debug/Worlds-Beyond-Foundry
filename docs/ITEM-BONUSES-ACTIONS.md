# Item bonuses and combat actions

This implements the user's combined request: equipment/ability stat bonuses, a separate Effects & Statuses tab, opportunity attacks, Command AP and potion AP. The explicit request resumes these combat actions after the base sheet work.

## Equipment bonuses

Open a Weapon, Armor or Shield Item and choose **Bonuses → Add bonus**. Open its bonus, choose a target such as Strength score and enter 3. The native Active Effect is stored inside that Item and transfers to its owning actor only while equipped. Stowing or removing the item removes its contribution; re-equipping restores it. Equipped quantity does not multiply bonuses. Stat bases are never rewritten.

Targets are all eight scores, Armor Rating, Natural Evasion, movement/AP, Mana/Holy power maxima and existing custom-resource maxima. Negative amounts are penalties. Modifiers, milestones, defenses and scaling resource maxima use the resulting score. Existing teal/gold/purple stat presentation and final manual overrides remain.

The same Item can have multiple bonus records and multiple adjustments in each record. Bonuses can be disabled individually or removed with confirmation. World Items/compendiums carry their native embedded effects when copied; no second actor-effect copy is created. Custom resource IDs stay explicit and missing targets remain dormant.

## Ability bonuses and Use

On an Ability Item, use **Bonuses → Add bonus**, for example Dexterity score +2. A **Passive** ability applies enabled bonuses while owned. Other types apply them while `effectsActive` is true.

On the character's Abilities tab:

- **Use** pays the recorded AP cost in combat, using the selected current stat discount and existing half-base cap. Outside combat it spends no AP. Resource costs and tracked uses are paid in either case. Percentage costs use the resource maximum and keep fractional points internally; negative resource minima remain valid spending floors. Mana/Holy power must be enabled before paid use.
- Use starts the recorded cooldown and enables the ability's self bonuses. Reaction-type abilities also spend one reaction in combat. Missing resources, insufficient AP/resources/uses, remaining cooldown or an unavailable reaction report an error before activation. Existing editable trackers allow corrections.
- **End** disables the self bonuses without charging or refunding costs. Rapid repeated Use on an already active bonus ability does not pay twice or end it. Abilities without bonus records stay usable as repeated actions rather than becoming toggles.
- The Item's **Bonuses active (manual correction)** checkbox can correct activation without making a payment. Individually disabled bonus records remain disabled. Passive ability changes use the normal type selector; their bonuses do not need Use.

Costs use the pre-activation resource maximum/stat. Health damage and resource expenditure survive bonus changes. Failed document/chat operations compensate AP, resources, reaction, uses, cooldown and activation; failed compensation requests manual correction. Durations remain free text, cooldown countdown/recovery and uses recovery remain manual. This step does not add targeted buff delivery, ability attacks/damage/saves, templates or animations. Newly dropped active abilities start inactive; passive abilities still apply normally.

## Effects & Statuses

This separate fifth tab holds forms, manual adjustments/statuses and a source overview of native item effects. It does not replace Item bonuses. Linked bonuses are edited on their source or through the source row; changing equipment/ability state controls whether they apply. Existing standalone effects/forms are retained. No unsettled bleeding/burning/status rules or token-condition automation is invented.

Managed item bonuses alone use the new equipped/ability gate. Unrelated native effects retain their existing transfer/suppression behavior. Expired or disabled native effects remain inactive.

## Opportunity attacks

**Equipment → React** on an equipped weapon opens the existing attack dialog in opportunity mode. It spends one reaction and no AP, uses one weapon, and retains normal dice, stat choice, loading/shots, damage and linked-defense cards. Unticking reaction spending makes a practice roll; loading weapons still use shots as in existing practice attacks. A failed post restores reaction and shots.

Trigger, reach and exceptions are resolved at the table; token movement does not auto-trigger attacks. The target's current AGL 28 Flicker is shown and makes the opportunity card unable to hit, including a natural 20; ordinary attacks retain their previous outcome. Manually resolve an exceptional immunity bypass.

## Command

**Character → Command** selects an ally. It costs a fixed **5 own AP**, without CHA discount and without paying from another Command grant. It offers **2 + CHA modifier**, capped at **5** (no positive grant below zero). The ally receives the higher of their remaining grant and the new amount, never their sum.

Command AP is a separate green amount under Action Points, not added to the normal maximum. Normal attacks, reloads, potions and ability AP payments use it first on the ally's turn. Off-turn payments cannot use it; manual ordinary AP corrections stay editable. Adjust values includes a Command AP correction.

The grant is ready for the current turn if received then, otherwise the next incoming turn. A pending grant survives that turn's normal refill; it clears at the following turn start. Long rest clears it. This adapts the website's separate grant/fresh-turn tracking to Foundry's combat hook rather than allowing the refill to erase it.

The commander posts a grant card after paying. If they own the recipient, delivery is attempted immediately. Otherwise the active GM handles it from the native create-message hook. Without an active GM, or if delivery fails, the recipient owner/GM uses **Receive Command AP** on the card. A per-recipient message receipt makes retries idempotent without requiring the recipient to edit another player's ChatMessage. Delivery failure keeps the paid offer claimable; it does not refund a successful offer and permit a second free grant. Failure to post the offer refunds the commander. Hidden combatants are excluded from player selection. Target eligibility as an ally remains a table decision.

## Potions and AP

Using a Potion in a started combat spends **5 AP adjusted by DEX**, bounded to **3–7**, and one item. Eligible Command AP pays first. Outside combat it costs no AP. Other consumable kinds retain their prior behavior. Healing dice still post the existing confirmation card; healing is not silently applied. Insufficient AP leaves quantity unchanged, and posting/update failure restores payment and quantity.

## Sources and formatting

- [Notion Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73): potion cost, DEX item-action discount, half-base cap, fixed Command cost and non-stacking grant.
- [Notion Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c): Command grant and use on the ally's turn.
- [Notion Defenses](https://app.notion.com/p/406c72092efb81088e3be6e9d3b2c44d): opportunity attacks spend a reaction and no AP. [Agility](https://app.notion.com/p/351c72092efb812cae19fb7713e9e76b): Flicker immunity.
- Website `js/abilities.js`, `js/combat-core.js`, `js/character-core.js` and `js/encounter-actions.js`: source-owned effects, cost preflight, separate Command AP, spending grants first and turn freshness. Notion remains authoritative; unrelated website stat/milestone discrepancies are not ported.
- Formatting references: [D&D5e's native effect guide](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide) and [Nimble's item activation/effect editor](https://nimble-co.github.io/FoundryVTT-Nimble/documentation/homebrew/activations.html). These informed source-owned bonus sections, compact named rows and distinct activation controls. Their rules, field names and implementation are not copied.

## Data and validation

Additive fields: Ability `system.effectsActive` (false); Actor `system.command.value` (0) and `fresh` (false). Item Active Effects use existing v14 `system.changes`, `transfer: true`, and namespaced `managed`/`itemBound` flags. Recipient `flags.worlds-beyond.commandClaims` records delivered message UUIDs. Existing data fields are not renamed or removed and no world migration is run.

Portable tests cover equipment/ability gates, native item-effect creation, permissions/stale editors, activation payments/refunds/cooldowns, percentage fractions, reaction abilities, opportunity payments/refunds/Flicker, potion costs/refunds, separate AP spending, Command ownership/delivery/retry/non-stacking/failure, native turn rollover and existing regressions. Offline installed v14.365 data fields and strict templates verify the sword +3 STR / ability +2 DEX examples through equip/active/passive/removal, effective modifiers and unchanged bases. A document adapter is used offline; this is not a live native document-lifecycle test. The five-tab populated Chromium preview checks desktop/phone widths with a simplified frame.

User checks after restarting Foundry and refreshing browsers:

1. Create a +3 STR sword bonus; equip/stow/delete/copy it. Check teal effective score, base editing, modifiers, milestones, source labels and resource maxima.
2. Create +2 DEX on an active ability, set costs/uses, Use/End and repeat as Passive. Check costs, cooldown correction, source removal, reload and a native world/compendium drop.
3. Use React with reactions available/empty, normal and advantage dice, a loading weapon and a Flicker target. Check no AP payment and normal damage/defense cards.
4. Command between two owned actors, then two player owners with an active GM and without one. Test delivery retry, no stacking, payment priority, pending/active turn grants, next-turn expiry and long rest. Check unlinked token actors.
5. Use potions in/out of combat with DEX bonuses/penalties, insufficient AP and Command AP. Confirm quantity, healing confirmation and balances.
6. Check read-only sheets, item editors, five tabs and phone layout. Native multi-client lifecycle, actual server permissions/GM hooks, real drops and UI rendering remain for live validation. The assistant did not access or edit live actor/world data.
