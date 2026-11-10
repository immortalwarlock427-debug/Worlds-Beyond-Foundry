# Roadmap

## Approach

Use Notion → D&D → Game Systems as the rules authority. Consult the original Worlds Beyond website for UI behavior. Port Foundry-free rules, rebuild native sheets/chat, and use Foundry's canvas, combat tracker, Items and Active Effects. Keep the sheet editable and trust-based. Desktop is the priority; phone-specific work is deferred.

## Current gate: final character-sheet audit

Pre-audit implementation is complete on the review stack. The [desktop audit](CHARACTER-SHEET-AUDIT.md) is the single list of live validation still required. Passing tests and earlier user spot-checks do not close this gate. Fix any defects found before moving into wider combat, spell effects or module integrations, and explicitly tell the user when the sheet gate is closed.

Implemented scope:

- Stats/identity, generation and level-up points, modifiers and milestone reference, readable rolls/Wonder and editable overrides.
- Resources, bounds/overflow, points/percentage presentation, colors, recovery, short-rest hit dice and long-rest refills.
- Native equipment/catalog, currency, bonuses, consumable benefits/durations, resistance recording, hand-gear rules and combat equip/stow costs.
- Abilities/spell preset, costs/restoration, uses/cooldowns, active Status, forms/triggers, shared loadouts and token transformations.
- Infinite Archive overview and polished tabs, four favorites, optional help, bundled fonts and optimized equipment thumbnails.
- Template/context cleanup, rules regressions, automated PR tests, a no-op schema migration framework and consolidated documentation.

Latest decisions: combat equip/stow costs cover weapons, shields and armor; spells use an Active preset with 11 AP and INT/FTH choice. Equipment changes outside combat remain free. See [equipment](EQUIPMENT.md) and [abilities](ABILITIES-FORMS.md).

Roman's queued token-image optimization was completed through the live Form editor on 2026-11-03: Monstrous now points to `worlds/echoes-of-the-end-ver-1/tokens/roman-solvaris-monstrous.webp`. Closing/reopening retained the path. The existing 2×2, scale 1.15 and current 1.25-second transition were preserved. The 105,408-byte image was opened and inspected. Activation/animation is left for the user audit; the PNG and legacy macro remain.

Day/night fade (requested 2026-11-04, outside the gate because it changes no character data): every scene darkness change fades over a world setting, **Day and night fade (seconds)**, default 10 and at most 60. This covers Calendaria time jumps (which otherwise snap for jumps of an hour or more), Foundry's Day/Night buttons and Scene settings edits. 0 hands fades back to Foundry and other modules. Code: `module/darkness-fade-core.mjs` and `module/darkness-fade.mjs`.

## After the gate

