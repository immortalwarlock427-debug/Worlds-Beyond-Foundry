import { hasTokenLoadout, tokenAppearance, tokenTransform } from "./form-token-core.mjs";
const operation = () => ({ worldsBeyondFormLoadout: true });
const keyFor = token => `${token.parent?.id ?? "scene"}_${token.id}`;
// v14 interpolates a token's prepared width, scale and texture while it animates.
// The stored source holds the committed values, so plans and checks read it.
const stored = token => token?._source ?? token;

// All updates use fresh operation objects; native v14 mutates them with parent metadata.
export async function syncFormTokens(actor, form, change, previous) {
  const config = form?.system.loadout ?? {};
  const active = hasTokenLoadout(config);
  if (!active && !previous) return;
  const targets = [];
  if (actor.isToken) {
    if (actor.token) targets.push({ key: keyFor(actor.token), document: () => actor.token, placed: true });
  } else {
    if (actor.prototypeToken) targets.push({ key: "prototype", document: () => actor.prototypeToken, placed: false });
    const tokens = new Map((actor.getActiveTokens?.(true, true) ?? []).map(token => [keyFor(token), token]));
    for (const token of actor.getDependentTokens?.({ linked: true, concreteOnly: true }) ?? [])
      if (previous?.targets?.[keyFor(token)]) tokens.set(keyFor(token), token);
    for (const [key, token] of tokens) targets.push({ key, document: () => token, placed: true });
  }
  const seconds = active ? (config.transitionSeconds ?? 0) : (previous?.seconds ?? 0);
  const records = {};
  const prototype = actor.prototypeToken && tokenAppearance(stored(actor.prototypeToken));
  for (const target of targets) {
    const token = target.document(),
      data = stored(token);
    let saved = previous?.targets?.[target.key];
    // Tokens created from an already transformed prototype inherit its form values.
    if (!saved && previous?.targets?.prototype && prototype && target.placed && foundry.utils.equals(tokenAppearance(data), prototype))
      saved = { ...previous.targets.prototype, offsetX: 0, offsetY: 0 };
    if (!active && !saved) continue;
    const plan = tokenTransform(data, config, saved, target.placed ? (token.parent?.grid?.size ?? 0) : 0, !active);
    if (active) records[target.key] = plan.record;
    if (!Object.keys(plan.updates).length) continue;
    const restore = Object.fromEntries(Object.keys(plan.updates).map(path => [path, foundry.utils.getProperty(data, path)]));
    const write = (updates, animate) =>
      target.placed
        ? target.document().update(updates, {
            ...operation(),
            animate: animate && seconds > 0,
            animation: { duration: animate ? seconds * 1000 : 0, transition: "fade" },
            movement: {
              animate: animate && seconds > 0,
              animation: { duration: animate ? seconds * 1000 : 0 },
              showRuler: false,
              pan: false,
              autoRotate: false
            }
          })
        : actor.update(Object.fromEntries(Object.entries(updates).map(([path, value]) => [`prototypeToken.${path}`, value])), operation());
    // Register first so partial/cancelled writes also have compensation.
    await change(
      () => actor,
      () => write(restore, false)
    );
    const result = await write(plan.updates, true);
    if (
      !result ||
      Object.entries(plan.updates).some(([path, value]) => foundry.utils.getProperty(stored(target.document()), path) !== value)
    )
      throw new Error("The form's token transformation was cancelled or not retained.");
  }
  return active ? { targets: records, seconds } : undefined;
}
