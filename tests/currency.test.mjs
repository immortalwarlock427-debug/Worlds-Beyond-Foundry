import { test } from "node:test";
import assert from "node:assert/strict";
import { currencyTotal } from "../module/currency.mjs";

test("currency uses 1000 gold per platinum and keeps the entered denominations", () => {
  assert.equal(currencyTotal(), 0);
  assert.equal(currencyTotal({ gc: 999 }), 999);
  assert.equal(currencyTotal({ pc: 1 }), 1000);
  const coins = Object.freeze({ gc: 1500, pc: 2 });
  assert.equal(currencyTotal(coins), 3500);
  assert.deepEqual(coins, { gc: 1500, pc: 2 });
});
