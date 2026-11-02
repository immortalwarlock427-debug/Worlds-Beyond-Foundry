import { triggerSnapshot, triggerTransitions, triggerCondition } from "./form-trigger-core.mjs";
import { useAbility } from "./abilities.mjs";
import { queuedAction } from "./action-support.mjs";
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const eligible = (actor, options, userId) => actor?.type === "character" && actor.isOwner && userId === game.user.id && !options.worldsBeyondFormTrigger;

export function captureFormTriggers(actor, changes, options, userId) {
  if (!eligible(actor, options, userId)) return;
  (options.worldsBeyondFormBefore ??= {})[actor.uuid] = triggerSnapshot(actor);
}

export function processFormTriggers(actor, changes, options, userId) {
  const before = options.worldsBeyondFormBefore?.[actor.uuid];
  if (!before || !eligible(actor, options, userId)) return;
  // Separate coordination key: Use itself queues on the actor, including paid
  // consumable/resource actions that may still be completing this update.
  return queuedAction(`form-triggers:${actor.uuid}`, async () => {
    const transitions = triggerTransitions(actor, before);
    for (const item of transitions.end) {
      if (item.system.trigger.endMode === "prompt" && !await foundry.applications.api.DialogV2.confirm({ classes: ["worlds-beyond", "wb-roll-dialog"], window: { title: "End transformation?" }, content: `<p>The resource no longer matches ${escapeHTML(item.name)}'s trigger. End this transformation?</p>`, rejectClose: false })) continue;
      await useAbility(actor, item.id, { end: true, triggered: true, guard: () => triggerCondition(actor.system, item.system.trigger) === false });
    }
    let choice = transitions.enter.filter(item => actor.items.get(item.id) === item && triggerCondition(actor.system, item.system.trigger) === true);
    if (!choice.length) return;
    if (choice.length > 1) {
      const form = await foundry.applications.api.DialogV2.input({ classes: ["worlds-beyond", "wb-roll-dialog"], window: { title: "Choose triggered form" },
        content: `<label>Several form triggers matched<select name="form">${choice.map((item, index) => `<option value="${index}">${escapeHTML(item.name)}</option>`).join("")}</select></label>`, ok: { label: "Enter form" }, rejectClose: false });
      if (!form) return;
      choice = [choice[Number(form.form)]];
    } else if (choice[0].system.trigger.mode === "prompt" && !await foundry.applications.api.DialogV2.confirm({ classes: ["worlds-beyond", "wb-roll-dialog"], window: { title: "Form trigger" }, content: `<p>Enter ${escapeHTML(choice[0].name)}? Configured entry costs apply.</p>`, rejectClose: false })) return;
    const item = choice[0]; if (!item) return;
    await useAbility(actor, item.id, { triggered: true, guard: () => actor.items.get(item.id) === item && triggerCondition(actor.system, item.system.trigger) === true });
  }).catch(error => ui.notifications.warn(`Form trigger: ${error.message}`));
}

export function registerFormTriggers() {
  Hooks.on("preUpdateActor", captureFormTriggers);
  Hooks.on("updateActor", processFormTriggers);
  // Enabling/editing a trigger also checks a value that is already beyond it.
  Hooks.on("preUpdateItem", (item, changes, options, userId) => { if (item.type === "ability" && (foundry.utils.hasProperty(changes, "system.trigger") || Object.keys(changes).some(key => key.startsWith("system.trigger.")))) captureFormTriggers(item.actor, changes, options, userId); });
  Hooks.on("updateItem", (item, changes, options, userId) => { if (item.actor) processFormTriggers(item.actor, changes, options, userId); });
}
