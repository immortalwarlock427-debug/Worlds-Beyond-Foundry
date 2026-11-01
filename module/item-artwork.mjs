import { itemIcon } from "./item-icons.mjs";

// Update displayed stock thumbnails, never Documents, compendium data or rules.
// World Items and Compendium index entries share Foundry v14's entry markup.
export function decorateEquipmentDirectory(application, html) {
  if (application.documentName !== "Item") return;
  for (const row of html.querySelectorAll(".directory-item[data-entry-id]")) {
    const item = application.collection.get(row.dataset.entryId) ?? application.collection.index?.get(row.dataset.entryId);
    const thumbnail = row.querySelector("img.thumbnail");
    if (!item || !thumbnail) continue;
    thumbnail.src = itemIcon(item);
  }
}
