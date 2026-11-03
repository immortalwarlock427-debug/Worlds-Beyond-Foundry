import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
  documents: { Combatant: class {} },
  helpers: { media: { VideoHelper: { hasVideoExtension: path => path.endsWith(".webm") } } }
};
const { registerCombatPortraits } = await import("../module/character-combatant.mjs");

test("combat portraits refresh on the actor or token update without advancing the turn", async () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  globalThis.CONFIG = {
    ui: {
      combat: class {
        async _getCombatantThumbnail(combatant) {
          return combatant.img;
        }
      }
    }
  };
  registerCombatPortraits();
  let renders = 0;
  const tracker = Object.assign(new CONFIG.ui.combat(), { rendered: true, render: () => renders++ });
  const state = { currentId: "form", basePortrait: "base.webp" };
  const actor = { uuid: "Actor.roman", img: "form.webp", getFlag: () => state };
  const token = { uuid: "Scene.qa.Token.roman", texture: { src: "form-token.webp" } };
  const combatant = { actor, token, _source: {}, img: "stale.webp" };
  globalThis.game = { combats: Object.assign([{ combatants: [combatant] }], { apps: [tracker] }) };
  hooks.get("updateActor")(actor, { img: actor.img });
  assert.equal(renders, 1);
  assert.equal(await tracker._getCombatantThumbnail(combatant), "form.webp");
  state.currentId = null;
  actor.img = "base.webp";
  token.texture.src = "base-token.webp";
  hooks.get("updateToken")(token, { texture: { src: token.texture.src } });
  assert.equal(renders, 2);
  assert.equal(await tracker._getCombatantThumbnail(combatant), "base-token.webp");
  hooks.get("updateActor")({ uuid: "Actor.other" }, { img: "elsewhere.webp" });
  assert.equal(renders, 2);
});
