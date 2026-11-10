// Notion: Petrified is resistant to all damage and immune to new status effects.
export const petrifiedResistance = (statuses = []) => new Set(statuses).has("petrified");

export function blockedPetrifiedStatuses({ petrified = false, incoming = [], existing = [], active = true } = {}) {
  if (!petrified || !active) return [];
  const previous = new Set(existing);
  // Dead is Foundry's death bookkeeping marker, not a Notion condition. Stone
  // grants Resistance, not immortality; the death/defeated workflow must continue.
  return [...new Set(incoming)].filter(id => id !== "dead" && !previous.has(id));
}
