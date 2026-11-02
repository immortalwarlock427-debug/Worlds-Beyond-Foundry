// Presentation only: colors never participate in resource calculations.
export function normalizeBarColor(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (!match) throw new Error("Enter a hex color such as #6FD6FF or #ABC, or clear it for the default.");
  const hex = match[1].toUpperCase();
  return `#${hex.length === 3 ? [...hex].map(c => c + c).join("") : hex}`;
}
export function barColorContext(pool = {}) {
  const colors = pool.barColors ?? {}, barColors = { start: colors.start ?? "", end: colors.end ?? "" };
  // Advanced/imported invalid values should not break a sheet or become CSS.
  const safe = value => { try { return normalizeBarColor(value); } catch { return ""; } };
  const start = safe(barColors.start), end = safe(barColors.end);
  const fill = start && end ? `linear-gradient(90deg, ${start}, ${end})` : start || end;
  return { barColors, barStyle: fill ? `background:${fill};` : "" };
}
export function barColorFormUpdates(system, data) {
  const normalize = (saved, edited) => {
    if (!edited?.barColors) return;
    for (const key of ["start", "end"]) {
      if (!Object.hasOwn(edited.barColors, key)) continue;
      const color = normalizeBarColor(edited.barColors[key]);
      if (color === (saved?.barColors?.[key] ?? "")) delete edited.barColors[key];
      else edited.barColors[key] = color;
    }
    if (!Object.keys(edited.barColors).length) delete edited.barColors;
  };
  for (const key of ["health", "ap", "reactions", "wonder", "mana", "holyPower"]) normalize(system[key], data.system?.[key]);
  for (const [id, edited] of Object.entries(data.system?.customResources ?? {})) {
    if (Object.hasOwn(system.customResources ?? {}, id)) normalize(system.customResources[id], edited);
  }
  return data;
}
