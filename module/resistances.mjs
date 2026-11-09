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

// One editor section. `prefix` names its fields: "resistance" keeps the original field names
// (resistance0…, custom); "immunity" uses immunity0… and customImmunity.
function editorSection(values, prefix) {
  const entries = normalizeResistances(values);
  return {
    types: RESISTANCE_TYPES.map((label, index) => ({ label, field: `${prefix}${index}`, selected: entries.includes(label) })),
    custom: entries.filter(label => !RESISTANCE_TYPES.includes(label)).join("\n")
  };
}

function sectionSelection(form, prefix, customField) {
  return normalizeResistances([
    ...RESISTANCE_TYPES.filter((_type, index) => form[`${prefix}${index}`] === true),
    ...String(form[customField] ?? "").split(/\r?\n/)
  ]);
}

export function resistanceEditor(values, immunities = []) {
  return { ...editorSection(values, "resistance"), immunity: editorSection(immunities, "immunity") };
}

export function resistanceSelection(form) {
  return sectionSelection(form, "resistance", "custom");
}

export function immunitySelection(form) {
  return sectionSelection(form, "immunity", "customImmunity");
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
