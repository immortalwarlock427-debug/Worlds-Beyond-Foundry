# Equipment artwork

Version 0.17.0 assigns a unique image path to every one of the 70 catalog entries: **63 stock matches and 7 named placeholders awaiting custom art**. Copies of the same item intentionally use the same artwork. Custom/non-catalog items and consumable categories keep their existing fallback behavior.

## Artwork requested

These stock-library gaps use labelled navy/brass SVG placeholders instead of depicting the wrong weapon or shield:

| Item | Image needed |
| --- | --- |
| Chakram | Circular throwing blade with an open center. |
| Rapier | Slim thrusting blade with a swept or cup hand guard. |
| Urumi | Flexible metal ribbon sword. |
| Lance | Long mounted lance with a protective hand guard. |
| Blowgun | Slender hollow blowpipe, optionally with a small dart. |
| Chain Shield | The intended chain-shield design, with visible chain construction. |
| Scale Shield | Shield faced with overlapping scales. |

Square PNG or WebP artwork, ideally 512×512 or larger, with a centered object and space around its edges will work well. A dark or transparent background fits the existing icons. No artwork is generated for these seven items; the user offered to provide it.

## Source and selection

Stock images are bundled with the user's Foundry VTT 14.365 installation under `resources/app/public/icons/`. The system references `icons/...` URLs; it does not copy or redistribute the stock files. The current website equipment interface was consulted, and selected artwork was visually reviewed in local galleries rather than chosen only by filename.

Related weapons no longer share one automatic image: four crossbow variants, three bows, axes, hammers, swords, polearms and daggers each have distinct paths. Iron Fan and Kusarigama use the actual stock fan and chain-sickle; Katar uses a punch-dagger image. Armor varies by weight and location; arm guards use bracers. Some stock art is stylized rather than a literal historical illustration.

## Existing items and custom images

`itemIcon` resolves an empty/generic image or the exact former automatic default for the same named catalog item to its new artwork. A different saved image is preserved, including a user-selected stock image. Renamed/non-catalog items with explicit images are preserved. An intentional choice identical to that item's old automatic default cannot be distinguished from the old default and receives the new display image.

Character inventory rows, item-editor previews, the native Items directory and Item compendium contents use the resolver. Native directory hooks change thumbnails only; they do not restyle Foundry's sidebar or update documents/index entries. The image-path field still represents the saved image. Other modules or native art popouts that read the saved `img` directly can show the original until the user explicitly changes it.

New catalog imports use the new image paths. `CATALOG_VERSION` stays unchanged so an art update does not trigger a catalog refresh that resets edited compendium rules. No refresh or item replacement is required for the normal inventory/directory views. No actor/item fields, IDs, quantities, rules or saved image paths are migrated, and custom art is not overwritten.

## Checks

- `node --test` verifies all 70 paths are unique, exactly seven labelled gaps, appropriate stock categories, old-default recognition, custom stock/file preservation, renamed items and display-only world/compendium updates.
- Local checks verify every referenced asset exists, the 42 prior strict form/template cases and populated inventory rows still pass, and all 16 stat-setup contexts remain compatible.
- Selected assets were visually reviewed across the full catalog, including distinct crossbows, armor weights, proper fan/chain-sickle/punch-dagger and explicit gaps.
- The PR records live Foundry checks and remaining limits. Restart Foundry and refresh player browsers; compare the native Items directory, compendium contents, inventory rows and editor previews. Confirm custom art remains chosen and gameplay values are unchanged. Native art popouts and third-party item browsers are outside this display pass.
