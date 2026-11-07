// Map effects for abilities, drawn with PIXI on the canvas (no modules or image assets).
// Every client plays the same effect: the caster's client plays it and tells the others.
import { pointInShape } from "./area-core.mjs";
import { blendMode, circle, polygon, polyline, wedge } from "./draw.mjs";

const SYSTEM_ID = "worlds-beyond";
const SOCKET = `system.${SYSTEM_ID}`;
const DURATION = { lightning: 900, fire: 1400, ice: 1200, arcane: 1300, holy: 1300, shadow: 1500, poison: 1500, force: 900 };

export function registerVfx() {
  Hooks.once("ready", () =>
    game.socket.on(SOCKET, payload => {
      if (payload?.type === "playVfx") playLocal(payload.effect);
    })
  );
}

// Plays here and on every other connected client viewing the same scene.
export function broadcastEffect(effect) {
  if (!effect || effect.effect === "none") return;
  const data = { ...effect, sceneId: canvas.scene?.id };
  game.socket.emit(SOCKET, { type: "playVfx", effect: data });
  playLocal(data);
}

function playLocal(effect) {
  try {
    if (!canvas?.ready || !effect || effect.sceneId !== canvas.scene?.id || effect.effect === "none") return;
    play(effect);
  } catch (error) {
    console.warn("Worlds Beyond | map effect failed", error);
  }
}

/* -------------------------------------------- */
/*  Shapes                                      */
/* -------------------------------------------- */

// Fill and outline an area shape (circle, cone or line).
export function drawArea(graphics, shape, style) {
  if (!shape) return;
  if (shape.type === "circle") return circle(graphics, shape.x, shape.y, shape.radius, style);
  if (shape.type === "cone") return wedge(graphics, shape.x, shape.y, shape.radius, shape.direction - shape.angle / 2, shape.angle, style);
  if (shape.type === "line") {
    const cos = Math.cos(shape.direction),
      sin = Math.sin(shape.direction),
      half = shape.width / 2;
    const corners = [
      [0, -half],
      [shape.length, -half],
      [shape.length, half],
      [0, half]
    ].flatMap(([a, b]) => [shape.x + a * cos - b * sin, shape.y + a * sin + b * cos]);
    polygon(graphics, corners, style);
  }
}

function shapeCenter(shape) {
  if (!shape) return null;
  if (shape.type === "circle") return { x: shape.x, y: shape.y };
  const reach = shape.type === "cone" ? shape.radius * 0.6 : shape.length / 2;
  return { x: shape.x + Math.cos(shape.direction) * reach, y: shape.y + Math.sin(shape.direction) * reach };
}

function shapeSize(shape) {
  if (!shape) return 60;
  return shape.type === "circle" ? shape.radius : shape.type === "cone" ? shape.radius : shape.length / 2;
}

function randomPoint(shape, fallback) {
  if (!shape) return { x: fallback.x + (Math.random() - 0.5) * 60, y: fallback.y + (Math.random() - 0.5) * 60 };
  const size = shape.type === "line" ? shape.length : shape.radius;
  for (let attempt = 0; attempt < 30; attempt++) {
    const point = { x: shape.x + (Math.random() * 2 - 1) * size, y: shape.y + (Math.random() * 2 - 1) * size };
    if (pointInShape(shape, point)) return point;
  }
  return shapeCenter(shape);
}

/* -------------------------------------------- */
/*  Animation                                   */
/* -------------------------------------------- */

function layer() {
  return canvas.interface ?? canvas.stage;
}

function animate(duration, draw, { blend = "add" } = {}) {
  const graphics = new PIXI.Graphics();
  graphics.blendMode = blendMode(blend);
  layer().addChild(graphics);
  let elapsed = 0;
  const ticker = canvas.app.ticker;
  const tick = () => {
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / duration);
    if (graphics.destroyed) return ticker.remove(tick);
    graphics.clear();
    draw(graphics, t, elapsed);
    if (t >= 1) {
      ticker.remove(tick);
      graphics.destroy();
    }
  };
  ticker.add(tick);
}

