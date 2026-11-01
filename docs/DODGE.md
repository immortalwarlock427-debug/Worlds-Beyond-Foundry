# Dodge reaction

The user confirmed Block works before authorizing this next small part of roadmap step 5. Version 0.12.0 adds Dodge; Parry and incoming-attack association follow later.

## Sources

Read on 2026-11-01:

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d): d20 + AGL, direct-attack and area-save comparisons, natural 20 exclusion and reaction use.
- Notion [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de): heavy armor without 21 STR gives disadvantage on Dodges and AGL saves.
- Website [defense controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js) and [defenseResult in js/combat-core.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/combat-core.js): incoming attack/save target, dice + modifier, result wording and forced success. Foundry reuses its existing check/Wonder cards instead of porting DOM code. Notion remains the rules authority.

## Behavior

- Click **Dodge** beside Block under **Worn armor and corrections**. It uses the prepared AGL modifier, including armor penalties and automatic adjustments.
- Choose a direct attack or area attack save. Enter the attack total/save DC, or leave it blank for manual comparison. An explicit zero is a valid target. Direct Dodge must **beat** the attack total; a tie fails. Area Dodge must **meet or beat** the save DC and halves damage on success, before Resistance and Armor Rating. A failed roll leaves full damage for subsequent defenses.
- A direct attack that rolled a natural 20 cannot be Dodged. Marking that checkbox reports the rule and spends nothing. That direct-attack flag does not apply to an area save. Non-attack area effects, such as mind control, cannot be Dodged; eligibility remains the player's decision. The defender's own natural 20/1 does not automatically succeed/fail.
- Normal, advantage and disadvantage use the same readable cards as checks/saves. Heavy armor disadvantage is preselected when the prepared equipment data says it applies; players may choose different dice for other effects/corrections. The card notes when a different mode was selected despite that condition.
- **Spend 1 reaction** defaults on for an actor in a started combat, otherwise off. It spends one current reaction and no AP. With no reactions available, correct the pool or explicitly untick spending. Health and Wonder remain unchanged by the initial Dodge. The shared local action queue prevents Dodge and Block from spending the same final reaction on one client.
- Dice/template failures do not spend. A failed chat post refunds the spent reaction; failed recovery reports manual correction. Chat visibility uses Foundry's public/GM/blind/self modes, and blind dice disable interaction.
- Dodge is a non-attack d20 check, or a save for an area attack, so its card supports **Wonder**. A reroll retains its original modifier, dice mode, target, direct/area choice and private audience, then recomputes the result. It spends Wonder without another reaction. At FTH 21, Defy Fate declares success, giving full avoidance for direct Dodge or half damage for an area save. A result uses Wonder once; its new reroll may use it again as before.
- Apply Health changes manually. Select the incoming total/DC yourself; there is no connection to an attack chat card yet. Once-per-incoming-attack use, distances and effect eligibility remain manual. A failed Dodge can be followed by Block or Parry with another reaction. Overwhelming Force does not stop a successful direct Dodge, but may raise damage back to its floor after an area save and other mitigation.
- No actor/item data fields changed. New Dodge chat messages store their comparison context in the existing system check flag, allowing Wonder to retain it. Old check/save/initiative/Block cards retain their behavior.

## Validation

`node --test` covers direct/area ties, blank and zero targets, natural 20 exclusion, forced success, invalid input, prepared modifiers, heavy-armor defaults/corrections, all dice and chat modes, dialog cancellation, reaction refunds, competing Block/Dodge spending, permissions, readable cards and Wonder/Defy Fate integration. Existing tests cover per-result Wonder limits and failed posting recovery.

Local smoke checks use Foundry 14.365's real data model and bundled Handlebars to compile the editable/read-only sheet, all spending/armor dialog combinations, direct/area outcomes, manual comparison, zero targets, Wonder/Defy Fate and ordinary roll cards. No live Foundry world, sockets, actual dice UI or phone layout was exercised. Local queues do not coordinate separate clients.

Test the installed branch before merging:

1. Restart Foundry and refresh player browsers. Find **Dodge** under armor corrections and check its AGL modifier against the sheet.
2. Try direct and area rolls with a target, including a tie. Direct ties fail; area ties halve damage. Leave the target blank and confirm the card gives a manual comparison reminder. Try zero explicitly.
3. In combat, roll with reaction spending checked: exactly one reaction should be spent, with no AP/Health/Wonder change. Outside combat it should default off. Cancel and confirm no changes. At zero reactions, unticking spending should still allow a practice roll.
4. Mark an incoming direct natural 20 and confirm it reports that Dodge is unavailable without spending. Area attacks use the save DC; non-attack effects remain ineligible.
5. Wear heavy armor below 21 STR and check disadvantage is preselected; change the dice to verify manual corrections remain available. Check both dice and the kept result appear clearly.
6. Use Wonder on a failed Dodge, then on its new result. Confirm the target/modifier persist and only Wonder is spent. At FTH 21, check direct Dodge declares no damage while an area save declares half damage.
7. Check public/GM/blind/self visibility from GM and player browsers, an unlinked token's reaction pool, narrow sheet/dialog layout, and turn-start refills. Apply Health changes manually.
