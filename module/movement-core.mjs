// Foundry-free movement AP rules (Notion Stats → Agility, Armor Types Information).
// Movement buys feet in whole AP at the character's ft/AP rate. Feet bought but not
// walked stay banked for the rest of the turn, so two short moves cost no more than one
// long one. Surge (AGL 21) gives 2 AP that can only buy movement, spent before own AP.
import { numberOr } from "./core-numbers.mjs";

export const SURGE_AP = 2;
export const BASE_SQUARE_FEET = 5;
const EPSILON = 1e-6;

// How much more a square costs than its 5 ft (heavy armor: 10 ft → 2×).
export function squareFactor(squareCost) {
  return Math.max(0, numberOr(squareCost, BASE_SQUARE_FEET)) / BASE_SQUARE_FEET;
}

// A turn's receipts. A record from another turn starts the new turn empty.
export function turnLedger(record, key) {
  const current = record && record.key === key && Array.isArray(record.receipts);
  return { key, receipts: current ? record.receipts.filter(receipt => receipt && typeof receipt === "object") : [] };
}

export function ledgerTotals(ledger, surgeMax = 0) {
  let credit = 0,
    feet = 0,
    surge = 0;
  for (const receipt of ledger.receipts) {
    credit += numberOr(receipt.credit, 0);
    feet += numberOr(receipt.feet, 0);
    surge += numberOr(receipt.surge, 0);
  }
  return { bank: Math.max(0, credit - feet), surgeLeft: Math.max(0, numberOr(surgeMax, 0) - surge) };
}

// What moving `feet` (already multiplied for heavy armor and difficult terrain) costs.
export function movementCost({ feet, rate, bank = 0, surgeLeft = 0, available = Infinity, multiplier = 1 }) {
  const distance = Math.max(0, numberOr(feet, 0)) * Math.max(1, numberOr(multiplier, 1));
  const banked = Math.max(0, numberOr(bank, 0));
  const free = { feet: distance, ap: 0, surge: 0, credit: 0, bankAfter: banked - distance, affordable: true };
  if (distance <= EPSILON) return { ...free, feet: 0, bankAfter: banked };
  const need = distance - banked;
  if (need <= EPSILON) return free;
  const perAp = numberOr(rate, 0);
  if (!(perAp > 0)) return { ...free, ap: Infinity, bankAfter: banked, affordable: false, reason: "moves 0 ft per AP" };
  const total = Math.ceil(need / perAp - EPSILON);
  const surge = Math.min(Math.max(0, Math.floor(numberOr(surgeLeft, 0))), total);
  const ap = total - surge;
  const credit = total * perAp;
  return { feet: distance, ap, surge, credit, bankAfter: banked + credit - distance, affordable: ap <= numberOr(available, 0) };
}

export function receiptFor(id, cost, plan = { fromOwn: cost.ap, fromGiven: 0 }) {
  return { id, feet: cost.feet, credit: cost.credit, surge: cost.surge, ap: plan.fromOwn, given: plan.fromGiven };
}

// Undoing movements returns what their receipts paid. Foundry only undoes the most
// recent movements, so the remaining receipts still explain the bank exactly.
export function refundMovements(ledger, movementIds) {
  const ids = new Set(movementIds);
  const refunded = ledger.receipts.filter(receipt => ids.has(receipt.id));
  return {
    ledger: { ...ledger, receipts: ledger.receipts.filter(receipt => !ids.has(receipt.id)) },
    ap: refunded.reduce((total, receipt) => total + numberOr(receipt.ap, 0), 0),
    given: refunded.reduce((total, receipt) => total + numberOr(receipt.given, 0), 0),
    count: refunded.length
  };
}

export function costLabel(cost, available) {
  if (!cost.affordable && cost.reason) return `can't move (${cost.reason})`;
  const parts = [`${cost.ap} AP`];
  if (cost.surge) parts.push(`${cost.surge} Surge`);
  const label = parts.join(" + ");
  return cost.affordable ? label : `${label} (${Math.max(0, Math.floor(numberOr(available, 0)))} left)`;
}
