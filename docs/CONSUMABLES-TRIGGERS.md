# Consumables, overflow and form triggers

These are opt-in character customizations requested by the user. They do not add a universal overflow/transformation rule to Worlds Beyond. Existing characters, consumables and manually selected forms retain their previous behavior.

## Consumables

Open a consumable and choose **Restore → Health, Mana, Holy power or an available custom resource**. Enter an **Amount or dice**, such as `20` or `2d6+2`. The unit is points or a percentage of the target's maximum, not its current balance. Custom resource links use stable IDs; names never silently select a different pool. Missing/hidden targets are identified and cannot consume an item. World Items can reference standard resources; choose custom pools on the character's owned copy.

**Bonuses → Add bonus** uses the same signed stat/defense/movement/resource-maximum editor as abilities. Carrying the consumable does not grant its bonuses. Leave restoration blank for a pure stat tonic, or combine restoration with bonuses. One restoration target and multiple bonus records are supported per item.

**Use** spends the item and its existing potion AP cost and posts the roll/card. **Apply benefits** applies its restoration and bonuses together to the user. Applied copies are native actor-owned Active Effects, grouped by that use in Status. They last until ended there and survive deleting or using up the original item. Different uses have independent groups and stack; there is no unrequested stacking restriction. End disables every bonus from that use without changing the item's definition. They are not added to the Abilities list. Automatic expiry and targeted ally application are later work.

Restoration preserves expenditure/fractions and caps at the normal maximum unless overflow is enabled. If no restoration is possible and no bonuses are configured, Use spends nothing; a previously paid card refunds its recorded item/AP cost once if the pool became full before Apply. A stat tonic remains useful at full Health: its bonuses apply and its cost remains paid. Partial healing reports the amount actually restored. Failed application compensates restoration and created bonuses and leaves the paid card retryable. If partial bonus cleanup itself fails, End the remaining group in Status before retrying; the card does not duplicate an active group. Old cards lacking cost receipts still require manual refunds.

## Overflow

Enable **Resource → Settings → Allow over maximum** to let Restore/Recover and consumables gain beyond the normal cap. Health has **Adjust values → Allow Health over maximum**. Defaults are false, so existing healing/full-pool refunds and caps are unchanged. Manual Current corrections stay unrestricted regardless of this setting.

The normal maximum remains unchanged. Blood can show `105 / 100`, or `105%` in percentage display; the fill meter stops visually at 100%. Spending uses the existing minimum floor. Fill and configured long-rest recovery return to the normal maximum. Stat scaling and final maximum overrides keep their existing math.

## Form triggers

On a native Form Item, expand **Trigger**. Choose a resource, comparison and threshold in points. A blank threshold follows the resource's current maximum. New Add form records default to **Ask first** and **Ask to end**, with no resource selected until configured. Older forms default to Manual. Manual, Automatic, and Ask first remain configurable; ending can Ask to end, Keep active or End automatically.

For the user's Blood example:

1. Set Blood's normal maximum to 100 and enable Allow over maximum.
2. On the form, choose Ask first, Blood, Above, threshold 100 (or blank to follow its maximum), and Ask to end.
3. Raising Blood from 100 to 105 asks whether to enter the form. Accepting uses the normal form activation and its configured costs; leave entry costs blank for a free transformation. Cancelling pays nothing.
4. Dropping to 100 or below asks whether to end the transformation. Declining keeps it active. Accepting ends it for free. Unrelated updates below the threshold do not repeat the question.

Triggers detect crossings, not a condition that continuously forces a form. Manually ending above the threshold does not re-enter on the next unrelated edit; drop back and cross again to re-arm. While a prompt is open, the current value and permissions are checked again before paying. Multiple matching forms ask which one to enter instead of charging for several switches. Missing pools stay dormant, with no deletion or rebinding. A failed cost/payment reports the problem and preserves the triggering resource; it does not force a transformation.

The initiating owner executes the hook once. An actor queue serializes activation with payments, and trigger-generated cost updates are excluded from recursive triggering. Actor/resource updates (including Current edits, Spend/Restore/Recover, rest, Health changes and consumable restoration) and trigger-setting edits are observed. No render/load writes or canvas movement hooks are added. Derived maximum changes caused only by equipping gear or adding an effect are not independent trigger events in this first implementation. Form portraits, gear/ability/resource loadouts and a general event/condition editor remain later work. Old actor-owned saved forms remain usable but need a new native Form Item to use this trigger editor; no automatic conversion is run.

## Data and sources

All changes are additive: resource/Health `allowOverflow` (false); consumable `restoreTarget` (health) and `restoreUnit` (points); Ability `trigger` settings. The existing `healingDice` text remains the amount/formula storage, so old items continue to heal Health. Consumable definitions use native `system.changes`, transfer false, and namespaced source flags. Applied copies use a namespaced per-use group ID. No existing field is renamed or removed.

Notion [Magic System](https://app.notion.com/p/351c72092efb81ad8887d6ab65b8cab6) supplies unchanged stat scaling and expenditure behavior; [Action Points](https://app.notion.com/p/406c72092efb81a491b3e7dc50e9ba73) supplies the existing potion cost. The website's current `js/abilities.js` and `js/resources.js` informed source-owned effects, manual forms and stable custom resource IDs. Overflow and prompt behavior follow the user's explicit customization request.

## Validation

Portable tests cover all restoration targets, fractions, old full-Health behavior/refunds, overflow without a cap change, buff-only/mixed consumables, partial creation rollback, Status grouping/ending after source deletion, exact threshold boundaries, prompt acceptance/cancellation, stale prompts, re-arming, independent ending, simultaneous forms, payments and single-client authority. Offline installed v14.365 fields and strict owner/observer templates verify defaults, saved-source immutability, Blood 105/100, native STR +3 taking 18 to 21/+4, trigger schemas and escaped names. Headless editor previews check phone/desktop widths; these use a simplified frame, not a live Foundry world.

Live checks: use Health/Mana/custom tonics and pure stat tonics; apply at full pools, remove the original item, End grouped bonuses, test refunds/failures and reload. Exercise 100→105→100 with both prompts, declining exit, re-crossing, a pending prompt while values change, multiple forms, two connected owners/GM and an unlinked token. Check scroll, autosave and native document lifecycle after restarting Foundry and refreshing browsers.
