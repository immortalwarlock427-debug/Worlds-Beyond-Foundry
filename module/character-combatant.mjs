// Keep Foundry's initiative flow and attach only the context needed by Wonder.
export class CharacterCombatant extends foundry.documents.Combatant {
  getInitiativeRoll(formula) {
    const roll = super.getInitiativeRoll(formula);
    if (this.actor?.type === "character") {
      roll.options["worlds-beyond"] = {
        kind: "initiative", label: "Initiative", actorUuid: this.actor.uuid,
        combatId: this.parent.id, combatantId: this.id
      };
    }
    return roll;
  }
}
