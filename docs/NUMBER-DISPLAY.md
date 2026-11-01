# Whole-number controls and presentation

Version 0.22.0 follows the user's request to hide fractional totals and floor decimal entries while retaining fractional calculations internally. Current website `js/resources.js` was consulted for the existing interface; flooring is the user's explicit Foundry preference. This is presentation/entry handling, not a new rounding rule for combat math.

- Character and equipment number inputs floor typed decimals when committed. Numeric dialogs normalize before submission, including Enter. Stat generation drafts and manual stat edits floor entries before applying earned points/effects. Blank fields still clear/reset exactly as before; invalid input remains subject to existing validation.
- Character/equipment contexts, resource percentages, numeric dialog summaries, consumable counts and visible system dice totals use whole numbers. Round down means `Math.floor`, including negative corrections: −0.2 becomes −1.
- Dice formulas, descriptive text, prices stored as text and meaningful ratios such as 1.5× are not rewritten. Core Foundry windows and third-party interfaces are not globally restyled or intercepted.
- Internal math and data models remain fractional-capable. For a 125-point pool with 4.6 spent, current remains 120.4 internally but shows 120. Spending another 0.5 internally makes current 119.9, displayed as 119. A whole 97% input can represent 121.25 points. The next whole current edit deliberately replaces that total.
- Unchanged displayed totals are omitted from full-form updates, preserving fractional Health damage, AP/current pools, overrides, item fields and resource expenditure when saving unrelated changes. Percentage mode uses the original display unit and revised limits when a deliberate edit is converted back to points. Changing display does not quantize the underlying balance.
- Rendering does not update actors/items. No persisted fields are renamed, removed or changed to integer schemas. Existing rules' rounding, action costs, manual corrections, limits and resource rest behavior are retained. No migration runs.

## Validation

Portable tests cover positive/negative floors, text/formula preservation, event binding/Enter submission, unchanged full-form saves, deliberate entries, stat effects, visible/hidden chat totals and retained resource fractions. Offline checks use Foundry v14.365's actual schema and strict Handlebars libraries for character/equipment rendering and full-form processing. They reproduce 120.4 → 120 and 119.9 → 119 without writing source data.

No live user world/actor data is accessed. The user should restart Foundry/refresh browsers, enter a decimal in a resource/override/item field, check stat editing with an effect, clear overrides, and test save/reload, mobile inputs and simultaneous clients. Live focus/change event ordering and platform/native token HUD presentation still require user testing.
