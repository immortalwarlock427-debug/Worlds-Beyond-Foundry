import { test } from "node:test";
import assert from "node:assert/strict";

// v14's mixin restores focus/scroll before details. Closed disclosures make a
// long editor too short to retain its saved scroll position during replacement.
class Sheet {
  _syncPartState(_part, element, _prior, state) {
    element.scrollTop = state.scrollPositions[0][1];
    for (const [id, open] of Object.entries(state.details)) element.querySelector(`details[data-sync="${id}"]`).open = open;
  }
}
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  applications: { api: { DocumentSheetV2: class {}, HandlebarsApplicationMixin: base => base }, sheets: { ItemSheetV2: Sheet } }
};
const { AbilitySheet } = await import("../module/abilities.mjs");

test("ability editor reopens saved disclosures before native scroll restoration can clamp the position", () => {
  const disclosures = new Map([
    ['details[data-sync="form-loadout"]', { open: false }],
    ['details[data-sync="uses"]', { open: true }]
  ]);
  let scrollTop = 0;
  const element = {
    querySelector: selector => disclosures.get(selector),
    get scrollTop() {
      return scrollTop;
    },
    set scrollTop(value) {
      scrollTop = Math.min(value, disclosures.get('details[data-sync="form-loadout"]').open ? 2000 : 200);
    }
  };
  const state = { details: { "form-loadout": true, uses: false }, scrollPositions: [["", 725, 0]] };
  new AbilitySheet()._syncPartState("sheet", element, {}, state);
  assert.equal(element.scrollTop, 725);
  assert.equal(disclosures.get('details[data-sync="form-loadout"]').open, true);
  assert.equal(disclosures.get('details[data-sync="uses"]').open, false);
});
