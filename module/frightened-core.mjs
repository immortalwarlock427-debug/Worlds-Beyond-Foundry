// Square-grid distance between occupied footprint centers, matching reach's
// Chebyshev metric (adjacent diagonals are one square). Inputs are grid units.
function distanceLines(mover, source, dx = 0, dy = 0) {
  return [
    [0, 0],
    [source.x - (mover.x + mover.w - 1), -dx],
    [mover.x - (source.x + source.w - 1), dx],
    [source.y - (mover.y + mover.h - 1), -dy],
    [mover.y - (source.y + source.h - 1), dy]
  ];
}
export const fearDistance = (mover, source) => Math.max(...distanceLines(mover, source).map(([a]) => a));

// The maximum of these linear gaps is convex along a segment. Its minimum is
// at an endpoint or a crossing of two lines; don't miss a closer detour just
// because its final waypoint is farther away.
export function approachesFear(from, to, source, { teleport = false } = {}) {
  const start = fearDistance(from, source);
  if (teleport) return fearDistance(to, source) < start - 1e-6;
  const lines = distanceLines(from, source, to.x - from.x, to.y - from.y);
  const times = [0, 1];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const [a, b] = lines[i],
        [c, d] = lines[j];
      if (b === d) continue;
      const t = (c - a) / (b - d);
      if (t > 0 && t < 1) times.push(t);
    }
  return times.some(t => Math.max(...lines.map(([a, b]) => a + b * t)) < start - 1e-6);
}

// Unknown sources keep the prior editable "in sight" default. One visible
// source suffices, even if another source is occluded or unresolved.
export function fearSightDefault(states = []) {
  return states.length === 0 || states.some(state => state !== false);
}
