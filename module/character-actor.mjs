import { damageFromHealth } from "./core-numbers.mjs";

export class CharacterActor extends foundry.documents.Actor {
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    if (this.type !== "character" || !isBar || !["health", "ap", "reactions"].includes(attribute)) {
      return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
    }
    const pool = this.system[attribute];
    const current = isDelta ? pool.value + value : value;
    const updates = attribute === "health"
      ? { "system.health.damage": damageFromHealth(pool.max, current) }
      : { [`system.${attribute}.value`]: current };
    // Preserve Foundry's hook contract while allowing the same free corrections as the sheet.
    if (Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates, this) === false) return this;
    return this.update(updates);
  }
}
