// Website-style score editing: effective at rest, base while editing.
// Display values never become document updates without an intentional input event.
const boundInputs = new WeakSet();
export function bindStatInput(input) {
  if (boundInputs.has(input)) return;
  boundInputs.add(input);
  input.addEventListener("focus", () => {
    input.value = input.dataset.pendingBase ?? input.dataset.base;
    input.classList.remove("is-adjusted");
  });
  input.addEventListener("input", () => {
    input.dataset.pendingBase = input.value.trim() === "" ? "" : String(Math.floor(Number(input.value)));
    input.classList.add("is-manual");
  });
  input.addEventListener("blur", () => {
    if (!Number.isFinite(Number(input.dataset.pendingBase ?? input.dataset.base))) delete input.dataset.pendingBase;
    const cleared = input.dataset.pendingBase?.trim() === "";
    const base = cleared ? input.dataset.default : input.dataset.pendingBase ?? input.dataset.base;
    const delta = Number(input.dataset.effective) - Number(input.dataset.base);
    input.value = String(Math.floor(Number(base) + delta));
    input.classList.toggle("is-manual", !cleared && (input.dataset.manual === "true" || Number(base) !== Number(input.dataset.base)));
    input.classList.toggle("is-adjusted", delta !== 0);
  });
}

export function editedStatInputs(form) {
  return Array.from(form?.querySelectorAll("[data-stat-score]") ?? [])
    .filter(input => input.dataset.pendingBase !== undefined && (input.dataset.pendingBase.trim() === "" || Number(input.dataset.pendingBase) !== Number(input.dataset.base)))
    .map(input => [input.dataset.statScore, input.dataset.pendingBase.trim() === "" ? null : Math.floor(Number(input.dataset.pendingBase))]);
}
