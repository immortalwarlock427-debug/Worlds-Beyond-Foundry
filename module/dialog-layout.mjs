import { bindWholeNumbers } from "./number-display.mjs";

const bound = new WeakSet();

// Native details can change a centered dialog's height after initial layout.
// Re-measure through ApplicationV2 so its public positioning API clamps the
// enlarged dialog to the viewport and keeps the action footer reachable.
export function fitDialogDisclosures(dialog) {
  bindWholeNumbers(dialog.element);
  for (const details of dialog.element.querySelectorAll(".wb-help")) {
    if (bound.has(details)) continue;
    bound.add(details);
    details.addEventListener("toggle", () => dialog.setPosition({ height: "auto" }));
  }
}
