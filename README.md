# Worlds Beyond for Foundry VTT

The Worlds Beyond homebrew as a Foundry VTT v14 game system, verified against build 365. Rules come from Notion → D&D → Game Systems; the original Worlds Beyond website supplies interface references.

## Character sheet

- **Stats and identity:** eight stats, rolls/Wonder, milestone references, roll-and-assign setup, level-up points, editable identity and notes. A circular portrait, live medallions and four favorite abilities form the Character overview. [Sheet guide](docs/SHEET.md)
- **Resources and rests:** Health, AP, reactions, Wonder, optional Mana/Holy power and custom pools; final maximum/minimum overrides, overflow, percentage displays, solid/gradient colors and configurable recovery. Short rests spend level-based hit dice with VIT; long rests refill them. [Resources](docs/RESOURCES.md) · [Rests](docs/SHEET.md#core-numbers-short-rests-and-hit-dice)
- **Equipment:** native Items, catalog, compact inventory, currency, hand-gear rules, equipped bonuses, consumables and combat equip/stow AP. Seven supplied illustrations use WebP thumbnails. [Equipment guide](docs/EQUIPMENT.md)
- **Abilities and forms:** editable abilities, spell presets, costs, restoration, bonuses, durations, uses/cooldowns, resource triggers, form portraits/token transformations and saved loadouts. Status shows active sources. [Abilities and forms](docs/ABILITIES-FORMS.md)
- **Existing combat support:** weapon rolls, damage previews, Block/Dodge/Parry, Command AP, reload, potion costs and turn refills. Resistance recording is available; damage application remains manual. [Combat guide](docs/COMBAT.md)
- **Interface:** Infinite Archive navy/brass styling, bundled fonts, separate tabs, optional rules/help and editable corrections. Desktop use and ordinary window resizing are the priority.

The implementation is ready for the [final desktop character-sheet audit](docs/CHARACTER-SHEET-AUDIT.md). The audit and any resulting fixes come before wider combat automation, spell visuals or modules. See the [roadmap](docs/ROADMAP.md) for the single completion gate.

## Installing and testing

Copy the system into `%LOCALAPPDATA%\FoundryVTT\Data\systems\worlds-beyond`. Back up the existing system first, preserve unrelated files, restart Foundry and refresh player browsers. Keep the system ID and folder name `worlds-beyond`. Current workflow installs tested PR commits so the user can review before merging; no automatic merges.

With Node 24 or later, run `npm test` or `node --test`. There are no dependencies or build step. GitHub Actions runs the same regression suite on PRs and main. Passing it does not replace the live Foundry audit.

## Repository layout

- `module/`: native models, sheets, hooks and small rules modules. `*-core.mjs` generally contains Foundry-free projections/rules; `*-actions.mjs` adapts dialogs and chat. Pure modules such as `stats.mjs` and `attacks.mjs` also hold rules math.
- `templates/`: shallow Handlebars files, including native character header/tab parts and dialogs.
- `styles/`: system-scoped sheet/chat styles.
- `icons/`, `fonts/`: local visuals, optimized thumbnails and licensed theme fonts. Original image paths remain available for compatibility.
- `tests/`: dependency-free Node rules and adapter regressions. Foundry APIs are mocked where needed.
- `docs/`: five topic guides, the roadmap and one release audit. Older filenames redirect to the consolidated sections for existing links.
- `.github/workflows/`: PR test automation.
- `system.json`: system manifest; `en.json`: English labels.

Contributor workflow, schema compatibility and installation rules are in [AGENTS.md](AGENTS.md).
