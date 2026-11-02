import { itemList, stowedConflicts } from "./loadout.mjs";
import { timerKind } from "./ability-timers-core.mjs";

// Batch preflight uses Foundry v14's supported Item operation API. The switch
// and all resulting stows are sent in one update, including item-sheet edits.
export function normalizeHandUpdates(actor, updates) {
  const relevant = updates.filter(update => {
    const item = actor.items.get(update._id);
    const changed = path => foundry.utils.hasProperty(update, path)
      && !!foundry.utils.getProperty(update, path) !== !!foundry.utils.getProperty(item, path);
    return ["weapon", "shield"].includes(item?.type) &&
      (changed("system.equipped") ||
        (item.system.equipped && ["light", "twoHanded", "strapped"].some(key => changed(`system.properties.${key}`))));
  });
  if (!relevant.length) return [];
  const proposed = itemList(actor.items).map(item => {
    const data = { id: item.id, type: item.type, system: item.system.toObject?.() ?? structuredClone(item.system) };
    const update = updates.find(entry => entry._id === item.id);
    return update ? foundry.utils.mergeObject(data, update, { inplace: false }) : data;
  });
  const stowed = stowedConflicts(proposed, relevant.map(update => update._id));
  for (const id of stowed) {
    let update = updates.find(entry => entry._id === id);
    if (!update) { update = { _id: id }; updates.push(update); }
    foundry.utils.setProperty(update, "system.equipped", false);
  }
  return stowed;
}

export function registerEquipmentItem() {
  const Base = CONFIG.Item.documentClass;
  CONFIG.Item.documentClass = class WorldsBeyondItem extends Base {
    static async _preUpdateOperation(documents, operation, user) {
      if (await super._preUpdateOperation(documents, operation, user) === false) return false;
      const actor = operation.parent ?? documents[0]?.actor;
      if (actor?.type !== "character") return;
      const stowed = normalizeHandUpdates(actor, operation.updates);
      if (stowed.length) operation.worldsBeyondStowed = stowed.map(id => actor.items.get(id)?.name).filter(Boolean);
    }

    static async _onUpdateOperation(documents, operation, user) {
      await super._onUpdateOperation(documents, operation, user);
      if (user.id === game.user.id && operation.worldsBeyondStowed?.length) ui.notifications.info(`Stowed: ${operation.worldsBeyondStowed.join(", ")}.`);
    }

    static async _preCreateOperation(documents, operation, user) {
      if (await super._preCreateOperation(documents, operation, user) === false) return false;
      // Carried copies start stowed, including drops of already equipped items.
      // Existing actors/items are never rewritten merely by opening a world.
      if (operation.parent?.type !== "character") return;
      for (const item of documents) {
        if (["weapon", "shield"].includes(item.type) && item.system.equipped) item.updateSource({ "system.equipped": false });
        if (item.type === "ability" && item.system.effectsActive) item.updateSource({ "system.effectsActive": false });
        const effects = Array.from(item.effects?.values?.() ?? item.effects ?? []);
        if (item.type === "ability" && (item.system.timers?.durationId || item.system.timers?.cooldownId || effects.some(timerKind))) item.updateSource({
          "system.timers.durationId": "", "system.timers.cooldownId": "",
          effects: effects.filter(effect => !timerKind(effect)).map(effect => effect.toObject())
        });
      }
    }
  };
}