const fadeOut = t => (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
const lighten = (color, amount) => {
  const r = (color >> 16) & 255,
    g = (color >> 8) & 255,
    b = color & 255;
  const mix = c => Math.round(c + (255 - c) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
};

// Points of a jagged bolt between two points, regenerated as it flickers.
function boltPath(from, to, roughness = 0.18, depth = 5) {
  let points = [from, to];
  let offset = Math.hypot(to.x - from.x, to.y - from.y) * roughness;
  for (let level = 0; level < depth; level++) {
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      const nx = -(b.y - a.y),
        ny = b.x - a.x,
        length = Math.hypot(nx, ny) || 1;
      const shift = (Math.random() * 2 - 1) * offset;
      next.push({ x: (a.x + b.x) / 2 + (nx / length) * shift, y: (a.y + b.y) / 2 + (ny / length) * shift }, b);
    }
    points = next;
    offset /= 2;
  }
  return points;
}

function strokePath(graphics, points, width, color, alpha) {
  polyline(graphics, points, { width, color, alpha });
}

function areaGlow(graphics, shape, color, alpha) {
  if (!shape) return;
  drawArea(graphics, shape, { fill: { color, alpha: alpha * 0.28 }, stroke: { width: 3, color: lighten(color, 0.3), alpha: alpha * 0.8 } });
}

// Short streak from the caster to each single target before the impact.
function travel(graphics, from, to, t, color, width = 6) {
  if (!from || !to || t > 0.3) return;
  const progress = Math.min(1, t / 0.25);
  const head = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  const tail = { x: from.x + (to.x - from.x) * Math.max(0, progress - 0.25), y: from.y + (to.y - from.y) * Math.max(0, progress - 0.25) };
  strokePath(graphics, [tail, head], width * 2, color, 0.35);
  strokePath(graphics, [tail, head], width, lighten(color, 0.6), 0.9);
}

function particles(count, spawn) {
  return Array.from({ length: count }, (_, i) => spawn(i));
}

export function play({ effect, color = 0xffffff, shape = null, origin = null, targets = [] }) {
  const duration = DURATION[effect] ?? 1000;
  const centers = targets.length ? targets : [shapeCenter(shape) ?? origin].filter(Boolean);
  const focus = shapeCenter(shape) ?? centers[0] ?? origin;
  if (!focus) return;
  const single = !shape;
  const size = single ? 50 : shapeSize(shape);
  const impactAt = single ? 0.25 : 0;
  const local = t => Math.max(0, (t - impactAt) / (1 - impactAt));
  const pick = () => (single ? centers[Math.floor(Math.random() * centers.length)] : randomPoint(shape, focus));

  if (effect === "lightning") {
    let bolts = [],
      last = -1;
    animate(duration, (g, t, elapsed) => {
      areaGlow(g, shape, color, fadeOut(t) * (Math.random() * 0.5 + 0.5));
      if (Math.floor(elapsed / 70) !== last) {
        last = Math.floor(elapsed / 70);
        bolts = single
          ? centers.map(target => boltPath(origin ?? target, target))
          : particles(Math.min(8, 3 + Math.floor(size / 60)), () =>
              boltPath(shape.type === "circle" ? pick() : { x: shape.x, y: shape.y }, pick(), 0.25, 4)
            );
      }
      const alpha = fadeOut(t) * (Math.random() > 0.2 ? 1 : 0.3);
      for (const bolt of bolts) {
        strokePath(g, bolt, 10, color, alpha * 0.35);
        strokePath(g, bolt, 3, lighten(color, 0.8), alpha);
      }
    });
    return;
  }

  if (effect === "fire") {
    const embers = particles(single ? 40 : 90, () => ({
      ...pick(),
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.05 - Math.random() * 0.08,
      r: 4 + Math.random() * 8,
      delay: Math.random() * 0.4
    }));
    animate(duration, (g, t, elapsed) => {
      travel(g, origin, centers[0], t, color, 8);
      const local_t = local(t);
      areaGlow(g, shape, color, fadeOut(local_t) * (0.75 + Math.random() * 0.25));
      for (const e of embers) {
        const life = Math.max(0, (local_t - e.delay) / (1 - e.delay));
        if (life <= 0 || life >= 1) continue;
        const ms = life * duration;
        circle(g, e.x + e.vx * ms, e.y + e.vy * ms, e.r * (1 - life * 0.7), {
          fill: { color: life < 0.4 ? lighten(color, 0.6) : color, alpha: (1 - life) * 0.9 }
        });
      }
    });
    return;
  }

  if (effect === "ice") {
    const shards = particles(single ? 24 : 60, () => {
      const at = pick(),
        angle = Math.random() * Math.PI * 2;
      return { ...at, angle, speed: 0.04 + Math.random() * 0.06, length: 8 + Math.random() * 14, delay: Math.random() * 0.25 };
    });
    animate(duration, (g, t) => {
      travel(g, origin, centers[0], t, color, 5);
      const local_t = local(t);
      areaGlow(g, shape, color, fadeOut(local_t));
      for (const s of shards) {
        const life = Math.max(0, (local_t - s.delay) / (1 - s.delay));
        if (life <= 0 || life >= 1) continue;
        const distance = s.speed * life * duration;
        const x = s.x + Math.cos(s.angle) * distance,
          y = s.y + Math.sin(s.angle) * distance;
        const tip = { x: x + Math.cos(s.angle) * s.length, y: y + Math.sin(s.angle) * s.length };
        const side = { x: Math.cos(s.angle + Math.PI / 2) * 3, y: Math.sin(s.angle + Math.PI / 2) * 3 };
        polygon(g, [x + side.x, y + side.y, tip.x, tip.y, x - side.x, y - side.y], {
          fill: { color: lighten(color, 0.5), alpha: (1 - life) * 0.95 }
        });
      }
    });
    return;
  }

  if (effect === "arcane" || effect === "holy" || effect === "force") {
    const motes = particles(single ? 20 : 50, () => ({ ...pick(), angle: Math.random() * Math.PI * 2, delay: Math.random() * 0.4 }));
    animate(duration, (g, t) => {
      travel(g, origin, centers[0], t, color, 6);
      const local_t = local(t);
      const alpha = fadeOut(local_t);
      areaGlow(g, shape, color, alpha * (effect === "force" ? 0.6 : 1));
      for (const center of single ? centers : [focus]) {
        const reach = single ? size : size;
        const rings = effect === "force" ? 1 : 3;
        for (let i = 0; i < rings; i++) {
          const phase = (local_t * (effect === "force" ? 1.2 : 1.5) + i / rings) % 1;
          circle(g, center.x, center.y, Math.max(1, reach * phase), {
            stroke: { width: effect === "force" ? 8 * (1 - phase) + 2 : 3, color: lighten(color, 0.4), alpha: alpha * (1 - phase) }
          });
        }
        if (effect === "holy") {
          for (let ray = 0; ray < 10; ray++) {
            const angle = (ray / 10) * Math.PI * 2 + local_t;
            strokePath(
              g,
              [center, { x: center.x + Math.cos(angle) * reach, y: center.y + Math.sin(angle) * reach }],
              6,
              lighten(color, 0.5),
              alpha * 0.4
            );
          }
          circle(g, center.x, center.y, reach * 0.35, { fill: { color: lighten(color, 0.7), alpha: alpha * 0.5 } });
        }
      }
      if (effect === "arcane")
        for (const m of motes) {
          const life = Math.max(0, (local_t - m.delay) / (1 - m.delay));
          if (life <= 0 || life >= 1) continue;
          const swirl = m.angle + life * 4;
          circle(g, m.x + Math.cos(swirl) * 12 * life, m.y + Math.sin(swirl) * 12 * life - life * 20, 3, {
            fill: { color: lighten(color, 0.6), alpha: (1 - life) * 0.9 }
          });
        }
    });
    return;
  }

  if (effect === "shadow" || effect === "poison") {
    const puffs = particles(single ? 18 : 45, () => ({
      ...pick(),
      delay: Math.random() * 0.4,
      r: 10 + Math.random() * 18,
      drift: (Math.random() - 0.5) * 0.03
    }));
    animate(
      duration,
      (g, t) => {
        travel(g, origin, centers[0], t, color, 6);
        const local_t = local(t);
        areaGlow(g, shape, color, fadeOut(local_t) * 0.8);
        for (const p of puffs) {
          const life = Math.max(0, (local_t - p.delay) / (1 - p.delay));
          if (life <= 0 || life >= 1) continue;
          const ms = life * duration;
          const rise = effect === "poison" ? -0.03 * ms : -0.01 * ms;
          circle(g, p.x + p.drift * ms, p.y + rise, effect === "poison" ? p.r * 0.4 * (0.6 + life) : p.r * (0.6 + life), {
            fill: { color: effect === "poison" ? lighten(color, 0.2) : color, alpha: (1 - life) * (effect === "shadow" ? 0.55 : 0.7) }
          });
        }
      },
      { blend: effect === "shadow" ? "normal" : "add" }
    );
  }
}
