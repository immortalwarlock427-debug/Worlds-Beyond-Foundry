import { test } from "node:test";
import assert from "node:assert/strict";
import {
  squareFactor,
  turnLedger,
  ledgerTotals,
  movementCost,
  receiptFor,
  refundMovements,
  costLabel
} from "../module/movement-core.mjs";
import { wornEquipment } from "../module/equipment-core.mjs";

const heavyChest = { type: "armor", system: { equipped: true, piece: "chest", armorType: "heavy", armorRating: 5 } };

test("movement buys feet in whole AP and banks the rest for the turn", () => {
  // AGL mod +2 → 15 ft per AP. 10 ft costs 1 AP and leaves 5 ft.
  const first = movementCost({ feet: 10, rate: 15, available: 15 });
  assert.deepEqual([first.ap, first.credit, first.bankAfter, first.affordable], [1, 15, 5, true]);
  const second = movementCost({ feet: 5, rate: 15, bank: first.bankAfter, available: 14 });
  assert.deepEqual([second.ap, second.bankAfter], [0, 0]);
  const third = movementCost({ feet: 35, rate: 15, available: 14 });
  assert.equal(third.ap, 3);
  assert.equal(third.bankAfter, 10);
});

test("Surge AP pays before own AP and only up to 2", () => {
  const cost = movementCost({ feet: 50, rate: 10, surgeLeft: 2, available: 3 });
  assert.deepEqual([cost.surge, cost.ap, cost.affordable], [2, 3, true]);
  assert.equal(movementCost({ feet: 15, rate: 10, surgeLeft: 2 }).ap, 0);
});

test("unaffordable or impossible moves are flagged", () => {
  const cost = movementCost({ feet: 60, rate: 5, available: 4 });
  assert.equal(cost.ap, 12);
  assert.equal(cost.affordable, false);
  assert.equal(costLabel(cost, 4), "12 AP (4 left)");
  const stuck = movementCost({ feet: 5, rate: 0, available: 15 });
  assert.equal(stuck.affordable, false);
  assert.match(costLabel(stuck, 15), /0 ft per AP/);
  assert.equal(movementCost({ feet: 0, rate: 0 }).affordable, true);
});

test("gridless fractions round AP up without floating-point overcharge", () => {
  assert.equal(movementCost({ feet: 30.000000001, rate: 15 }).ap, 2);
  assert.equal(movementCost({ feet: 7.5, rate: 15 }).ap, 1);
});

test("the ledger resets each turn and refunds undone movements", () => {
  const stale = { key: "c:1:0", receipts: [{ id: "a", feet: 10, credit: 15, surge: 0, ap: 1, given: 0 }] };
  assert.deepEqual(turnLedger(stale, "c:1:1").receipts, []);
  const ledger = turnLedger(stale, "c:1:0");
  const second = receiptFor("b", movementCost({ feet: 20, rate: 15, bank: 5 }), { fromOwn: 0, fromGiven: 1 });
  ledger.receipts.push(second);
  assert.deepEqual(ledgerTotals(ledger, 2), { bank: 0, surgeLeft: 2 });
  const refund = refundMovements(ledger, ["b"]);
  assert.deepEqual([refund.ap, refund.given, refund.count], [0, 1, 1]);
  assert.deepEqual(ledgerTotals(refund.ledger), { bank: 5, surgeLeft: 0 });
});

test("Surge already used this turn is not offered again", () => {
  const ledger = { key: "k", receipts: [{ id: "a", feet: 20, credit: 20, surge: 2, ap: 0, given: 0 }] };
  assert.equal(ledgerTotals(ledger, 2).surgeLeft, 0);
});

test("heavy armor squares cost 10 ft, can be switched off or overridden", () => {
  const heavy = wornEquipment({ items: [heavyChest] });
  assert.deepEqual([heavy.squareCost, heavy.difficultSquareCost, squareFactor(heavy.squareCost)], [10, 20, 2]);
  const off = wornEquipment({ items: [heavyChest], heavySquares: false });
  assert.deepEqual([off.squareCost, off.automaticSquareCost], [5, 5]);
  const custom = wornEquipment({ items: [heavyChest], squareCostOverride: 5 });
  assert.deepEqual([custom.squareCost, custom.automaticSquareCost], [5, 10]);
  assert.equal(wornEquipment({ items: [] }).squareCost, 5);
  assert.equal(squareFactor(null), 1);
});
