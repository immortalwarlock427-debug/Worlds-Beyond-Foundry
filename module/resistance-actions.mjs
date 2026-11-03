import { queuedAction } from "./action-support.mjs";
import { normalizeResistances, resistanceEditor, resistanceSelection } from "./resistances.mjs";

export async function configureResistances(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/worlds-beyond/templates/resistance-dialog.hbs",
    resistanceEditor(actor.system.resistances)
  );
  const form = await foundry.applications.api.DialogV2.input({
    classes: ["worlds-beyond", "wb-roll-dialog"],
    position: { width: 440 },
    window: { title: "Resistances" },
    content,
    ok: { label: "Save resistances" },
    rejectClose: false
  });
  if (!form) return;
  return queuedAction(actor.uuid, async () => {
    if (!actor.isOwner) return;
    const resistances = resistanceSelection(form);
    if (JSON.stringify(resistances) === JSON.stringify(actor.system.resistances ?? [])) return actor;
    const result = await actor.update({ "system.resistances": resistances });
    if (!result || JSON.stringify(normalizeResistances(actor.system.resistances)) !== JSON.stringify(resistances))
      throw new Error("Resistances were not saved. Reopen the editor and try again.");
    return result;
  });
}
