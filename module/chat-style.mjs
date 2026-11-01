import { wholeNumber } from "./number-display.mjs";

// Theme only visible system cards, including older cards whose message flags
// differ (reloads and damage cards do not carry the original attack flag).
export function decorateSystemMessage(message, html) {
  if (!message.isContentVisible) return;
  if (!html.querySelector(".wb-roll-card, .wb-attack-card, .wb-consumable-card, .wb-block-card")) return;
  html.classList.add("worlds-beyond", "wb-chat-message");
  for (const total of html.querySelectorAll?.(".dice-total") ?? []) {
    const value = total.textContent.trim();
    if (value !== "" && Number.isFinite(Number(value))) total.textContent = String(wholeNumber(Number(value)));
  }
}