1. **Combat resolution:** in progress. Targeted attacks and abilities now ask the defender to Dodge, Parry, save or Block and apply damage through Resistance → Armor Rating → Block → Overwhelming Force ([automatic attack resolution](COMBAT.md#resolution)). Immunity (recorded with resistances) stops a hit's damage, and abilities can heal targets or everyone in an area through the same flow ([immunity and healing](COMBAT.md#resolution)).
2. **Movement and reactions:** done. Movement AP, difficult terrain, heavy armor's 10 ft squares and Surge's free movement AP (see [movement AP](COMBAT.md#movement)), and opportunity prompts when a creature leaves an armed character's reach (see [opportunity attacks](COMBAT.md#opportunity)). No standalone React button.
3. **Milestone actions:** first version in place ([milestone actions](SHEET.md#milestone-actions)). Unlocked milestones you use (Titan's Might, Indomitable, Stratagem, Absolute Comprehension, Sixth Sense, Eyes of Truth, Commanding Presence, Miracle) have a Use button and a uses tracker on the Abilities tab; Singularity is declared in the attack dialog. Rules checked against Notion on 2026-11-09. Pushes, statuses, the ally's Stratagem bonus and GM answers stay manual.
4. **Ability areas and map effects:** first version in place ([areas](COMBAT.md#areas)): single target, circle, around you, cone and line, multi-target resolution and built-in Lightning/Fire/Ice/Arcane/Holy/Shadow/Poison/Force effects. Original goal: each ability can set a shape (single target, line, cone or circle) with its size and range, plus a visual preset (lightning, fire, ice and similar) whose color can be changed. Using the ability shows the area and effect on the map and selects the targets inside it, then resolves its attack, save and damage. Cover most basic abilities; unusual ones such as Authority of Law stay manual. Animations can use Sequencer with JB2A when installed, with a plain colored area otherwise.
5. **Conditions:** in progress. Notion's statuses are in the token HUD with their rules, and Bleeding and Burning deal their turn-start damage, start from Bleed weapons and end through healing, Shake It Off and putting out the flames ([conditions](COMBAT.md#conditions)). Death and Dying is in too: Unconscious at 0 Health, Death's Mercy, Bleeding Out, stabilizing, treatment, Trauma and death at the threshold ([death and dying](COMBAT.md#dying)). Exhaustion levels 0–10 now apply attack dice penalties, AP reductions, disadvantage, movement ×2, halved Health, Prone and collapse, with Overexert, Knocked Out and long-rest recovery ([exhaustion](COMBAT.md#exhaustion)). Status-driven weapon/ability attack dice, checks, Dodges, sensory failures and close Paralyzed criticals are now included ([status roll effects](COMBAT.md#status-effects-on-rolls)). Next: the remaining condition movement/actions and source-aware interactions. Open rules: advantage/disadvantage cancellation, Prone/exhaustion movement stacking and rounding halved Health.
   Incapacitation's AP/reaction limits are included (0.52.0); see [incapacitation](COMBAT.md#incapacitation-and-actions). Prone movement, Stand up, Grappled/Restrained immobilization and Escape checks with Wonder are included in 0.53.0; see [mobility actions](COMBAT.md#prone-standing-and-escaping-a-grapple). Prone/exhaustion default to the larger ×2 penalty, with an explicit setting for multiplication to ×4 pending a ruling. Petrified resistance and immunity to new native Actor status effects are included in 0.54.0; see [Petrified](COMBAT.md#petrified-resistance-and-status-immunity). Unconscious now releases held gear, leaves Prone and wakes positive-Health knockouts on damage (0.55.0); see [Unconscious](COMBAT.md#unconscious-held-gear-and-waking). Explicit source links for Grappled/Frightened/Charmed and linked current-STR Escape checks are included in 0.56.0; see [condition sources](COMBAT.md#condition-sources-and-linked-grapple-checks). Linked Frightened sight-wall roll defaults and square-grid movement checks are included in 0.57.0; see [linked Frightened rules](COMBAT.md#linked-frightened-rules). Linked Charmed target protection and explicit interaction-check advantage are included in 0.58.0; see [linked Charmed rules](COMBAT.md#linked-charmed-rules). Combined opportunity readiness is included in 0.59.0: warnings and delayed prompts respect linked Charmed, incapacitation, current reactions and current melee gear, with a final stale-weapon guard; see [opportunity attacks](COMBAT.md#opportunity). The inactive-encounter tracker refresh guard is included in 0.60.0; see [tracker refreshes](COMBAT.md#tracker-refreshes-across-encounters). Shake It Off condition/exhaustion dice, editable recovery dialog and Wonder/Defy Fate are included in 0.61.0; see [recovery checks](COMBAT.md#shake-it-off-checks). Turn-start damage serialization and actual Health-loss receipts are included in 0.62.0; see [turn-start damage](COMBAT.md#turn-start-damage-receipts). Next: continue the combined combat review and remaining desktop/player validation. No distance-based grapple-release rule has been inferred. Other open rounding/cancellation rulings above are unchanged.
6. **Optional visuals/modules:** evaluate compatible effects and supporting modules once the mechanics work. No modules are installed by this sheet task.

## Optional maintenance requiring a later decision

- GitHub release/manifest installation: retain the current verified-copy workflow until requested.
- Delete stale remote branches only after the user approves a concrete list.
- Real data migrations require an approved schema change, a verified world backup and compatibility tests. The current schema runner does no migration or world-data rewrite.

## Topic guides

[Sheet](SHEET.md) · [Resources](RESOURCES.md) · [Equipment](EQUIPMENT.md) · [Abilities/forms](ABILITIES-FORMS.md) · [Combat](COMBAT.md)

These consolidate the earlier per-PR notes and their detailed regression cases. Version-specific counts and observations in those reference sections are historical; release status is tracked only here and in the audit.
