# Equipment catalog

Last equipment part, version 0.7.0. Transcribed from Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) (edited 2026-10-31 21:55 UTC) and [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de) (edited 2026-10-31 06:15 UTC).

## Contents

- 53 weapons in four folders: 26 one-handed melee, 12 two-handed melee, 10 ranged, 5 Paragon.
- 13 armor pieces: every filled cell of the Notion armor table. Light has no helmet and medium has no pants, so those don't exist.
- 4 shields: Wooden, Chain, Scale, Plate.

Each weapon's description holds the Notion text of its signature properties until they're automated in step 4. Classifications follow the contract in [EQUIPMENT.md](EQUIPMENT.md): Paragon weapons use `family: paragon` (Warbow and Arbalest also `ranged`), ordinary ranged weapons use `family: none` + `ranged`, and Chakram, Dagger, Javelin etc. stay melee with Thrown. Two-handed weapons and shields take 2 slots.

Every catalog entry now has distinct artwork: 63 fitting stock images and seven user-supplied illustrations. Existing automatic icons and matching placeholders update in the normal sheet/directory views without resetting catalog data; custom images are preserved. See [artwork sources and display scope](EQUIPMENT-ART.md).

## How it gets into Foundry

Compendium packs are LevelDB folders, which can't be built here without a build step. Instead the catalog lives as data in `module/catalog.mjs`, and Foundry builds the pack itself:

- On load, the active GM is asked once per catalog version to import it into a **world** compendium, "Worlds Beyond Catalog". Declining doesn't ask again for that version.
- **Configure Settings → Worlds Beyond → Import or refresh catalog** runs it any time. So does `game.worldsBeyond.importCatalog()`.
- Items use fixed ids, so a refresh updates them in place instead of duplicating. A refresh resets catalog items to the Notion values. Items you add to the pack yourself and copies already on characters are untouched.

To change the catalog: edit Notion, update the tables in `module/catalog.mjs`, bump `CATALOG_VERSION`. The GM gets the refresh prompt on the next load.

## Validation

`node --test` checks table sizes, unique 16-character ids, every key against the item models, the EQUIPMENT.md classification examples, Notion's full-set armor totals and shield values.

Not yet checked in a running world:

- [ ] Restart Foundry, refresh browsers, open the world as GM. Confirm version 0.7.0 and accept the import prompt. The Compendium tab shows "Worlds Beyond Catalog" with six folders.
- [ ] Open a Greatsword, Katana, Crossbow, Warbow and Net from the pack: family, Ranged, properties, signatures, ranges, loading, slots and description match Notion.
- [ ] Drag a Plate Shield and a heavy armor set onto a character. Equip them: AR, AGL penalty and Block dice update. Inventory slots update when unequipped.
- [ ] Run Import or refresh catalog from Configure Settings: the notice says 0 added, 70 refreshed, and there are no duplicates.
- [ ] As a player, open the compendium and drag an item onto your own character.
