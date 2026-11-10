// Remove only the selected native status, preserving composite effects and
// registering compensation before a potentially partial batch deletion.
export async function removeConditionEffects(actor, effects, statusId, change) {
  if (!effects.length) return 0;
  const single = effects.filter(effect => effect.statuses.size === 1);
  for (const effect of effects.filter(effect => effect.statuses.size > 1)) {
    const statuses = [...effect.statuses];
    await change(
      () => effect.update({ statuses: statuses.filter(id => id !== statusId) }),
      () => effect.update({ statuses }, { worldsBeyondCorrection: true })
    );
    if (effect.statuses.has(statusId)) throw new Error("The condition was not removed. Correct it on the Status tab.");
  }
  const snapshots = single.map(effect => effect.toObject());
  const ids = single.map(effect => effect.id);
  if (!ids.length) return effects.length;
  await change(
    () => Promise.resolve(true),
    async () => {
      const missing = snapshots.filter(effect => !actor.effects.get(effect._id));
      if (!missing.length) return true;
      await actor.createEmbeddedDocuments("ActiveEffect", missing, { keepId: true, worldsBeyondCorrection: true });
      return ids.every(id => actor.effects.get(id));
    }
  );
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  if (ids.some(id => actor.effects.get(id))) throw new Error("The condition was not removed. Correct it on the Status tab.");
  return effects.length;
}
