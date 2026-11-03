import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_VERSION, registerSchemaVersion, runMigrations } from "../module/migrations.mjs";

test("schema registration is hidden/world-scoped and existing worlds need no writes", async () => {
  let writes = 0,
    registered;
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    settings: {
      register: (...args) => (registered = args),
      get: () => 0,
      set: () => writes++
    }
  };
  registerSchemaVersion();
  assert.equal(SCHEMA_VERSION, 0);
  assert.deepEqual(registered, ["worlds-beyond", "schemaVersion", { scope: "world", config: false, type: Number, default: 0 }]);
  await Promise.all([runMigrations(), runMigrations()]);
  assert.equal(writes, 0);
});

test("players and secondary GMs never read or migrate world schema", async () => {
  globalThis.game = {
    user: { id: "player", isGM: false },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => assert.fail("unauthorized read") }
  };
  await runMigrations();
  game.user = { id: "second", isGM: true };
  await runMigrations();
});

test("invalid or newer schema fails safely without downgrading or marking it migrated", async () => {
  let writes = 0;
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, settings: { get: () => 1, set: () => writes++ } };
  await assert.rejects(runMigrations(), /newer data schema/);
  for (const invalid of [-1, 0.5, NaN]) {
    game.settings.get = () => invalid;
    await assert.rejects(runMigrations(), /invalid/);
  }
  assert.equal(writes, 0);
  game.settings.get = () => 0;
  await runMigrations();
});
