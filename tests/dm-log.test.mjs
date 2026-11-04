import { test } from "node:test";
import assert from "node:assert/strict";
import { actorLogSnapshot, logChanges, renderLog } from "../module/dm-log-core.mjs";
import { appendSheetLog, openSheetLog } from "../module/dm-log.mjs";

test("DM log records named value changes and escapes character, player and text", () => {
  const actor = { name: "Hero", system: { health: { value: 20, max: 30 }, stats: { str: { value: 12, effective: 15 } } } };
  const before = actorLogSnapshot(actor);
  actor.system.health.value = 30;
  const changes = logChanges(before, actorLogSnapshot(actor));
  assert.deepEqual(changes, ["health Current: 20 → 30"]);
  const html = renderLog([{ character: '<img src=x onerror="bad">', player: "A & B", action: "Long rest", changes, time: "now" }]);
  assert.ok(!html.includes("<img"));
  assert.match(html, /A &amp; B/);
  assert.match(html, /Long rest/);
});
function fixture() {
  const records = [],
    writes = [];
  const page = {
    getFlag: () => records,
    update: async data => {
      records.splice(0, records.length, ...data["flags.worlds-beyond.records"]);
      writes.push(data);
      return page;
    }
  };
  const journal = { id: "log", ownership: { default: 0 }, pages: [page], getFlag: () => true };
  globalThis.game = {
    user: { id: "gm", isGM: true, isActiveGM: true },
    users: new Map([["gm", { isGM: true }]]),
    journal: new Map([["log", journal]]),
    settings: { get: (_scope, key) => ({ sheetLogEnabled: true, sheetLogJournal: "log", sheetLogLimit: 100 })[key] }
  };
  return { records, writes, journal };
}
const entry = number => ({ character: "Hero", player: "Owner", action: "Changed", time: String(number), changes: [String(number)] });
test("concurrent DM log writes serialize and retain the configured recent history", async () => {
  const f = fixture();
  await Promise.all([appendSheetLog(Array.from({ length: 100 }, (_, i) => entry(i))), appendSheetLog([entry(100)])]);
  assert.equal(f.records.length, 100);
  assert.equal(f.records[0].time, "1");
  assert.equal(f.records.at(-1).time, "100");
  assert.equal(f.writes.length, 2);
});
test("players and inactive GMs cannot append or open the private log", async () => {
  const f = fixture();
  game.user = { id: "player", isGM: false, isActiveGM: false };
  await appendSheetLog([entry(1)]);
  await openSheetLog();
  assert.equal(f.writes.length, 0);
  game.user = { id: "second", isGM: true, isActiveGM: false };
  await appendSheetLog([entry(2)]);
  assert.equal(f.writes.length, 0);
});
test("a shared Journal is never reused as the private DM log", async () => {
  const f = fixture();
  f.journal.ownership.default = 2;
  let created;
  globalThis.foundry = {
    documents: {
      JournalEntry: {
        implementation: {
          create: async data => {
            created = data;
            return { ...f.journal, id: "private", ownership: data.ownership };
          }
        }
      }
    }
  };
  game.settings.set = async () => {};
  await appendSheetLog([entry(1)]);
  assert.deepEqual(created.ownership, { default: 0 });
});
