import { activeLoadoutForm, equipmentSnapshot, equipmentPlan, formGear, hasPhysicalLoadout } from "./form-loadout-core.mjs";
import { itemList } from "./loadout.mjs";
import { queuedAction, reversibleAction } from "./action-support.mjs";
import { syncFormTokens } from "./form-tokens.mjs";
const SCOPE = "worlds-beyond",
  KEY = "formLoadoutState";
// v14 mutates each operation with parentUuid and hook snapshots. Never reuse it
// across Item/Actor writes, compensation, or another character's transaction.
const operation = () => ({ worldsBeyondFormLoadout: true });
// An unlinked token's actor merges its own flags over the sidebar actor's, so it
// inherits the sidebar receipt and can never drop keys from it. Token actors read
// and verify only the receipt stored on their own token.
const receipt = actor =>
  actor.isToken && actor.token?.delta
    ? foundry.utils.getProperty(actor.token.delta._source ?? actor.token.delta, `flags.${SCOPE}.${KEY}`)
    : actor.getFlag?.(SCOPE, KEY);

export function formLoadoutSchema() {
  const { SchemaField, StringField, BooleanField, TypedObjectField, NumberField } = foundry.data.fields;
  const map = () => new TypedObjectField(new BooleanField({ required: true, nullable: false, initial: false }));
  return new SchemaField({
    portrait: new StringField({ required: true, nullable: false, blank: true, initial: "" }),
    portraitY: new NumberField({ required: true, nullable: true, initial: null, integer: true, min: 0, max: 100 }),
    tokenImg: new StringField({ required: true, nullable: false, blank: true, initial: "" }),
    tokenWidth: new NumberField({ required: true, nullable: true, initial: null, positive: true }),
    tokenHeight: new NumberField({ required: true, nullable: true, initial: null, positive: true }),
    tokenScale: new NumberField({ required: true, nullable: true, initial: null, positive: true }),
    transitionSeconds: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
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
    saved = receipt(actor);
  const previous = saved ? structuredClone(saved) : undefined;
  const cleanGear = profile => Object.fromEntries(Object.entries(profile ?? {}).filter(([id]) => formGear(actor.items.get(id) ?? {})));
  // Replace maps so removed IDs cannot survive Foundry's merge updates.
  for (const item of itemList(actor.items).filter(item => item.type === "ability" && item.system.kind === "form")) {
    const old = item.system.loadout?.equipment;
    if (!old) continue;
    const clean = cleanGear(old);
    if (!foundry.utils.equals(old, clean))
      await change(
        () => item.update({ "system.loadout.equipment": new foundry.data.operators.ForcedReplacement(clean) }, operation()),
        () => item.update({ "system.loadout.equipment": new foundry.data.operators.ForcedReplacement(old) }, operation())
      );
  }
  const nextId = hasPhysicalLoadout(form) ? form.id : "";
  if (!previous && !nextId) return;
  const prior = actor.items.get(previous?.currentId);
  const currentGear = equipmentSnapshot(actor);
  let baseEquipment = cleanGear(previous?.baseEquipment ?? currentGear),
    basePortrait = previous?.basePortrait ?? actor.img;
  if (!previous?.currentId) {
    baseEquipment = currentGear;
    basePortrait = actor.img;
  } else if (previous.currentId !== nextId && prior) {
    if (previous.gearEnabled) {
      const old = { ...(prior.system.loadout.equipment ?? {}) };
      if (Object.entries(currentGear).some(([id, value]) => old[id] !== value)) {
        await change(
          () => prior.update({ "system.loadout.equipment": new foundry.data.operators.ForcedReplacement(currentGear) }, operation()),
          () => prior.update({ "system.loadout.equipment": new foundry.data.operators.ForcedReplacement(old) }, operation())
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
  const tokenState = await syncFormTokens(actor, form, change, previous?.tokenState);
  const state = {
    currentId: nextId,
    basePortrait,
    baseEquipment,
    gearEnabled: !!(nextId && form.system.loadout.gearEnabled),
    ...(tokenState ? { tokenState } : {})
  };
  const changes = {};
  if (actor.img !== img) changes.img = img;
  if (!foundry.utils.equals(previous, state)) changes[`flags.${SCOPE}.${KEY}`] = new foundry.data.operators.ForcedReplacement(state);
  if (!Object.keys(changes).length) return;
  const restore = {
    img: actor.img,
    [`flags.${SCOPE}.${KEY}`]: previous
      ? new foundry.data.operators.ForcedReplacement(previous)
      : new foundry.data.operators.ForcedDeletion()
  };
  await change(
    () => actor.update(changes, operation()),
    () => actor.update(restore, operation())
  );
  if (actor.img !== img || !foundry.utils.equals(receipt(actor), state))
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
      edited: ["portrait", "tokenImg", "tokenWidth", "tokenHeight", "tokenScale", "transitionSeconds", "gearEnabled", "equipment"].some(
        changed
      ),
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
    for (const actor of actors) if (receipt(actor)?.currentId) reconcile(actor, {}, game.user?.id);
  };
  Hooks.once("ready", resume);
  Hooks.on("canvasReady", resume);
}
