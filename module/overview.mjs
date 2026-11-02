import { abilityRecord } from "./abilities-core.mjs";
import { queuedAction } from "./action-support.mjs";
import { effectContext } from "./effects-core.mjs";
const list = items => Array.from(items?.values?.() ?? items ?? []);
export const overviewFill = pool => pool?.max > 0 && Number.isFinite(pool.value) ? Math.max(0, Math.min(100, pool.value / pool.max * 100)) : 0;
function choices(actor) {
  return [...list(actor.items).filter(item => item.type === "ability").map(item => ({ id: item.id, name: item.name })),
    ...effectContext(actor).savedAbilities.map(row => ({ id: row.uuid, name: row.name }))];
}
export function favoriteSlots(actor, legacy = effectContext(actor).savedAbilities) {
  const items = list(actor.items);
  return Array.from({ length: 4 }, (_, index) => {
    const id = actor.system.favorites?.[index] ?? "";
    const item = items.find(item => item.id === id && item.type === "ability");
    const saved = legacy.find(row => row.uuid === id);
    if (!item && !saved) return { index: index + 1, empty: true, missing: !!id, name: id ? "Ability removed" : "Choose an ability" };
    const record = item ? abilityRecord(item, actor.system) : saved;
    return { ...record, index: index + 1, empty: false, missing: false,
      quickSummary: record.summary.split(" · ").slice(0, 2).join(" · "), operation: record.canUse ? record.effectsActive ? "end" : "use" : "edit",
      actionLabel: record.canUse ? record.effectsActive ? "End" : "Use" : "Open" };
  });
}
export function favoriteSelection(actor, form) {
  const selected = Array.from({ length: 4 }, (_, index) => String(form[`slot${index}`] ?? ""));
  const filled = selected.filter(Boolean);
  if (new Set(filled).size !== filled.length) throw new Error("Choose each favorite ability only once.");
  const available = choices(actor);
  if (filled.some(id => !available.some(item => item.id === id))) throw new Error("A selected ability no longer exists. Choose another favorite.");
  return selected;
}
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function configureFavorites(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const items = choices(actor);
  const content = `<div class="wb-check-options wb-favorite-options">${Array.from({ length: 4 }, (_, index) => {
    const current = actor.system.favorites?.[index] ?? "";
    const options = [{ id: "", name: "Empty slot" }, ...items];
    if (current && !items.some(item => item.id === current)) options.push({ id: current, name: "Missing ability · choose a replacement" });
    return `<label>Favorite ${index + 1}<select name="slot${index}">${options.map(item => `<option value="${escape(item.id)}"${item.id === current ? " selected" : ""}>${escape(item.name)}</option>`).join("")}</select></label>`;
  }).join("")}</div>`;
  const form = await foundry.applications.api.DialogV2.input({ classes: ["worlds-beyond", "wb-roll-dialog"], position: { width: 400 }, window: { title: "Favorite abilities" }, content, ok: { label: "Save favorites" }, rejectClose: false });
  if (!form) return;
  return queuedAction(actor.uuid, async () => {
    if (!actor.isOwner) return;
    const favorites = favoriteSelection(actor, form);
    if (JSON.stringify(favorites) === JSON.stringify(actor.system.favorites ?? [])) return actor;
    const result = await actor.update({ "system.favorites": favorites });
    if (!result || JSON.stringify(actor.system.favorites) !== JSON.stringify(favorites)) throw new Error("Favorites were not saved. Try again.");
    return result;
  });
}
