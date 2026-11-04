import { damageFromHealth } from "./core-numbers.mjs";
import { MAGIC_RESOURCES, poolSpentForCurrent, customResourceId } from "./resources.mjs";

export class CharacterActor extends foundry.documents.Actor {
  async onUpdateEffectDurations(effects, event, context) {
    await super.onUpdateEffectDurations(effects, event, context);
    if (this.type === "character") this.render(false, { renderContext: "updateEffectDurations" });
    for (const item of new Set(effects.filter(effect => effect.parent?.documentName === "Item").map(effect => effect.parent)))
      item.render(false, { renderContext: "updateEffectDurations" });
  }

  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    // Token bars (including Bar Brawl's extra bars) can point at a custom pool as customResources.<id>.
    const customId = /^customResources\.(.+)$/.exec(attribute ?? "")?.[1];
    const custom = customId && customResourceId(customId) ? this.system.customResources?.[customId] : null;
    if (
      this.type !== "character" ||
      !isBar ||
      (!custom && !["health", "ap", "reactions", ...Object.keys(MAGIC_RESOURCES)].includes(attribute))
    ) {
      return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
    }
    const pool = custom ?? this.system[attribute];
    const current = isDelta ? pool.value + value : value;
    const updates =
      attribute === "health"
        ? { "system.health.damage": damageFromHealth(pool.max, current) }
        : custom
          ? { [`system.customResources.${customId}.spent`]: poolSpentForCurrent(pool.max, current) }
          : Object.hasOwn(MAGIC_RESOURCES, attribute)
            ? { [`system.${attribute}.spent`]: poolSpentForCurrent(pool.max, current) }
            : { [`system.${attribute}.value`]: current };
    // Preserve Foundry's hook contract while allowing the same free corrections as the sheet.
    if (Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates, this) === false) return this;
    return this.update(updates);
  }
}
