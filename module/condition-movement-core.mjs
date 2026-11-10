// Foundry-free mobility rules from Notion Status Effects Explained.
export const MOBILITY_ACTIONS = {
  prone: { label: "Stand up", ap: 5 },
  grappled: { label: "Escape", ap: 5 }
};

export function conditionMovement(statuses = [], { exhaustionMultiplier = 1, stackProne = false } = {}) {
  const active = new Set(statuses);
  const prone = active.has("prone") || active.has("unconscious");
  const exhausted = Math.max(1, Number(exhaustionMultiplier) || 1);
  const blocked = [active.has("grappled") && "Grappled", active.has("restrain") && "Restrained"].filter(Boolean);
  return { prone, blocked, multiplier: stackProne ? exhausted * (prone ? 2 : 1) : Math.max(exhausted, prone ? 2 : 1) };
}

export function grappleEscapeDc(grapplerStr) {
  if (grapplerStr === null || grapplerStr === undefined || String(grapplerStr).trim() === "" || !Number.isFinite(Number(grapplerStr)))
    throw new Error("Enter the grappler's Strength modifier; ask the GM if it isn't known.");
  return 12 + Math.floor(Number(grapplerStr));
}

export const escapedGrapple = (total, dc, forced = false) => !!forced || (Number.isFinite(total) && total >= dc);
