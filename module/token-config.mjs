// Token settings list each character's custom pools (Ichor, Source...) as bar choices, so a token bar,
// including Bar Brawl's extra bars, can be pointed at one without typing its id.
import { customBarChoices } from "./resources.mjs";

const SYSTEM_ID = "worlds-beyond";

async function withCustomBars(app, context) {
  const extra = customBarChoices(app.actor?.type === "character" ? app.actor.system?.customResources : null);
  if (!extra.length || !Array.isArray(context?.barAttributes)) return context;
  const known = new Set(context.barAttributes.map(choice => choice.value));
  context.barAttributes = [...context.barAttributes, ...extra.filter(choice => !known.has(choice.value))];
  return context;
}

export function registerTokenConfig() {
  const { TokenConfig, PrototypeTokenConfig } = foundry.applications.sheets;
  class WorldsBeyondTokenConfig extends TokenConfig {
    async _prepareResourcesTab(...args) {
      return withCustomBars(this, await super._prepareResourcesTab(...args));
    }
  }
  class WorldsBeyondPrototypeTokenConfig extends PrototypeTokenConfig {
    async _prepareResourcesTab(...args) {
      return withCustomBars(this, await super._prepareResourcesTab(...args));
    }
  }
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.TokenDocument, SYSTEM_ID, WorldsBeyondTokenConfig, {
    makeDefault: true,
    label: "Worlds Beyond Token"
  });
  CONFIG.Token.prototypeSheetClass = WorldsBeyondPrototypeTokenConfig;
}
