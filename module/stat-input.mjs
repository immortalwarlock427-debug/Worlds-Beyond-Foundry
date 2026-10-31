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
    input.dataset.pendingBase = input.value;
    input.classList.add("is-manual");
  });
  input.addEventListener("blur", () => {
    if (input.dataset.pendingBase?.trim() === "" || !Number.isFinite(Number(input.dataset.pendingBase ?? input.dataset.base))) delete input.dataset.pendingBase;
    const base = input.dataset.pendingBase ?? input.dataset.base;
    const delta = Number(input.dataset.effective) - Number(input.dataset.base);
    input.value = String(Number(base) + delta);
    input.classList.toggle("is-manual", input.dataset.manual === "true" || Number(base) !== Number(input.dataset.base));
    input.classList.toggle("is-adjusted", delta !== 0);
  });
}

export function editedStatInputs(form) {
  return Array.from(form?.querySelectorAll("[data-stat-score]") ?? [])
    .filter(input => input.dataset.pendingBase !== undefined && input.dataset.pendingBase.trim() !== "" && Number(input.dataset.pendingBase) !== Number(input.dataset.base))
    .map(input => [input.dataset.statScore, Number(input.dataset.pendingBase)]);
}
