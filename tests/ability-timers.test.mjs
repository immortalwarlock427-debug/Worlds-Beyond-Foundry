import { test } from "node:test";
import assert from "node:assert/strict";
import { abilityActive, abilityTimeLeft, cooldownRemaining, abilityTimerFormUpdates } from "../module/ability-timers-core.mjs";
import { itemEffectState, itemEffectRows, effectContext } from "../module/effects-core.mjs";
import { abilityRecord } from "../module/abilities-core.mjs";
const clock = (id, kind, extra = {}) => ({ id, flags: { "worlds-beyond": { abilityTimer: kind } }, duration: { value: 3, remaining: 2, units: "rounds", label: "2 rounds", expired: false }, ...extra });
function fixture() {
  const item = { id: "spell", uuid: "Item.spell", type: "ability", name: "Power", documentName: "Item", effects: new Map(), system: { effectsActive: true, kind: "active", timers: { durationId: "duration", cooldownId: "cooldown" }, cooldown: { rounds: 3, remaining: 3, automatic: true } } };
  item.effects.set("duration", clock("duration", "duration")); item.effects.set("cooldown", clock("cooldown", "cooldown"));
  const bonus = { id: "bonus", uuid: "Item.spell.ActiveEffect.bonus", parent: item, flags: { "worlds-beyond": { managed: true, itemBound: true } }, system: { changes: [{ key: "system.stats.str.value", type: "add", phase: "initial", value: 3 }] } };
  item.effects.set("bonus", bonus); return { item, bonus };
}
test("native clocks hide from bonus definitions and expiry suppresses the owning ability immediately", () => {
  const { item, bonus } = fixture();
  assert.equal(abilityActive(item), true); assert.equal(cooldownRemaining(item), 2); assert.equal(abilityTimeLeft(item), "2 rounds left");
  assert.equal(itemEffectRows(item).length, 1); assert.equal(itemEffectState(bonus), "");
  item.effects.get("duration").duration.expired = true;
  assert.equal(abilityActive(item), false); assert.equal(itemEffectState(bonus), "Ability inactive");
  assert.equal(item.system.effectsActive, true, "Projection never writes source flags");
  assert.equal(cooldownRemaining(item), 2, "Duration expiry cannot clear the independent cooldown");
  item.effects.get("cooldown").duration.remaining = 0; assert.equal(cooldownRemaining(item), 1, "Still waiting for the native owner-turn expiry event");
  item.effects.get("cooldown").duration.expired = true; assert.equal(cooldownRemaining(item), 0);
  assert.equal(abilityRecord(item).effectsActive, false); assert.equal(abilityRecord(item).remaining, 0);
  item.effects.delete("duration"); item.effects.delete("cooldown");
  assert.equal(abilityActive(item), false); assert.equal(cooldownRemaining(item), 0, "Native delete-on-expiry policy also removes the cooldown immediately");
});
test("active forms without bonuses appear in Status but internal cooldowns and expired activations do not", () => {
  const { item } = fixture(); item.effects.delete("bonus"); item.system.kind = "form";
  const actor = { items: [item], system: {}, allApplicableEffects: () => item.effects.values() };
  let view = effectContext(actor); assert.equal(view.statuses.length, 1); assert.equal(view.statuses[0].source, "Form"); assert.equal(view.statuses[0].timeLeft, "2 rounds left");
  item.effects.get("duration").duration.expired = true; view = effectContext(actor); assert.equal(view.statuses.length, 0); assert.equal(view.hasActiveForm, false);
});
test("unchanged full-form saves preserve live clocks; manual corrections detach only their own clock", () => {
  const { item } = fixture();
  const unchanged = abilityTimerFormUpdates(item, { system: { effectsActive: true, cooldown: { remaining: 2 }, notes: "New notes" } });
  assert.equal(unchanged.system.effectsActive, undefined); assert.equal(unchanged.system.cooldown.remaining, undefined); assert.equal(unchanged.system.timers, undefined);
  let edited = abilityTimerFormUpdates(item, { system: { cooldown: { remaining: 0 } } }); assert.deepEqual(edited.system.timers, { cooldownId: "" });
  edited = abilityTimerFormUpdates(item, { system: { effectsActive: false } }); assert.deepEqual(edited.system.timers, { durationId: "" });
  edited = abilityTimerFormUpdates(item, { system: { cooldown: { automatic: false } } }); assert.equal(edited.system.cooldown.remaining, 2); assert.equal(edited.system.timers.cooldownId, "");
  assert.equal(item.system.timers.durationId, "duration"); assert.equal(item.system.cooldown.remaining, 3);
});
