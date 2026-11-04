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

## After the gate

1. **Combat resolution:** apply damage/healing consistently, using Resistance → Armor Rating → Block → Overwhelming Force. Review the existing [combat support](COMBAT.md) before expanding it.
2. **Movement and reactions:** movement AP and difficult terrain, then opportunity prompts when a creature leaves an armed character with an available reaction. No standalone React button.
3. **Milestone actions:** add agreed buttons and usage trackers after checking each rule in Notion.
4. **Ability targeting and areas:** spell attack/save/damage resolution, simple cone/area configuration and target selection.
5. **Conditions:** settled Notion definitions for bleeding, burning, downed/0 Health, exhaustion and similar statuses.
6. **Optional visuals/modules:** evaluate compatible effects and supporting modules once the mechanics work. No modules are installed by this sheet task.

## Optional maintenance requiring a later decision

- GitHub release/manifest installation: retain the current verified-copy workflow until requested.
- Delete stale remote branches only after the user approves a concrete list.
- Real data migrations require an approved schema change, a verified world backup and compatibility tests. The current schema runner does no migration or world-data rewrite.

## Topic guides

[Sheet](SHEET.md) · [Resources](RESOURCES.md) · [Equipment](EQUIPMENT.md) · [Abilities/forms](ABILITIES-FORMS.md) · [Combat](COMBAT.md)

These consolidate the earlier per-PR notes and their detailed regression cases. Version-specific counts and observations in those reference sections are historical; release status is tracked only here and in the audit.
