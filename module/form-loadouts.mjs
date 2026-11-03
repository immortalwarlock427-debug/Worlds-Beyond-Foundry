import { activeLoadoutForm, equipmentSnapshot, equipmentPlan, formGear, hasPhysicalLoadout } from "./form-loadout-core.mjs";
import { itemList } from "./loadout.mjs";
import { queuedAction, reversibleAction } from "./action-support.mjs";
const SCOPE = "worlds-beyond",
  KEY = "formLoadoutState";
// v14 mutates each operation with parentUuid and hook snapshots. Never reuse it
// across Item/Actor writes, compensation, or another character's transaction.
const operation = () => ({ worldsBeyondFormLoadout: true });

export function formLoadoutSchema() {
  const { SchemaField, StringField, BooleanField, TypedObjectField, NumberField } = foundry.data.fields;
  const map = () => new TypedObjectField(new BooleanField({ required: true, nullable: false, initial: false }));
  return new SchemaField({
    portrait: new StringField({ required: true, nullable: false, blank: true, initial: "" }),
    portraitY: new NumberField({ required: true, nullable: true, initial: null, integer: true, min: 0, max: 100 }),
    gearEnabled: new BooleanField({ initial: false }),
    equipment: map(),
    abilities: map(),
    resources: map()
  });
}
export function formLoadoutContext(item) {
  const actor = item.actor,
    config = item.system.loadout ?? {};
  const items = itemList(actor?.items);
  return {
    equipment: items.filter(formGear).map(entry => ({ id: entry.id, name: entry.name, selected: config.equipment?.[entry.id] === true })),
    abilities: items
      .filter(entry => entry.type === "ability" && entry.system.kind !== "form")
      .map(entry => ({ id: entry.id, name: entry.name, selected: config.abilities?.[entry.id] !== false })),
    resources: [
      ...["mana", "holyPower"].map(id => ({ id, name: id === "mana" ? "Mana" : "Holy power" })),
      ...Object.entries(actor?.system.customResources ?? {}).map(([id, pool]) => ({ id, name: pool.name || "Resource" }))
    ].map(entry => ({ ...entry, selected: config.resources?.[entry.id] !== false }))
  };
}

// Called within the existing actor transaction. Only equipped flags, portraits
// and a small restore receipt change; inventory records and balances stay shared.
export async function syncFormLoadout(actor, change, { edited = false, gearEdited = edited } = {}) {
  const form = activeLoadoutForm(actor),
    saved = actor.getFlag?.(SCOPE, KEY);
  const previous = saved ? structuredClone(saved) : undefined;
  const nextId = hasPhysicalLoadout(form) ? form.id : "";
  if (!previous?.currentId && !nextId) return;
  if (!edited && previous?.currentId === nextId) return;
  const prior = actor.items.get(previous?.currentId);
  const currentGear = equipmentSnapshot(actor);
  let baseEquipment = previous?.baseEquipment ?? currentGear,
    basePortrait = previous?.basePortrait ?? actor.img;
  if (!previous?.currentId) {
    baseEquipment = currentGear;
    basePortrait = actor.img;
  } else if (previous.currentId !== nextId && prior) {
    if (previous.gearEnabled) {
      const old = { ...(prior.system.loadout.equipment ?? {}) };
      if (Object.entries(currentGear).some(([id, value]) => old[id] !== value)) {
        const restore = {
          ...Object.fromEntries(
            Object.keys(currentGear)
              .filter(id => !Object.hasOwn(old, id))
              .map(id => [id, new foundry.data.operators.ForcedDeletion()])
          ),
          ...old
        };
        await change(
          () => prior.update({ "system.loadout.equipment": currentGear }, operation()),
          () => prior.update({ "system.loadout.equipment": restore }, operation())
        );
      }
    } else baseEquipment = currentGear;
  }
  if (previous?.currentId === nextId && !previous.gearEnabled) baseEquipment = currentGear;
  const desired =
    previous?.currentId === nextId && !gearEdited
      ? currentGear
      : nextId && form.system.loadout.gearEnabled
        ? form.system.loadout.equipment
        : baseEquipment;
  const updates = equipmentPlan(actor, desired);
  if (updates.length) {
    const restore = updates.map(update => ({ _id: update._id, "system.equipped": currentGear[update._id] }));
    // Register compensation first: native batches may fail after a partial apply.
    await change(
      () => actor,
      () => actor.updateEmbeddedDocuments("Item", restore, { ...operation(), worldsBeyondFormRestore: true })
    );
    await actor.updateEmbeddedDocuments("Item", updates, operation());
    if (updates.some(update => !!actor.items.get(update._id)?.system.equipped !== update["system.equipped"]))
      throw new Error("The form's equipment switch was cancelled or not retained.");
  }
  const img = nextId && form.system.loadout.portrait ? form.system.loadout.portrait : basePortrait;
  const state = { currentId: nextId, basePortrait, baseEquipment, gearEnabled: !!(nextId && form.system.loadout.gearEnabled) };
  const changes = {};
  if (actor.img !== img) changes.img = img;
  if (JSON.stringify(previous) !== JSON.stringify(state)) changes[`flags.${SCOPE}.${KEY}`] = state;
  if (!Object.keys(changes).length) return;
  const restore = { img: actor.img, [`flags.${SCOPE}.${KEY}`]: previous ?? new foundry.data.operators.ForcedDeletion() };
  await change(
    () => actor.update(changes, operation()),
    () => actor.update(restore, operation())
  );
  if (actor.img !== img || JSON.stringify(actor.getFlag(SCOPE, KEY)) !== JSON.stringify(state))
    throw new Error("The form's portrait or restore state was not retained.");
}

