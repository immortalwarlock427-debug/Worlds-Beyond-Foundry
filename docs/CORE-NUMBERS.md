# Core numbers

Roadmap step 1 adds current Health/AP/reactions, automatic maxima, hit die, Natural Evasion, Armor Rating and feet per AP. All maxima and derived numbers have manual overrides; clearing an override restores the rule. Armor contributions are entered manually until the equipment step. Automatic turn resets, short-rest rolls, equipment penalties and token movement spending belong to later steps. The rolls step adds Long rest to refill Health, AP, reactions and Wonder.

## Rules checked

Checked against Notion on 2026-10-31:

- [Stats](https://www.notion.so/351c72092efb81baaae9c21636d2dee4): current VIT × level for Health, matching changes to current Health, the hit-die chart, Evasion and reaction milestones.
- [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73): 15/17/19/21/23 AP at levels 1/5/10/15/20; movement has a 5 ft per AP floor.
- [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) and [Vitality](https://www.notion.so/351c72092efb813e9ab9c1193bdcbb47): Armor Rating has a zero floor. At current VIT 28 or higher, Adamantine Body replaces the VIT modifier with half VIT, rounded down, before adding armor.

The hit-die lookup is ported from the website's [combat-core.js at f6cfc79](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/f6cfc79e077d1354ca2be7004ef099c2e30d9da1/js/combat-core.js). The website's historical rolled-Health formula is not ported: it disagrees with the current Notion rule. The roadmap's shorthand also omitted the movement/AR floors and Adamantine Body; this implementation follows Notion. No website files are changed.

## Data and token behavior

- Existing `level` and `stats.<key>.value` fields are unchanged. New schema fields have defaults, so old actors acquire the new numbers when loaded.
- `health.damage` stores the difference between maximum and current Health. Derived `health.value` and `health.max` are not saved. For example, 41/60 Health means 19 damage; increasing maximum to 80 gives 61/80, and reducing it to 60 restores 41/60. This also works when prepared VIT changes through an Active Effect. No preparation hook writes to the database.
- `ap.value` and `reactions.value` start at `null` (full at the current maximum). Once a current value is entered, it stays at that value until corrected. Clearing a current pool returns it to full. No turn hooks are added yet.
- `health.maxOverride`, `ap.maxOverride`, `reactions.maxOverride` and numeric fields under `overrides` use `null` for automatic. `overrides.hitDie` uses a blank string. Explicit zero overrides are preserved.
- `bonuses.armor` and `bonuses.evasion` are manual equipment contributions. `overrides.armorRating` and `overrides.evasion` replace the complete final values.
- Corrections may be negative or above maximum; there are no new gameplay restrictions. The automatic formula floors do not clamp manual overrides.
- Bars use `health`, `ap` and optionally `reactions`. Newly created characters default to Health/AP unless the creation data already supplies those bar settings. Existing tokens and prototype tokens are not rewritten; choose the attributes in Token Configuration → Resources. Bar visibility remains the user's Foundry setting.
- Health edits on the sheet and through `actor.modifyTokenAttribute("health", value, isDelta, true)` convert to `health.damage`. Macros should use that method for current Health, rather than persisting the derived `system.health.value`. Direct damage corrections use `actor.update({"system.health.damage": amount})`.

## Validation

The user confirmed the installed core-numbers release works in Foundry on 2026-10-31 and authorized the rolls step. The detailed checklist below remains available for regression testing; that confirmation does not imply every listed scenario was individually verified.

Automated: `node --test` covers the Notion chart, level/milestone boundaries, movement and AR floors, zero/blank overrides, Health increases/decreases, token corrections and full-form submissions. Adapter tests use lightweight Foundry stubs; they do not exercise the world server, canvas or actual ApplicationV2 lifecycle.

Additional local checks used the installed Foundry **14.365** TypeDataModel/field classes for defaults, persisted versus derived fields, serialization/reload, prepared VIT changes and zero overrides. The actual Handlebars template compiled with representative sheet context. These checks did not launch or modify the installed world. Browser visual preview was unavailable because the browser tool blocked the local file URL.

In-world regression checklist:

- [ ] Open an existing character and a new character; confirm no data is lost and defaults render.
- [ ] At level 5/VIT 12, set Health to 41/60. Raise VIT to 16: expect 61/80; restore VIT: expect 41/60. Reload and repeat using a temporary VIT Active Effect.
- [ ] Check VIT 27/28/29/30, AGL 20/21/27/28, levels 4/5/9/10/14/15/19/20, armor contributions and clearable overrides, including zero.
- [ ] Correct Health below zero and above max on the sheet and token HUD; check AP/reactions likewise. Changing unrelated fields must not heal or refill pools.
- [ ] Confirm Health/AP bars on new tokens and select them on an existing token. Check linked and unlinked tokens, saving and reloading, and updates visible to another connected player.
- [ ] Check the sheet at 320/390 px and desktop width: no horizontal overflow, reachable controls, scrolling and focus. Check observer/read-only views and stat click-to-roll.
