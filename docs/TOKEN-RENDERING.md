# Transformation token rendering investigation

Investigated 2026-11-04 against installed Foundry v14 build 365, no modules. No runtime rendering change is justified by the comparison below.

## Result and live comparison

Aran's settled Amalgamated Form token and a token configured manually through native Token Configuration show the same aliased appearance. The manual test used the existing token in Human Form, without activating any form: image `assets/Characters/Aran%20Transformed%20(Token).png`, width 2, height 2, art scale 1.15. Closing and reopening Token Configuration verified these values, including the numeric 1.15 scale. The token remained at the same position and canvas zoom throughout the comparison.

After restoring its original image (`assets/Characters/Aran%20(Token).png`), 1×1 dimensions and scale 1, using Amalgamated Form produced the same settled appearance as manual configuration. A mid-animation observation captured the fade/growth, followed by the completed state. Ending restored Human Form and the original small token. The ability's restoration rolled but restored 0 Health; no AP was spent outside combat. No form configuration, image file, module or graphics setting was changed. A normal ability-use chat card was produced. The live client was still running system 0.38.33; the renderer adapter is unchanged in this investigation. New sheet changes on disk require restart.

This supports Foundry's normal minification/rendering path as the source of the settled appearance, rather than a form-specific downgrade. The exact GPU sampling cause has not been established: no live WebGL texture/filter inspection or pixel-level comparison was performed. In particular, this does not prove mipmapping is disabled. The transition's temporary render/filter path is a plausible explanation for a different impression of smoothness during the fade, not a demonstrated system defect.

## Full system path and writes

1. `useAbility` in `module/abilities.mjs` queues the actor action, checks/pays configured costs, ends other forms, starts timers and enables the selected form's bonuses. It calls `syncFormLoadout`. Resource triggers call this same Use/End path through `module/form-triggers.mjs`.
2. `syncFormLoadout` in `module/form-loadouts.mjs` prunes deleted equipment IDs, plans the equipment preset and saves/restores the actor portrait independently. Before writing the actor's portrait/restore-state flag, it calls `syncFormTokens`. It does not set token art from the portrait.
3. `syncFormTokens` in `module/form-tokens.mjs` reads committed TokenDocument `_source`, snapshots original appearance and calls the pure `tokenTransform` planner. A linked actor updates its prototype and active linked tokens; a synthetic actor updates only its own token. Previously recorded linked dependent tokens can be restored too.
4. For this 1×1 → 2×2 example, the native update contains exactly `texture.src` = the encoded PNG path, `width` = 2, `height` = 2, `texture.scaleX` = 1.15, `texture.scaleY` = 1.15. Existing mirror signs are preserved. The odd one-square growth keeps x/y fixed. Even growth can also write x/y to center the change; the receipt records those offsets for restoration.
5. Placed tokens receive one document update with `animate: true`, `animation: {duration: 1250, transition: "fade"}` and matching movement duration; ruler display, panning and automatic rotation are disabled. Prototype changes are ordinary `actor.update` writes under `prototypeToken.*`, without canvas animation.
6. The adapter verifies committed source fields and records the restore receipt. It makes **no delayed second write** when the animation ends. The system does not assign mesh/sprite scale, alpha, filters, render textures, texture scale mode, mipmaps, shaders, resolution, compression, tint, fit, anchor, dynamic-ring settings or rotation.
7. End/Base clears form activation and calls the same synchronizer. Only previously owned appearance fields and any recorded positioning offsets are restored. Restoration uses the saved transition duration, 1250 ms here. A failed operation compensates token/prototype changes with animation disabled and rolls back form activation/bonuses and costs. Configuration left blank does not acquire ownership of those fields.

## Foundry's animation and final rendering

Inspected the installed native sources, without modifying Foundry program files:

- `client/canvas/placeables/token.mjs`, `#animate`, `_prepareAnimation`, `#handleTransitionChanges`: changing image source creates a native `TextureTransitionFilter`. Its pre-animation step calls Foundry `loadTexture(targetAsset)`, creates a temporary `PrimarySpriteMesh`/cloned token and uses `renderer.generateTexture` to render the target into a temporary render texture. The fade samples that texture. There is no system tween or midpoint image swap.
- `#animateFrame` interpolates numeric dimensions and texture scales in prepared document values. At completion it installs the exact destination animation values and requests a native redraw for the source change. `_draw` calls the same Foundry `loadTexture(document.texture.src)` and creates the normal primary token mesh.
- `#handleTransitionChanges` registers native cleanup: after a microtask, it destroys the temporary target mesh, render texture and cloned token, removes its filter, and clears temporary padding when dynamic rings are absent. Interrupted animations also run native post-animation cleanup. The system neither keeps the filter nor removes it itself. Leftovers were checked in source; not introspected on the live GPU.
- `_refreshMeshSizeAndScale` reads TokenDocument dimensions and `texture.scaleX/scaleY`, then calls native `mesh.resize`. Normal mesh alpha/tint/anchor refresh uses the document's unchanged values. No system mesh scaling is involved.
- `client/canvas/loader.mjs`: both transition and final draw enter `loadTexture`, which uses `getTexture`/the Foundry loader cache backed by `PIXI.Assets.load`. A cache hit returns a new Texture wrapper over the same cached BaseTexture, not a compressed or resized form-specific image. The system never calls `PIXI.Texture.from`.
- `client/canvas/board.mjs` sets default BaseTexture mipmapping from core's Mipmap Antialiasing setting. `client/canvas/groups/primary.mjs` defines the normal primary cached target with nearest sampling and no multisampling. These native details alone do not identify which setting or render stage causes the observed aliasing. No global quality defaults were overridden.

## Image path and size

The PNG exists as `assets/Characters/Aran Transformed (Token).png`: 1254×1254 RGBA, 2,056,259 bytes, SHA-256 `1ad3bd0c68343f21f3366e0e8962887ff80dfe036ac777ade45bca237b8668fd`. `%20` encodes its spaces. Form data passes the path through unchanged to TokenDocument; both native transition loading and final drawing use that same destination string. Native manual configuration retained the same encoded path. No alternate/compressed asset or path rewriting was found; live cache object identity was not inspected.

Grid width/height finish at exact integers 2 and 2. Art scale 1.15 intentionally draws beyond the footprint; it does not make the footprint fractional. A square image at grid size G has nominal artwork extent `2 × G × 1.15`; canvas zoom/device resolution can still produce fractional screen pixels, just as for a manually configured token. Do not round or snap the requested art scale as a supposed quality fix.

## Validation and follow-up

The adapter regression uses the reported encoded path, 2×2, 1.15 and 1.25 seconds. It checks identical immediate/animated destination fields, a single native update per linked token, native fade options and exact Base restoration, without any PIXI/mesh API present. Existing tests cover synthetic tokens, mirror signs, offsets, source-vs-prepared animation state, triggers and rollback. `node --test` remains required; these tests do not simulate GPU sampling.

No renderer workaround, image replacement, global graphics change or permanent filter was added. If further quality work is requested, compare the same scene/zoom with native Mipmap Antialiasing and a suitably resized copy of the art, and inspect native filter/cache state in a controlled client. Keep the original art and settings until those comparisons demonstrate an improvement. The separate live character-sheet audit remains open.
