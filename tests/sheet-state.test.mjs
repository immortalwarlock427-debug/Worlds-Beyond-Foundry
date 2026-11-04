import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreDisclosures, continueVortex } from "../module/sheet-state.mjs";
test("resource disclosures reopen before scroll restoration and vortex replacement retains elapsed rotation", () => {
  const detail = { open: false };
  restoreDisclosures({ querySelector: () => detail }, { details: { settings: true } });
  assert.equal(detail.open, true);
  const stream = { dataset: {}, style: {} };
  continueVortex({ querySelectorAll: () => [stream] }, performance.now() - 5000);
  assert.ok(parseFloat(stream.style.animationDelay) <= -5000);
  const delay = stream.style.animationDelay;
  continueVortex({ querySelectorAll: () => [stream] }, 0);
  assert.equal(stream.style.animationDelay, delay);
});