export async function copyFormEquipment(item) {
  const actor = item.actor;
  if (!item.isOwner || !actor?.isOwner || item.system.kind !== "form") return;
  return queuedAction(actor.uuid, () =>
    item.update({ "system.loadout.gearEnabled": true, "system.loadout.equipment": equipmentSnapshot(actor) })
  );
}
export async function setCharacterPortrait(actor, path) {
  if (!actor.isOwner) return;
  return queuedAction(actor.uuid, () => {
    const form = activeLoadoutForm(actor);
    return form ? form.update({ "system.loadout.portrait": path }) : actor.update({ img: path });
  });
}
export function registerFormLoadouts() {
  const reconcile = (actor, options = {}, userId, edits = {}) => {
    if (actor?.type !== "character" || !actor.isOwner || options.worldsBeyondFormLoadout) return;
    if (game.users?.activeGM ? !game.user?.isActiveGM : userId !== game.user?.id) return;
    return queuedAction(actor.uuid, () => reversibleAction(change => syncFormLoadout(actor, change, edits))).catch(error =>
      ui.notifications.error(`Form loadout: ${error.message}`)
    );
  };
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (item.type !== "ability") return;
    const changed = key =>
      Object.hasOwn(changes.system?.loadout ?? {}, key) ||
      Object.keys(changes).some(path => path === `system.loadout.${key}` || path.startsWith(`system.loadout.${key}.`));
    return reconcile(item.actor, options, userId, {
      edited: ["portrait", "gearEnabled", "equipment"].some(changed),
      gearEdited: ["gearEnabled", "equipment"].some(changed)
    });
  });
  Hooks.on("deleteItem", (item, options, userId) => reconcile(item.actor, options, userId));
  const clock = (effect, changes, options, userId) => {
    if (options?.worldsBeyondAbilityTimers) return;
    if (effect.parent?.type === "ability") reconcile(effect.parent.actor, options, userId);
    else if (effect.flags?.[SCOPE]?.kind === "form") reconcile(effect.parent, options, userId);
  };
  Hooks.on("updateActiveEffect", clock);
  Hooks.on("deleteActiveEffect", (effect, options, userId) => clock(effect, {}, options, userId));
  const resume = () => {
    const actors = new Set([...game.actors, ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)].filter(Boolean));
    for (const actor of actors) if (actor.getFlag?.(SCOPE, KEY)?.currentId) reconcile(actor, {}, game.user?.id);
  };
  Hooks.once("ready", resume);
  Hooks.on("canvasReady", resume);
}
