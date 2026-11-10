// Notion Status Effects Explained: these conditions include Incapacitated.
// Do not turn unrelated statuses into action restrictions or rewrite their IDs.
const INCAPACITATING = {
  incapacitated: "Incapacitated",
  paralysis: "Paralyzed",
  petrified: "Petrified",
  stun: "Stunned",
  unconscious: "Unconscious"
};

export function incapacitationSources(statuses = []) {
  const active = new Set(statuses);
  return Object.entries(INCAPACITATING)
    .filter(([id]) => active.has(id))
    .map(([, label]) => label);
}

export function actionCapacity(statuses, { ap = 0, reaction = false } = {}) {
  const sources = incapacitationSources(statuses);
  return { sources, blocked: sources.length > 0 && (Number(ap) > 0 || !!reaction) };
}
