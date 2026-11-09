import { queuedAction } from "./action-support.mjs";
import { normalizeResistances, resistanceEditor, resistanceSelection, immunitySelection } from "./resistances.mjs";

export async function configureResistances(actor) {
  if (!actor.isOwner || actor.type !== "character") return;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/worlds-beyond/templates/resistance-dialog.hbs",
    resistanceEditor(actor.system.resistances, actor.system.immunities)
  );
  const form = await foundry.applications.api.DialogV2.input({
    classes: ["worlds-beyond", "wb-roll-dialog"],
    position: { width: 440 },
    window: { title: "Resistances and immunities" },
    content,
    ok: { label: "Save" },
    rejectClose: false
  });
  if (!form) return;
  return queuedAction(actor.uuid, async () => {
    if (!actor.isOwner) return;
    const resistances = resistanceSelection(form);
    const immunities = immunitySelection(form);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b ?? []);
    if (same(resistances, actor.system.resistances) && same(immunities, actor.system.immunities)) return actor;
    const result = await actor.update({ "system.resistances": resistances, "system.immunities": immunities });
    if (
      !result ||
      !same(normalizeResistances(actor.system.resistances), resistances) ||
      !same(normalizeResistances(actor.system.immunities), immunities)
    )
      throw new Error("Resistances and immunities were not saved. Reopen the editor and try again.");
    return result;
  });
}
