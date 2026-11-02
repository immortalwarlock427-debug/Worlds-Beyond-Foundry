import { abilityRecord } from "./abilities-core.mjs";
import { queuedAction, reversibleAction } from "./action-support.mjs";
import { effectContext } from "./effects-core.mjs";
import { activeLoadoutForm } from "./form-loadout-core.mjs";
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

const framing = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : 35;
export function archiveAppearance(actor) {
  const form = activeLoadoutForm(actor);
  return { baseFormName: actor.system.appearance?.baseFormName?.trim() || "Base Form",
    portraitY: framing(form?.system.loadout?.portraitY ?? actor.system.appearance?.portraitY), formId: form?.id ?? "" };
}
export async function configureArchive(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const before = archiveAppearance(actor), form = activeLoadoutForm(actor);
  const content = `<div class="wb-archive-settings"><div class="wb-portrait-preview"><img src="${escape(actor.img)}" alt="Portrait framing preview" style="object-position:50% ${before.portraitY}%"></div>
    <label>Base form name<input type="text" name="baseFormName" value="${escape(actor.system.appearance?.baseFormName ?? "")}" placeholder="Base Form"></label>
    <label>Portrait framing · ${escape(form?.name || before.baseFormName)}<input type="range" name="portraitY" value="${before.portraitY}" min="0" max="100" step="1"></label>
    <div class="wb-framing-labels"><span>Top of image</span><output>${before.portraitY}%</output><span>Bottom of image</span></div>
    <p class="wb-item-brief">Framing is saved separately for Base and each form. Click the portrait to choose artwork; a form's image returns to Base on End.</p></div>`;
  const result = await foundry.applications.api.DialogV2.input({ classes: ["worlds-beyond", "wb-roll-dialog"], position: { width: 380 }, window: { title: "Archive appearance" }, content,
    render: (_event, dialog) => { const root = dialog.element, slider = root.querySelector('[name="portraitY"]');
      slider.addEventListener("input", () => { root.querySelector(".wb-portrait-preview img").style.objectPosition = `50% ${slider.value}%`; root.querySelector("output").value = `${slider.value}%`; }); },
    ok: { label: "Save appearance" }, rejectClose: false });
  if (!result) return;
  return queuedAction(actor.uuid, () => reversibleAction(async change => {
    if (!actor.isOwner) return;
    if (archiveAppearance(actor).formId !== before.formId) throw new Error("The current form changed. Open appearance again to frame that form.");
    const y = Number(result.portraitY);
    if (!Number.isFinite(y) || y < 0 || y > 100) throw new Error("Choose portrait framing between 0 and 100.");
    const name = String(result.baseFormName ?? "").trim(), updates = {}, restore = {};
    if (name !== (actor.system.appearance?.baseFormName ?? "")) { updates["system.appearance.baseFormName"] = name; restore["system.appearance.baseFormName"] = actor.system.appearance?.baseFormName ?? ""; }
    if (!form && framing(y) !== before.portraitY) { updates["system.appearance.portraitY"] = framing(y); restore["system.appearance.portraitY"] = actor.system.appearance?.portraitY ?? 35; }
    if (Object.keys(updates).length) {
      await change(() => actor, () => actor.update(restore));
      await actor.update(updates);
      if (archiveAppearance(actor).baseFormName !== (name || "Base Form") || (!form && archiveAppearance(actor).portraitY !== framing(y))) throw new Error("Appearance was not saved. Try again.");
    }
    if (form && framing(y) !== before.portraitY) {
      const saved = form.system.loadout?.portraitY ?? null;
      await change(() => form, () => form.update({ "system.loadout.portraitY": saved }));
      await form.update({ "system.loadout.portraitY": framing(y) });
      if (form.system.loadout.portraitY !== framing(y)) throw new Error("Form framing was not saved. Try again.");
    }
    return actor;
  }));
}
