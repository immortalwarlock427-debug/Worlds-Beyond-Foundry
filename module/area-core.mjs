// Foundry-free area shapes for targeted abilities. Coordinates are canvas pixels;
// sizes are converted from feet by the caller (pixels per foot = grid size ÷ grid distance).

export const AREA_SHAPES = Object.freeze({
  single: "Single target",
  circle: "Circle (placed)",
  aura: "Around you",
  cone: "Cone from you",
  line: "Line from you"
});

// Feet used when a size is left blank.
export const AREA_DEFAULTS = Object.freeze({
  circle: { size: 10 },
  aura: { size: 10 },
  cone: { size: 15, angle: 60 },
  line: { size: 30, width: 5 }
});

export const VISUAL_EFFECTS = Object.freeze({
  none: "None",
  lightning: "Lightning",
  fire: "Fire",
  ice: "Ice",
  arcane: "Arcane",
  holy: "Holy",
  shadow: "Shadow",
  poison: "Poison",
  force: "Force"
});

// Default color for each effect, used when the ability's color is blank.
export const VISUAL_COLORS = Object.freeze({
  lightning: "#8fd3ff",
  fire: "#ff7a1a",
  ice: "#bdf0ff",
  arcane: "#b07cff",
  holy: "#ffe28a",
  shadow: "#6b4a8f",
  poison: "#7cdc4a",
  force: "#d6a85c"
});

const number = (value, fallback) => {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const isArea = shape => ["circle", "aura", "cone", "line"].includes(shape);

// Fill in blank sizes with the defaults above.
export function areaSettings(area = {}) {
  const shape = Object.hasOwn(AREA_SHAPES, area.shape) ? area.shape : "single";
  const defaults = AREA_DEFAULTS[shape] ?? {};
  return {
    shape,
    size: number(area.size, defaults.size ?? 0),
    width: number(area.width, defaults.width ?? 5),
    angle: Math.min(360, number(area.angle, defaults.angle ?? 60)),
    includeSelf: !!area.includeSelf
  };
}

export function areaLabel(area = {}) {
  const settings = areaSettings(area);
  if (settings.shape === "single") return "Single target";
  if (settings.shape === "circle") return `${settings.size} ft radius circle`;
  if (settings.shape === "aura") return `${settings.size} ft around you`;
  if (settings.shape === "cone") return `${settings.size} ft cone (${settings.angle}°)`;
  return `${settings.size} ft line, ${settings.width} ft wide`;
}

// A concrete shape in pixels. `origin` is the caster's center; `point` is where the
// player aims (the circle's center, or the direction of a cone or line).
export function buildShape(settings, { origin, point, pixelsPerFoot }) {
  const ppf = Number(pixelsPerFoot) || 1;
  const size = settings.size * ppf;
  const direction = Math.atan2(point.y - origin.y, point.x - origin.x);
  if (settings.shape === "circle") return { type: "circle", x: point.x, y: point.y, radius: size };
  if (settings.shape === "aura") return { type: "circle", x: origin.x, y: origin.y, radius: size };
  if (settings.shape === "cone")
    return { type: "cone", x: origin.x, y: origin.y, radius: size, direction, angle: (settings.angle * Math.PI) / 180 };
  if (settings.shape === "line") return { type: "line", x: origin.x, y: origin.y, length: size, width: settings.width * ppf, direction };
  return null;
}

const angleBetween = (a, b) => {
  let difference = (a - b) % (2 * Math.PI);
  if (difference > Math.PI) difference -= 2 * Math.PI;
  if (difference < -Math.PI) difference += 2 * Math.PI;
  return Math.abs(difference);
};

export function pointInShape(shape, point) {
  const dx = point.x - shape.x,
    dy = point.y - shape.y;
  const distance = Math.hypot(dx, dy);
  if (shape.type === "circle") return distance <= shape.radius + 0.5;
  if (shape.type === "cone") {
    if (distance > shape.radius + 0.5) return false;
    if (distance < 0.5) return true;
    return angleBetween(Math.atan2(dy, dx), shape.direction) <= shape.angle / 2 + 1e-9;
  }
  if (shape.type === "line") {
    const along = dx * Math.cos(shape.direction) + dy * Math.sin(shape.direction);
    const across = -dx * Math.sin(shape.direction) + dy * Math.cos(shape.direction);
    return along >= -0.5 && along <= shape.length + 0.5 && Math.abs(across) <= shape.width / 2 + 0.5;
  }
  return false;
}

// A token counts when its center, or a point a quarter of the way in from any corner,
// is inside. Clipping a corner doesn't count; covering part of its space does.
export function tokenSamples({ x, y, width, height }) {
  const inset = (fraction, size) => size * fraction;
  return [
    { x: x + width / 2, y: y + height / 2 },
    { x: x + inset(0.25, width), y: y + inset(0.25, height) },
    { x: x + inset(0.75, width), y: y + inset(0.25, height) },
    { x: x + inset(0.25, width), y: y + inset(0.75, height) },
    { x: x + inset(0.75, width), y: y + inset(0.75, height) }
  ];
}

export function tokensInShape(shape, tokens = [], { excludeId = null } = {}) {
  if (!shape) return [];
  return tokens.filter(token => token.id !== excludeId && tokenSamples(token).some(point => pointInShape(shape, point)));
}

// Accepts #RGB or #RRGGBB (with or without #); returns a 0xRRGGBB number or null.
export function colorNumber(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(text))
    return parseInt(
      text
        .split("")
        .map(c => c + c)
        .join(""),
      16
    );
  if (/^[0-9a-f]{6}$/i.test(text)) return parseInt(text, 16);
  return null;
}

export function visualSettings(visual = {}) {
  const effect = Object.hasOwn(VISUAL_EFFECTS, visual.effect) ? visual.effect : "none";
  const color = colorNumber(visual.color) ?? colorNumber(VISUAL_COLORS[effect]) ?? 0xffffff;
  return { effect, color };
}
