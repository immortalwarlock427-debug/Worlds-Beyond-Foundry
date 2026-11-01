import { test } from "node:test";
import assert from "node:assert/strict";
import { decorateSystemMessage } from "../module/chat-style.mjs";

test("every visible system card gets the shared theme, including flag-free reload and non-healing consumables", () => {
  for (const marker of [".wb-roll-card", ".wb-attack-card", ".wb-consumable-card", ".wb-block-card"]) {
    const classes = [];
    const message = { isContentVisible: true, getFlag() { throw new Error("Theming must not depend on flags"); } };
    const html = { querySelector: selector => selector.split(", ").includes(marker) ? {} : null, classList: { add: (...values) => classes.push(...values) } };
    decorateSystemMessage(message, html);
    assert.deepEqual(classes, ["worlds-beyond", "wb-chat-message"], marker);
  }
});

test("hidden results are not inspected and ordinary Foundry messages keep their own theme", () => {
  decorateSystemMessage({ isContentVisible: false }, { querySelector() { throw new Error("Hidden content inspected"); } });
  const classes = [];
  decorateSystemMessage({ isContentVisible: true }, { querySelector: () => null, classList: { add: value => classes.push(value) } });
  assert.deepEqual(classes, []);
});
