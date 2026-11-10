import { CONDITION_SOURCE_TYPES, sourceConditions, conditionSource, validConditionSourceUuid } from "./condition-sources-core.mjs";
import { queuedAction } from "./action-support.mjs";

const SCOPE = "worlds-beyond";
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Token links retain the exact synthetic actor. Never replace a missing token
// with another copy of its world actor or guess among duplicate tokens.
export function resolveConditionSource(uuid) {
  if (!validConditionSourceUuid(uuid)) return null;
  try {
    const document = foundry.utils.fromUuidSync(uuid);
    const actor = document?.documentName === "Token" ? document.actor : document?.documentName === "Actor" ? document : null;
    return actor ? { document, actor, name: document.name || actor.name || "Source" } : null;
  } catch {
    return null;
  }
}

const observable = actor => actor?.testUserPermission?.(game.user, "OBSERVER") === true;
const limited = actor => actor?.testUserPermission?.(game.user, "LIMITED") === true;
function visibleToken(token) {
  if (!token?.actor || token.parent?.id !== globalThis.canvas?.scene?.id) return false;
  return game.user.isGM || (!token.hidden && token.object?.visible === true);
}
function selectable(source) {
  return source?.document.documentName === "Token" ? visibleToken(source.document) : limited(source?.actor);
}

export function conditionSourceChoices(current = "") {
  const entries = new Map();
  const add = (uuid, label) => {
    if (validConditionSourceUuid(uuid)) entries.set(uuid, { uuid, label, selected: uuid === current });
  };
  for (const actor of game.actors ?? []) if (limited(actor)) add(actor.uuid, `${actor.name} · character`);
  for (const token of globalThis.canvas?.scene?.tokens ?? [])
    if (visibleToken(token)) add(token.uuid, `${token.name || token.actor.name} · token (${canvas.scene.name})`);
  if (current && !entries.has(current)) {
    const found = resolveConditionSource(current);
    // Keep the saved option without disclosing a newly hidden token/actor name.
    add(current, found && selectable(found) ? `${found.name} · linked source` : "Existing source (unavailable here)");
  }
  return [...entries.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function linkedGrappler(effect) {
  const saved = conditionSource(effect, "grappled");
  const resolved = saved ? resolveConditionSource(saved.uuid) : null;
  if (!resolved || !observable(resolved.actor)) return null;
  const value = resolved.actor.system?.stats?.str?.mod;
  return typeof value === "number" && Number.isFinite(value) ? { ...resolved, uuid: saved.uuid, modifier: Math.floor(value) } : null;
}

function ownedEffect(actor, effectUuid) {
  const effect = [...(actor.effects?.values?.() ?? actor.effects ?? [])].find(effect => effect.uuid === effectUuid);
  if (!actor.isOwner || !effect || effect.parent !== actor) throw new Error("That condition no longer exists or cannot be edited.");
  return effect;
}

export async function setConditionSource(actor, effectUuid, id, sourceUuid, { expectedUuid } = {}) {
  return queuedAction(`conditionSource:${actor.uuid}`, async () => {
    const effect = ownedEffect(actor, effectUuid);
    if (!sourceConditions(effect).includes(id)) throw new Error("That condition is no longer on this effect.");
    const previous = conditionSource(effect, id);
    if (expectedUuid !== undefined && (previous?.uuid ?? "") !== expectedUuid && sourceUuid !== (previous?.uuid ?? ""))
      throw new Error("The source changed in another window. Reopen Sources before editing.");
    if (sourceUuid === (previous?.uuid ?? "")) return effect;
    const path = `flags.${SCOPE}.conditionSources`;
    let update;
    if (!sourceUuid) update = { [`${path}.-=${id}`]: null };
    else {
      const resolved = resolveConditionSource(sourceUuid);
      if (!resolved || !selectable(resolved))
        throw new Error("The source is no longer available. Choose another source or clear the link.");
      update = { [`${path}.${id}`]: { uuid: sourceUuid, name: resolved.name } };
    }
    if (!(await effect.update(update)) || (conditionSource(effect, id)?.uuid ?? "") !== sourceUuid)
      throw new Error("The source link was not saved. Reopen the condition and try again.");
    return effect;
  });
}

export async function promptConditionSource(actor, effectUuid) {
  const effect = ownedEffect(actor, effectUuid);
  const ids = sourceConditions(effect);
  if (!ids.length) return;
  const before = Object.fromEntries(ids.map(id => [id, conditionSource(effect, id)?.uuid ?? ""]));
  const sections = ids.map(id => {
    const current = conditionSource(effect, id)?.uuid ?? "";
    return (
      `<label>${escapeHTML(CONDITION_SOURCE_TYPES[id])} source<select name="${id}">` +
      `<option value=""${current ? "" : " selected"}>Unassigned · track manually</option>` +
      conditionSourceChoices(current)
        .map(
          choice => `<option value="${escapeHTML(choice.uuid)}"${choice.selected ? " selected" : ""}>${escapeHTML(choice.label)}</option>`
        )
        .join("") +
      "</select></label>"
    );
  });
  const choices = await foundry.applications.api.DialogV2.input({
    classes: [SCOPE, "wb-roll-dialog"],
    position: { width: 430 },
    window: { title: "Condition sources" },
    ok: { label: "Save sources" },
    rejectClose: false,
    content: `<div class="wb-check-options">${sections.join("")}<details class="wb-disclosure wb-help"><summary>Source help</summary><p>Choose a specific token for a creature on the map, especially an unlinked token. Escape can read the grappler's current STR when you can observe its sheet. Linking a source does not apply or end the condition.</p></details></div>`
  });
  if (!choices) return;
  // Native composite effects can carry several source-dependent statuses. Each
  // link has its own key; changing one never overwrites the other conditions.
  for (const id of ids) await setConditionSource(actor, effectUuid, id, choices[id] ?? "", { expectedUuid: before[id] });
}
