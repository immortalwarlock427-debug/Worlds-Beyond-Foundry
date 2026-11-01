// Whole-number controls/presentation, separate from exact resource/rules math.
export const wholeNumber = value => typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : value;

export function wholeDisplay(value) {
  if (Array.isArray(value)) return value.map(wholeDisplay);
  if (value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, wholeDisplay(entry)]));
  }
  return wholeNumber(value);
}

const read = (data, path) => path.split(".").reduce((entry, key) => entry?.[key], data);
function write(data, path, value, remove = false) {
  const keys = path.split("."), key = keys.pop();
  const parent = keys.reduce((entry, key) => entry[key] ??= {}, data);
  if (remove) delete parent[key]; else parent[key] = value;
}

// Only numeric controls are normalized: names, descriptions and formulas stay text.
// A displayed whole value must not overwrite an unchanged fractional source.
export function wholeFormUpdates(data, form, original) {
  for (const input of form?.querySelectorAll('input[type="number"][name]') ?? []) {
    if (input.disabled || !input.name) continue;
    const value = read(data, input.name);
    if (value == null || String(value).trim() === "" || !Number.isFinite(Number(value))) continue;
    const next = Math.floor(Number(value)), previous = read(original, input.name);
    write(data, input.name, next, typeof previous === "number" && Number.isFinite(previous) && next === Math.floor(previous));
  }
  return data;
}

const bound = new WeakSet();
export function bindWholeNumbers(element) {
  if (!element?.addEventListener || bound.has(element)) return;
  bound.add(element);
  const normalize = input => {
    if (input.disabled || input.readOnly || input.value.trim() === "") return;
    const value = Number(input.value);
    if (Number.isFinite(value)) input.value = String(Math.floor(value));
  };
  // Capture runs before Foundry validates/submits the form. Do not rewrite while typing.
  element.addEventListener("change", event => {
    if (event.target.matches?.('input[type="number"]')) normalize(event.target);
  }, true);
  const normalizeAll = () => {
    for (const input of element.querySelectorAll('input[type="number"]')) normalize(input);
  };
  element.addEventListener("submit", normalizeAll, true);
  element.addEventListener("keydown", event => {
    if (event.key === "Enter") normalizeAll();
  }, true);
}
