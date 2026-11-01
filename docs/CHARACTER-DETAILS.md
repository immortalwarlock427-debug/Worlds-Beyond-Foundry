# Character details and notes

Open **Character details & notes** below Equipment. The section stays collapsed until opened, with entered Class/Race shown in its summary. It uses the same navy/brass palette as the rest of the sheet. Native disclosure synchronization keeps its open state during sheet refreshes.

- **Class** and **Race** are free text, matching the website's character identity fields.
- **Background** and **Appearance** are shorter multiline fields.
- **Backstory** and **Notes** use full-width multiline fields. Notes can hold session reminders, languages, connections or other text.

An owner edits through normal Foundry submit-on-change behavior: leaving a changed field saves it. Fields can be cleared. Read-only viewers see escaped, wrapped prose with preserved line breaks rather than disabled text boxes. These notes follow the actor's ordinary permissions; they are not a separate private/GM-only journal.

Text is stored literally, not as rich HTML. Line breaks, spaces, Unicode, decimal text and notation such as 1.5× are retained. Class/Race/Background text does not grant rules effects or change stats. The main sheet's numeric controls retain their existing whole-number behavior.

## Data

Additive `system.details` SchemaField with six StringFields: `class`, `race`, `background`, `appearance`, `backstory` and `notes`. All default to an empty string, allow clearing and disable trimming. Existing actors gain empty fields through native schema defaults; no migration or world data edit is needed. No existing fields are renamed or removed.

Narrative controls use saved source values. Unchanged details are omitted from unrelated whole-sheet submissions, so changing a stat does not resubmit the stored story. Only changed narrative keys are submitted. Existing Health/resource handling still preserves damage/expenditure and hidden fractional balances.

The website's current `index.html` identity and character-notes sections were consulted for labels, plain-text editing and multiline layout. The four narrative fields follow this repository's character-sheet roadmap. Class and Race are descriptive, with no new rules interpretation. Character/Equipment/Abilities/Notes tabs remain the next organization step.

## Validation

Portable tests cover unchanged detail omission, deliberate clearing, literal text and whitespace preservation, and absence of unintended resource/stat updates. `node --test` runs the existing rules and adapter regression suite.

Offline checks using installed v14.365 DataModel fields and strict Handlebars templates verify:

- Old actor data gains six blank defaults while its other stored fields remain unchanged.
- Newlines, spacing, Unicode, literal HTML and decimal notation survive save/reload/clearing.
- Owner fields have the correct native form names; read-only output has no narrative form controls and escapes markup.
- Rendering does not mutate stored data; unrelated saves omit unchanged details.
- Narrative updates leave exact Health, AP and Mana balances unchanged. Prior interface/resource/ability/effect/milestone checks still pass.

No live Foundry world or computer UI was used, following the user's preference to test the interface themselves. After restarting, check owner autosave on leaving fields, reopen/reload, empty-field clearing, a long multiline paste, summary updates, read-only viewing and narrow/phone layout. Also change a stat or spend a resource with the section closed and confirm the story stays intact.
