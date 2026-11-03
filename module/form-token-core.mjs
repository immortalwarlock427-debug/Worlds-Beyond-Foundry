export const hasTokenLoadout = config =>
  !!(config?.tokenImg || ["tokenWidth", "tokenHeight", "tokenScale"].some(key => config?.[key] != null));

export function tokenAppearance(token) {
  return { src: token.texture.src, scaleX: token.texture.scaleX, scaleY: token.texture.scaleY, width: token.width, height: token.height };
}

export function tokenTransform(token, config, saved, gridSize = 0, restoring = false) {
  const before = tokenAppearance(token);
  const base = { ...(saved?.base ?? before) };
  const fields = {
    src: !restoring && !!config.tokenImg,
    width: !restoring && config.tokenWidth != null,
    height: !restoring && config.tokenHeight != null,
    scaleX: !restoring && config.tokenScale != null,
    scaleY: !restoring && config.tokenScale != null
  };
  const owned = saved?.fields ?? {};
  for (const key of Object.keys(fields)) if (fields[key] && !owned[key]) base[key] = before[key];
  const values = {
    src: config.tokenImg,
    width: config.tokenWidth,
    height: config.tokenHeight,
    scaleX: (Math.sign(base.scaleX) || 1) * config.tokenScale,
    scaleY: (Math.sign(base.scaleY) || 1) * config.tokenScale
  };
  const next = Object.fromEntries(Object.keys(fields).map(key => [key, fields[key] ? values[key] : owned[key] ? base[key] : before[key]]));
  const updates = {};
  for (const [key, path] of Object.entries({
    src: "texture.src",
    scaleX: "texture.scaleX",
    scaleY: "texture.scaleY",
    width: "width",
    height: "height"
  }))
    if (next[key] !== before[key]) updates[path] = next[key];
  const offsets = { offsetX: saved?.offsetX ?? 0, offsetY: saved?.offsetY ?? 0 };
  for (const [axis, size, offset] of [
    ["x", "width", "offsetX"],
    ["y", "height", "offsetY"]
  ]) {
    if (!Number.isFinite(token[axis]) || !gridSize) continue;
    const delta = next[size] - before[size];
    const shift =
      restoring || (owned[size] && !fields[size])
        ? -offsets[offset]
        : Number.isInteger(delta) && delta % 2 === 0
          ? (-delta * gridSize) / 2
          : 0;
    if (shift) updates[axis] = token[axis] + shift;
    offsets[offset] += shift;
  }
  return { updates, record: { base, fields, ...offsets } };
}
