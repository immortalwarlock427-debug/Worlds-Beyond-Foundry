# Working on Worlds Beyond for Foundry

For Claude, Codex and other assistants. This repository is the Worlds Beyond homebrew as a **Foundry VTT v14 game system**. Read `README.md` and `docs/ROADMAP.md` first. Work on the roadmap in order unless the user says otherwise. Full gameplay rules live in Notion → D&D > Game Systems. Weavecasting is separate.

The Worlds Beyond website (`immortalwarlock427-debug/Worlds-Beyond`) is a separate project. Its rules code (for example `js/combat-core.js`) can be ported here, but don't edit that repository from this one.

Before changing sheet presentation or interaction, consult the website's current UI source to match its behavior and palette. Show one stat score: effective at rest, base while editing. Earned level-up stat points are part of that base and keep its normal color. Gear/effect adjustments use teal, direct edits gold, and a manually edited score with a gear/effect adjustment purple. Notion remains the rules authority.

- **Trust-based character sheet:** players may customize and correct values. Don't add anti-cheat or unsolicited gameplay restrictions.
- **Requested Wonder behavior:** using Wonder requires at least one current use and consumes each roll result only once. Its new reroll result may use Wonder again. Keep the sheet's manual pool corrections editable.
- Reflect the actual rules in Notion. Critically evaluate changes and explain contradictions and consequences. Use 1.5× or 150% notation.
- Build in small steps: get one part of the sheet working and looking right in Foundry before adding the next.
- Use the GitHub noreply email for commits (`314470577+immortalwarlock427-debug@users.noreply.github.com`). Pushes with a private email are rejected.

## Two assistants, one repository

- Never edit `main` directly. Fetch the latest main and create `claude/<task>` or `codex/<task>`. Check other open PRs first. **One branch and PR per task.**
- Prefix every commit and PR title with `Claude:` or `Codex:`, explaining **why**. Use **one commit per logical change**, not one per file.
- Don't force-push main, reset or discard another assistant's work. Work in separate clones or worktrees if sharing a machine.
- Preserve both intentions in noncontradictory conflicts. Ask the DM before resolving conflicting game rules.
- Test before opening a PR. Merge only after the user reviews and approves.

## Foundry guardrails

- **Target Foundry v14** (currently build 365). Use ApplicationV2 sheets (`HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)`), `foundry.abstract.TypeDataModel` data models and namespaced APIs (`foundry.documents.collections.Actors`, `foundry.applications.*`, `foundry.dice.Roll`). Don't use deprecated globals or AppV1 sheets.
- **Never change the system id `worlds-beyond`.** Worlds are tied to it, and renaming it breaks them.
- Data model changes affect actors that already exist. Prefer adding fields with sensible `initial` values. Renaming or removing a field needs a migration, so ask the user first.
- Bump `version` in `system.json` with each merged release.
- Keep the folder layout shallow (`module/`, `templates/`, `styles/`, `tests/`, `docs/`, `packs/<name>/`). Claude copies files into the user's Foundry folder and can reach up to about 6 folders below the system folder.
- No build step. Foundry loads the files in this repository as they are.
- Rules math lives in Foundry-free modules (like `module/stats.mjs`) so it can be tested with `node --test`. Sheets and Foundry hooks import from them and don't repeat the math.
- Scope all CSS under `.worlds-beyond` so it can't restyle Foundry's own windows or other systems.
- Match the Worlds Beyond website's dark theme: navy backgrounds, brass accents, Marcellus SC and Alegreya Sans.

## Testing

- Run `node --test` before every PR.
- Changes to sheets or styles need checking inside Foundry itself. Note in the PR what was checked in Foundry and what wasn't.

## Installing into Foundry

The user's Foundry runs from `%LOCALAPPDATA%\FoundryVTT\Data\systems\worlds-beyond`. It is a plain copy, not a git clone.

The user's latest explicit preference is to install the exact tested commit whenever Codex opens or updates a PR, so they can test before merging. This authorizes Codex branch installation and supersedes the earlier merged-main-only preference. First back up and verify the current system, preserve unrelated files, and never touch world/actor data or program binaries. Verify installed files against that commit and report the PR/version and backup location. Ask the user to restart Foundry and refresh player browsers. The user tests and merges; never merge automatically.
