import { test } from "node:test";
import assert from "node:assert/strict";
import { abilityUses, abilityRecord, abilityGroups, abilityResources, abilityFormUpdates } from "../module/abilities-core.mjs";
import { inventory, wornEquipment } from "../module/equipment-core.mjs";

const id = "resource00000001";
const character = { stats: { int: { mod: 3 }, fth: { mod: -2 }, str: { mod: 20 } }, customResources: { [id]: { name: "Blood", max: 125 } } };
const item = (system = {}) => ({ id: "a", name: "Lightning", type: "ability", img: "icons/svg/item-bag.svg", system: { kind: "active", ...system } });

test("ability costs preview Notion AP discounts using the current selected stat and respect fixed/blank/zero costs", () => {
  assert.equal(abilityRecord(item({ apCost: 11, apDiscountStat: "int" }), character).ap, 8);
  assert.equal(abilityRecord(item({ apCost: 11, apDiscountStat: "fth" }), character).ap, 13);
  assert.equal(abilityRecord(item({ apCost: 11, apDiscountStat: "str" }), character).ap, 6);
  assert.equal(abilityRecord(item({ apCost: 11, apDiscountStat: "" }), character).ap, 11);
  assert.equal(abilityRecord(item({ apCost: 11, apDiscountStat: "int" })).ap, 11, "world template keeps the base until owned");
  assert.equal(abilityRecord(item({ apCost: 0 })).ap, 0); assert.equal(abilityRecord(item()).ap, null);
});

test("resources use stable IDs, retain hidden mana/holy power, and preserve missing references without rebinding", () => {
  const before = structuredClone(character);
  assert.deepEqual(abilityResources(character).map(row => row.value), ["", "mana", "holyPower", id]);
  const record = abilityRecord(item({ resourceId: id, resourceCost: 10, resourceUnit: "percent" }), character);
  assert.match(record.summary, /10% Blood/);
  const renamed = structuredClone(character); renamed.customResources[id].name = "Vital essence";
  assert.match(abilityRecord(item({ resourceId: id, resourceCost: 10 }), renamed).summary, /10 Vital essence/);
  assert.deepEqual(abilityResources({}, id).at(-1), { value: id, label: "Missing resource", selected: true });
  assert.match(abilityRecord(item({ resourceId: id, resourceCost: 10 }), {}).summary, /Missing resource/);
  assert.deepEqual(character, before);
});

test("ability summaries include restoration without adding a payment, rebinding a missing pool or triggering passive gains", () => {
  const source = item({ restoration: { target: id, amount: "2d6+2", unit: "points" } });
  assert.match(abilityRecord(source, character).summary, /Restore 2d6\+2 Blood/);
  assert.match(abilityRecord(source, {}).summary, /Missing or hidden resource/);
  source.system.kind = "passive"; assert.doesNotMatch(abilityRecord(source, character).summary, /Restore/);
});

test("uses distinguish unlimited, zero caps and manual exceptions while retaining spent counts through maximum changes", () => {
  assert.deepEqual(abilityUses({}), { max: null, value: null, tracked: false });
  assert.deepEqual(abilityUses({ uses: { max: 0 } }), { max: 0, value: 0, tracked: true });
  assert.equal(abilityUses({ uses: { max: 3, spent: 1 } }).value, 2);
  assert.equal(abilityUses({ uses: { max: 5, spent: 1 } }).value, 4);
  assert.equal(abilityUses({ uses: { max: 1, spent: 2 } }).value, -1);
  assert.equal(abilityUses({ uses: { max: 1, spent: -2 } }).value, 3);
});

test("ability summaries keep manual cooldowns and escaped-by-template text without performing actions", () => {
  const source = item({ description: "<script>test</script>", uses: { max: 3, spent: 1 }, cooldown: { rounds: 3, remaining: 2 }, duration: "1 minute" });
  const before = structuredClone(source), actorBefore = structuredClone(character);
  const row = abilityRecord(source, character);
  assert.match(row.summary, /2 \/ 3 uses · 2 rounds left/); assert.equal(row.hasDetails, true);
  assert.equal(row.description, "<script>test</script>");
  source.system.cooldown.remaining = 0;
  assert.match(abilityRecord(source, character).summary, /Ready · 3-round cooldown/);
  source.system.cooldown.remaining = 2;
  assert.deepEqual(source, before); assert.deepEqual(character, actorBefore);
});

test("ability grouping excludes gear and preserves actor/item IDs", () => {
  const list = [item(), { ...item({ kind: "passive" }), id: "p" }, { ...item({ kind: "reaction" }), id: "r" }, { id: "sword", type: "weapon", system: {} }];
  const groups = abilityGroups(list, character);
  assert.deepEqual(groups.map(group => group.label), ["Active", "Passive", "Reaction"]);
  assert.deepEqual(groups.flatMap(group => group.rows).map(row => row.id), ["a", "p", "r"]);
});

test("abilities never consume inventory slots or contribute to armor even with carried-like imported fields", () => {
  const ability = item({ quantity: 99, slots: 5, equipped: true, armorRating: 10 });
  assert.equal(inventory({ items: [ability] }).used, 0); assert.equal(wornEquipment({ items: [ability] }).armor, 0);
});

test("uses form saves omit unchanged floored totals, convert deliberate corrections using the revised maximum, and clear to refill", () => {
  const system = { uses: { max: 3, spent: 0.5 } };
  const unchanged = { usesCurrent: 2, system: { uses: { max: 5 }, notes: "Edited" } };
  abilityFormUpdates(system, unchanged); assert.equal(unchanged.usesCurrent, undefined); assert.equal(unchanged.system.uses.spent, undefined);
  const changed = { usesCurrent: 1.9, system: { uses: { max: 5 } } };
  abilityFormUpdates(system, changed); assert.equal(changed.system.uses.spent, 4);
  const clear = { usesCurrent: "" }; abilityFormUpdates(system, clear); assert.equal(clear.system.uses.spent, 0);
  const zero = { usesCurrent: 0 }; abilityFormUpdates(system, zero); assert.equal(zero.system.uses.spent, 3);
  const unlimited = { usesCurrent: 1, system: { uses: { max: null } } };
  abilityFormUpdates(system, unlimited); assert.equal(unlimited.system.uses.spent, undefined);
  assert.throws(() => abilityFormUpdates(system, { usesCurrent: "bad" }), /number of uses/);
  assert.equal(system.uses.spent, 0.5);
});
