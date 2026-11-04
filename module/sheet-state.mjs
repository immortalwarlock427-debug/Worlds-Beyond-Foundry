export function restoreDisclosures(element, state) {
  for (const [id, open] of Object.entries(state.details ?? {})) {
    const details = element.querySelector(`details[data-sync="${id}"]`);
    if (details) details.open = open;
  }
}

// Replacing a tab replaces its CSS animation too. Continue the elapsed time from
// this window's first render instead of starting the vortex from zero.
export function continueVortex(element, startedAt) {
  for (const stream of element.querySelectorAll(".wb-vortex-streams")) {
    if (stream.dataset.motionStarted) continue;
    stream.style.animationDelay = `-${Math.max(0, performance.now() - startedAt)}ms`;
    stream.dataset.motionStarted = "true";
  }
}
