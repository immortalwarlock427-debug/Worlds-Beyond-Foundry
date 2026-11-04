export function registerCombatPortraits() {
  const Tracker = CONFIG.ui.combat;
  CONFIG.ui.combat = class WorldsBeyondCombatTracker extends Tracker {
    async _getCombatantThumbnail(combatant) {
      const actor = combatant.actor;
      const state = actor?.getFlag("worlds-beyond", "formLoadoutState");
      if (state?.currentId && actor.img && actor.img !== state.basePortrait) return actor.img;
      const texture = combatant.token?.texture.src;
      if (texture && !combatant._source.img && !foundry.helpers.media.VideoHelper.hasVideoExtension(texture)) return texture;
      return super._getCombatantThumbnail(combatant);
    }
  };
  const refresh = predicate => {
    if (game.combats?.some(combat => combat.combatants.some(predicate))) {
      for (const tracker of game.combats.apps ?? []) if (tracker.rendered) tracker.render();
    }
  };
  Hooks.on("updateActor", (actor, changes) => {
    if ("img" in changes) refresh(combatant => combatant.actor?.uuid === actor.uuid);
  });
  Hooks.on("updateToken", (token, changes) => {
    if (changes.texture?.src !== undefined || "texture.src" in changes) refresh(combatant => combatant.token?.uuid === token.uuid);
  });
}

// Keep Foundry's initiative flow and attach only the context needed by Wonder.
export class CharacterCombatant extends foundry.documents.Combatant {
  getInitiativeRoll(formula) {
    const roll = super.getInitiativeRoll(formula);
    if (this.actor?.type === "character") {
      roll.options["worlds-beyond"] = {
        kind: "initiative",
        label: "Initiative",
        actorUuid: this.actor.uuid,
        combatId: this.parent.id,
        combatantId: this.id
      };
    }
    return roll;
  }
}
