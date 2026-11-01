# Compact interface

Version 0.14.0 implements the user's request to tighten the interface and make detailed explanations available on demand. This is a presentation pass over the tested Block/Dodge/Parry work.

## Layout

- Resources show current/maximum totals in compact cards. Core numbers and a dedicated Block/Dodge/Parry row follow, then stats and equipment.
- **Adjust values** groups the existing maximum, core-number, armor and inventory overrides. A Custom badge appears when an override or extra armor/evasion correction is active, including an explicit zero override. Clearing and editing behavior stays the same.
- **Rules & help** contains sheet instructions, stat-color/reset behavior, Wonder, armor calculations and inventory guidance. Brief hover tooltips supplement the clickable help controls.
- Roll dialogs show the fields, dice choices and spending controls first. Short current warnings remain visible. Longer rules are under **How Block/Dodge/Parry works**, **Roll help** or **Attack help**. Dice remain the same named radio inputs, arranged as compact choices.
- **Add item** opens creation buttons. Carried totals, backpack, item names and common item actions remain visible. Longer item details open separately. Item sheets group image paths, properties, signature properties, description and guidance into disclosures; selected property names remain visible in their summaries.
- New defense cards show their outcome, target and spending briefly, with fuller application rules behind a details control. Damage breakdowns, signature reminders and consumable descriptions also open on demand. Existing chat messages keep their stored content.
- Native details/summary controls support mouse, touch, Enter and Space. Actor/item disclosures use Foundry's `data-sync` support, which preserves their open state through sheet rerenders. Roll dialogs retain the scrollable content and visible action footer from 0.13.1.
- Navy/brass colors, stat provenance colors and 44px action targets are retained. Resources use two columns on narrow sheets; defense actions stay grouped together.

## Scope and sources

No rules, costs, data-model fields, resource transitions or existing data were changed. The pass adjusts templates/styles, visible wording, property-summary context and where roll information appears. Character/item controls preserve their names, values and disabled state; collapsed controls still participate in form submission.

The website's current [index.html](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/index.html), read 2026-11-01, informed the optional health/vitals guidance and grouped controls. The existing Notion-backed rules documented in BLOCK.md, DODGE.md, PARRY.md, ATTACKS.md and EQUIPMENT.md remain authoritative.

## Validation

`node --test` covers the existing gameplay adapters and calculations. Local checks using Foundry 14.365's real data models and bundled Handlebars compile 42 character/item/dialog/card cases and compare submitted controls against the installed 0.13.1 baseline: names, values, selected/checked states, choice values and read-only protection match. Preparation leaves persisted model data unchanged. New help starts collapsed; escaping and native roll markup are preserved.

The PR records the live Foundry checks completed for the installed commit. Before merging, check:

1. The character sheet's compact resource/core/defense/stat layout, including a narrower sheet.
2. Open Adjust values, edit a correction, and confirm it remains open after the sheet refreshes. Check zero overrides and stat colors/reset behavior.
3. Open Rules & help and each defense/roll help section by mouse and keyboard. Confirm long help scrolls above a visible Roll button.
4. Open Add item, existing item sheets and property/description sections. Check all item types and editable/read-only views.
5. Confirm new roll cards show totals/results and offer details, while spending, damage/healing actions, Wonder and private visibility still behave as before.
