import { queuedAction } from "./action-support.mjs";
import { actorLogSnapshot, documentLogSnapshot, logChanges, renderLog } from "./dm-log-core.mjs";
const SCOPE = "worlds-beyond";
const snapshots = new Map();
const waiting = new Map();
let timer;
const enabled = () => globalThis.game?.settings?.get?.(SCOPE, "sheetLogEnabled") === true;
const activeGM = () => game.user?.isActiveGM && enabled();
const actorOf = document =>
  document?.documentName === "Actor"
    ? document
    : (document?.actor ?? (document?.parent?.documentName === "Actor" ? document.parent : document?.parent?.actor));

function isPrivate(journal) {
  return (
    journal?.getFlag(SCOPE, "sheetLog") &&
    Object.entries(journal.ownership).every(([id, permission]) =>
      id === "default" ? permission === 0 : permission === 0 || game.users.get(id)?.isGM
    )
  );
}
async function journalForLog() {
  const existing = game.journal.get(game.settings.get(SCOPE, "sheetLogJournal"));
  if (isPrivate(existing)) return existing;
  const journal = await foundry.documents.JournalEntry.implementation.create({
    name: "Worlds Beyond · DM activity log",
    ownership: { default: 0 },
    flags: { [SCOPE]: { sheetLog: true } },
    pages: [{ name: "Sheet activity", type: "text", text: { content: "", format: 1 }, flags: { [SCOPE]: { records: [] } } }]
  });
  if (!journal) throw new Error("DM log journal could not be created.");
  await game.settings.set(SCOPE, "sheetLogJournal", journal.id);
  return journal;
}

export async function appendSheetLog(records) {
  if (!activeGM() || !records.length) return;
  return queuedAction("worlds-beyond:dm-log", async () => {
    if (!activeGM()) return;
    const journal = await journalForLog();
    let page = journal.pages.find(page => Array.isArray(page.getFlag(SCOPE, "records")));
    if (!page)
      [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [
        { name: "Sheet activity", type: "text", text: { content: "", format: 1 }, flags: { [SCOPE]: { records: [] } } }
      ]);
    const limit = Math.max(100, Math.min(5000, Math.floor(Number(game.settings.get(SCOPE, "sheetLogLimit")) || 500)));
    const history = [...page.getFlag(SCOPE, "records"), ...records].slice(-limit);
    const result = await page.update({ [`flags.${SCOPE}.records`]: history, "text.content": renderLog(history) });
    if (!result) throw new Error("DM log update was cancelled.");
  });
}
function schedule(actor, userId, action, changes = []) {
  if (!activeGM() || actor?.type !== "character") return;
  const key = `${actor.uuid}:${userId}`;
  const record = waiting.get(key) ?? {
    character: actor.name,
    actorUuid: actor.uuid,
    token: !!actor.isToken,
    player: game.users.get(userId)?.name || "System",
    time: new Date().toISOString(),
    action,
    changes: []
  };
  if (action !== "Sheet updated") record.action = action;
  record.changes = [...new Set([...record.changes, ...changes])];
  waiting.set(key, record);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const records = [...waiting.values()];
    waiting.clear();
    appendSheetLog(records).catch(error => ui.notifications.warn(`DM log: ${error.message}`));
  }, 350);
}
export function recordSheetAction(actor, action) {
  if (actor?.type !== "character" || !enabled()) return;
  if (activeGM()) schedule(actor, game.user.id, action);
  else game.socket.emit(`system.${SCOPE}`, { type: "sheetAction", actorUuid: actor.uuid, userId: game.user.id, action });
}
export async function openSheetLog() {
  if (!game.user.isGM) return;
  return queuedAction("worlds-beyond:dm-log", async () => (await journalForLog()).sheet.render({ force: true }));
}

export function registerSheetLog() {
  game.settings.register(SCOPE, "sheetLogEnabled", {
    name: "DM sheet activity log",
    hint: "Record important character changes in a private Journal while a GM is connected.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SCOPE, "sheetLogLimit", {
    name: "DM log entries retained",
    hint: "Keep the most recent entries in the DM activity Journal.",
    scope: "world",
    config: true,
    type: Number,
    default: 500,
    range: { min: 100, max: 5000, step: 100 }
  });
  game.settings.register(SCOPE, "sheetLogJournal", { scope: "world", config: false, type: String, default: "" });
  const snapshot = document => (document.documentName === "Actor" ? actorLogSnapshot(document) : documentLogSnapshot(document));
  const remember = document => {
    if (!document?.uuid) return;
    snapshots.set(document.uuid, snapshot(document));
  };
  const seedActor = actor => {
    if (actor?.type !== "character") return;
    remember(actor);
    for (const item of actor.items) {
      remember(item);
      for (const effect of item.effects) remember(effect);
    }
    for (const effect of actor.effects) remember(effect);
  };
  const seed = () => {
    for (const actor of game.actors) seedActor(actor);
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) seedActor(token.actor);
  };
  const updated = (document, changes, options, userId) => {
    const actor = actorOf(document);
    if (actor?.type !== "character") return;
    const after = snapshot(document),
      before = snapshots.get(document.uuid);
    remember(document);
    if (!activeGM()) return;
    const differences = before
      ? logChanges(before, after)
      : Object.keys(changes)
          .filter(key => !key.startsWith("flags"))
          .map(key => `${key} edited`);
    if (differences.length)
      schedule(actor, userId, document.documentName === "Actor" ? "Sheet updated" : `${document.name} updated`, differences);
    if (document !== actor) {
      const derived = actorLogSnapshot(actor),
        previous = snapshots.get(actor.uuid);
      remember(actor);
      if (previous) {
        const differences = logChanges(previous, derived);
        if (differences.length) schedule(actor, userId, "Sheet updated", differences);
      }
    }
  };
  for (const type of ["Actor", "Item", "ActiveEffect"]) {
    Hooks.on(`update${type}`, updated);
    Hooks.on(`create${type}`, (document, options, userId) => {
      const actor = actorOf(document);
      remember(document);
      if (actor?.type === "character") schedule(actor, userId, `${document.name || type} added`);
    });
    Hooks.on(`delete${type}`, (document, options, userId) => {
      const actor = actorOf(document);
      snapshots.delete(document.uuid);
      if (actor?.type === "character") schedule(actor, userId, `${document.name || type} removed`);
    });
  }
  Hooks.once("ready", () => {
    seed();
    game.socket.on(`system.${SCOPE}`, async payload => {
      if (
        !activeGM() ||
        payload?.type !== "sheetAction" ||
        typeof payload.actorUuid !== "string" ||
        !["Long rest", "Short rest"].includes(payload.action)
      )
        return;
      const user = game.users.get(payload.userId);
      const actor = await foundry.utils.fromUuid(payload.actorUuid).catch(() => null);
      if (user && actor?.type === "character" && actor.testUserPermission(user, "OWNER")) schedule(actor, user.id, payload.action);
    });
  });
  Hooks.on("canvasReady", seed);
  Hooks.on("createChatMessage", (message, options, userId) => {
    if (!activeGM()) return;
    const action = message.getFlag(SCOPE, "sheetActivity");
    const rest = message.getFlag(SCOPE, "shortRest");
    const context = action ?? rest;
    if (!context) return;
    const actor = foundry.utils.fromUuidSync(context.actorUuid);
    if (actor?.type === "character") schedule(actor, userId, action?.label ?? "Short rest");
  });
}
