import { test } from "node:test";
import assert from "node:assert/strict";
import { fitDialogDisclosures } from "../module/dialog-layout.mjs";

test("opening or closing optional help refits the dialog once, including after another render", () => {
  const listeners = [];
  const details = { open: false, addEventListener: (type, listener) => { assert.equal(type, "toggle"); listeners.push(listener); } };
  const positions = [];
  const dialog = { element: { querySelectorAll: () => [details] }, setPosition: position => positions.push(position) };
  fitDialogDisclosures(dialog); fitDialogDisclosures(dialog);
  details.open = true; listeners.forEach(listener => listener());
  details.open = false; listeners.forEach(listener => listener());
  assert.equal(listeners.length, 1);
  assert.deepEqual(positions, [{ height: "auto" }, { height: "auto" }]);
});
