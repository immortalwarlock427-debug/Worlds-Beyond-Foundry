// Local action serialization and compensation for failed document/chat operations.
const pending = new Map();
export function queuedAction(key, operation) {
  const current = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  pending.set(key, current);
  return current.finally(() => { if (pending.get(key) === current) pending.delete(key); });
}

export async function reversibleAction(operation) {
  const undo = [];
  const change = async (apply, restore) => {
    const result = await apply();
    if (!result) throw new Error("The update was cancelled; no result was posted.");
    undo.push(restore);
    return result;
  };
  try { return await operation(change); }
  catch (error) {
    let incomplete = false;
    for (const restore of undo.reverse()) {
      try { if (!await restore()) incomplete = true; }
      catch { incomplete = true; }
    }
    if (incomplete) throw new Error(`${error.message} Recovery also failed; check AP, reactions, shots, item quantity and the card's used state manually.`, { cause: error });
    throw error;
  }
}

export async function createActionMessage(data, options) {
  const result = await foundry.documents.ChatMessage.implementation.create(data, options);
  if (!result) throw new Error("The result was not posted.");
  return result;
}
