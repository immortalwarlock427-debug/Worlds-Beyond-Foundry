// Small drawing adapter: Foundry v14 ships PixiJS v8 (fill()/stroke()), older builds PixiJS v7
// (beginFill/lineStyle). Every shape here takes {fill: {color, alpha}, stroke: {width, color, alpha}}.

const isV8 = () => typeof PIXI?.Graphics?.prototype?.circle === "function" && typeof PIXI.Graphics.prototype.stroke === "function";

export function blendMode(name = "add") {
  if (isV8()) return name;
  return PIXI.BLEND_MODES?.[name.toUpperCase()] ?? PIXI.BLEND_MODES?.NORMAL ?? 0;
}

function paint(g, style, build) {
  if (isV8()) {
    build(g);
    if (style.fill) g.fill({ color: style.fill.color, alpha: style.fill.alpha ?? 1 });
    if (style.stroke) g.stroke({ cap: "round", join: "round", ...style.stroke });
    return;
  }
  g.lineStyle(style.stroke ? { cap: "round", join: "round", ...style.stroke } : 0);
  if (style.fill) g.beginFill(style.fill.color, style.fill.alpha ?? 1);
  build(g, true);
  if (style.fill) g.endFill();
  g.lineStyle(0);
}

export function circle(g, x, y, radius, style) {
  paint(g, style, (graphics, legacy) => (legacy ? graphics.drawCircle(x, y, radius) : graphics.circle(x, y, radius)));
}

export function polygon(g, points, style) {
  paint(g, style, (graphics, legacy) => (legacy ? graphics.drawPolygon(points) : graphics.poly(points)));
}

export function rect(g, x, y, width, height, style) {
  paint(g, style, (graphics, legacy) => (legacy ? graphics.drawRect(x, y, width, height) : graphics.rect(x, y, width, height)));
}

export function polyline(g, points, stroke) {
  if (points.length < 2) return;
  paint(g, { stroke }, graphics => {
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  });
}

// A wedge from (x, y): used for cones.
export function wedge(g, x, y, radius, start, sweep, style) {
  paint(g, style, graphics => {
    graphics.moveTo(x, y);
    graphics.arc(x, y, radius, start, start + sweep);
    graphics.lineTo(x, y);
    graphics.closePath();
  });
}
