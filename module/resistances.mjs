// Suggestions explicitly named in Notion Game Systems: Weapons Explained and
// Status Effects Explained. This is not an exhaustive damage taxonomy.
export const RESISTANCE_TYPES = ["Bludgeoning", "Piercing", "Slashing", "Fire"];

export function normalizeResistances(values = []) {
  const seen = new Set();
  return values.flatMap(value => {
    if (typeof value !== "string") return [];
    const text = value.trim().replace(/\s+/g, " ");
    const key = text.toLowerCase();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [RESISTANCE_TYPES.find(type => type.toLowerCase() === key) ?? text];
  });
}

export function resistanceEditor(values) {
  const entries = normalizeResistances(values);
  return {
    types: RESISTANCE_TYPES.map((label, index) => ({ label, field: `resistance${index}`, selected: entries.includes(label) })),
    custom: entries.filter(label => !RESISTANCE_TYPES.includes(label)).join("\n")
  };
}

export function resistanceSelection(form) {
  return normalizeResistances([
    ...RESISTANCE_TYPES.filter((_type, index) => form[`resistance${index}`] === true),
    ...String(form.custom ?? "").split(/\r?\n/)
  ]);
}

// Exact individual-type lookup for later damage integration. Combined/conditional
// labels are kept intact; no inference about their meaning is made here.
export function isResistant(values, damageType) {
  const key = String(damageType ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return !!key && normalizeResistances(values).some(value => value.toLowerCase() === key);
}
