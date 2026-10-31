// Builds the world compendium from module/catalog.mjs. Foundry writes the pack files
// itself, so the repository needs no LevelDB build step.
import { CATALOG_VERSION, CATALOG_PACK, CATALOG_FOLDERS, catalogItems } from "./catalog.mjs";

const SYSTEM_ID = "worlds-beyond";
const SETTING = "catalogVersion";

export function registerCatalogSetting() {
  game.settings.register(SYSTEM_ID, SETTING, { scope: "world", config: false, type: Number, default: 0 });
}

// Creates the pack if needed, then creates missing folders/items and resets existing
// catalog items to the Notion values. Items added to the pack by hand are left alone.
export async function importCatalog() {
  if (!game.user.isGM) throw new Error("Only a GM can import the catalog.");
  const { CompendiumCollection } = foundry.documents.collections;
  const collection = `world.${CATALOG_PACK.name}`;
  const pack = game.packs.get(collection) ?? await CompendiumCollection.createCompendium({
    name: CATALOG_PACK.name, label: CATALOG_PACK.label, type: "Item"
  });
  if (pack.locked) await pack.configure({ locked: false });

  const folders = CATALOG_FOLDERS.map(({ key, ...folder }) => folder);
  const newFolders = folders.filter(folder => !pack.folders.get(folder._id));
  if (newFolders.length) await foundry.documents.Folder.implementation.createDocuments(newFolders, { pack: collection, keepId: true });

  const index = await pack.getIndex();
  const items = catalogItems();
  const create = items.filter(item => !index.has(item._id));
  const update = items.filter(item => index.has(item._id));
  const Item = foundry.documents.Item.implementation;
  if (create.length) await Item.createDocuments(create, { pack: collection, keepId: true });
  if (update.length) await Item.updateDocuments(update, { pack: collection, diff: false, recursive: false });

  await game.settings.set(SYSTEM_ID, SETTING, CATALOG_VERSION);
  ui.notifications.info(`${CATALOG_PACK.label}: ${create.length} items added, ${update.length} refreshed.`);
  return pack;
}

// Offer the import once per catalog version so new worlds and Notion updates get it.
export async function offerCatalogImport() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (game.settings.get(SYSTEM_ID, SETTING) >= CATALOG_VERSION) return;
  const exists = !!game.packs.get(`world.${CATALOG_PACK.name}`);
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: CATALOG_PACK.label },
    content: exists
      ? "<p>The Worlds Beyond weapon and armor catalog has been updated from Notion. Refresh the compendium now? Catalog items you edited inside the compendium are reset. Items already on characters are not changed.</p>"
      : "<p>Import the Worlds Beyond weapon, armor and shield catalog into a world compendium? Drag items from it onto character sheets.</p>",
    rejectClose: false
  });
  if (!confirmed) return game.settings.set(SYSTEM_ID, SETTING, CATALOG_VERSION);
  try { await importCatalog(); }
  catch (error) { ui.notifications.error(`Catalog import failed: ${error.message}`); console.error(error); }
}

// "Import catalog" button under Configure Settings → Worlds Beyond. Foundry opens a
// settings menu by rendering its class, so rendering runs the import instead of a window.
export class CatalogImportMenu extends foundry.applications.api.ApplicationV2 {
  async render() {
    try { await importCatalog(); }
    catch (error) { ui.notifications.error(`Catalog import failed: ${error.message}`); console.error(error); }
    return this;
  }
}

export function registerCatalogMenu() {
  game.settings.registerMenu(SYSTEM_ID, "catalogImport", {
    name: "Weapon and armor catalog",
    label: "Import or refresh catalog",
    hint: "Creates or refreshes the Worlds Beyond Catalog compendium from the Notion weapon, armor and shield tables.",
    icon: "fa-solid fa-book",
    type: CatalogImportMenu,
    restricted: true
  });
}
