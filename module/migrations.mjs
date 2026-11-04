// Storage schema versions are separate from release versions. No document
// migration is needed yet; version 0 preserves every existing world as-is.
const SYSTEM_ID = "worlds-beyond";
export const SCHEMA_VERSION = 0;
const migrations = [];
let pending;

export function registerSchemaVersion() {
  game.settings.register(SYSTEM_ID, "schemaVersion", { scope: "world", config: false, type: Number, default: 0 });
}

export async function runMigrations() {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (pending) return pending;
  pending = migrate();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}

async function migrate() {
  const saved = game.settings.get(SYSTEM_ID, "schemaVersion");
  if (!Number.isInteger(saved) || saved < 0) throw new Error("The saved schema version is invalid. No migration was run.");
  if (saved > SCHEMA_VERSION)
    throw new Error("This world uses a newer data schema. Install its matching system version before editing it.");
  for (let version = saved + 1; version <= SCHEMA_VERSION; version++) {
    const step = migrations.find(entry => entry.version === version);
    if (!step) throw new Error(`Missing schema migration ${version}.`);
    await step.run();
    // Never mark an incomplete step as finished. Future steps must be idempotent.
    await game.settings.set(SYSTEM_ID, "schemaVersion", version);
  }
}
