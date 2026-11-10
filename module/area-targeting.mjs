// Using a targeted ability from the sheet or the map: aim a single target or place an area,
// confirm who it hits, then roll it. Shapes and hit-testing live in area-core.mjs.
import { areaSettings, areaLabel, buildShape, tokensInShape, visualSettings, isArea } from "./area-core.mjs";
import { drawArea } from "./vfx.mjs";
import { circle } from "./draw.mjs";
import { targetFromToken } from "./attack-actions.mjs";
import { abilityRecord } from "./abilities-core.mjs";
import { abilityActive } from "./ability-timers-core.mjs";
import { promptAbilityStrike, rollAbilityStrike, abilityStrikePlan } from "./ability-strikes.mjs";
import { wholeNumber } from "./number-display.mjs";
import { charmBlocksTarget, charmOverrideHTML } from "./charmed.mjs";

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function casterToken(actor) {
  if (actor.isToken && actor.token?.object) return actor.token.object;
  const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.uuid === actor.uuid);
  return controlled ?? actor.getActiveTokens?.(true)?.[0] ?? actor.getActiveTokens?.()?.[0] ?? null;
}

export function isTargetedAbility(item) {
  return item?.type === "ability" && ["attack", "save", "heal"].includes(item.system.targeting?.mode);
}

// Sheet Use button, favorites and the Alt-click chooser all start here.
export async function useTargetedAbility(actor, item, { aimToken = null } = {}) {
  if (!actor?.isOwner || !isTargetedAbility(item)) return;
  if (abilityActive(item)) throw new Error(`${item.name} is already active. End it on the sheet before using it again.`);
  const settings = areaSettings(item.system.targeting.area);
  if (!isArea(settings.shape)) {
    const token = aimToken ?? Array.from(game.user.targets ?? [])[0] ?? null;
    if (!token) throw new Error(`Target a token (or Alt-click it with your character selected) to use ${item.name} on it.`);
    if (!aimToken && game.user.targets.size > 1) throw new Error(`${item.name} hits a single target. Target only one token.`);
    return promptAbilityStrike(actor, item.id, targetFromToken(token));
  }
  if (!canvas?.ready) throw new Error("Open the scene to place the area.");
  const caster = casterToken(actor);
  if (!caster) throw new Error(`Put ${actor.name}'s token on this scene to aim ${item.name}.`);
  const visual = visualSettings(item.system.targeting.visual);
  const placed = await placeArea({
    settings,
    origin: caster.center,
    aim: aimToken?.center ?? null,
    color: visual.color,
    casterId: caster.id
  });
  if (!placed) return;
  const chosen = await confirmAreaTargets(actor, item, placed.tokens, settings);
  if (!chosen) return;
  const targets = chosen.tokens.map(token => targetFromToken(token)).filter(Boolean);
  return rollAbilityStrike(actor, item, targets, {
    area: settings.shape,
    ignoreCharm: chosen.ignoreCharm,
    visual: { ...visual, shape: placed.shape, origin: caster.center, targets: chosen.tokens.map(token => token.center) }
  });
}

function candidateTokens() {
  return (canvas.tokens?.placeables ?? []).filter(token => token.actor && token.visible && (!token.document.hidden || game.user.isGM));
}

// Interactive placement: the shape follows the mouse, click to confirm, right-click or Esc to cancel.
// Foundry claims mouse-down on the map before PixiJS delivers it to canvas objects (found live on
// 14.365), so this listens on the window in the capture phase and only for the map's own element.
export function placeArea({ settings, origin, aim = null, color = 0xd6a85c, casterId = null }) {
  return new Promise(resolve => {
    const pixelsPerFoot = canvas.dimensions.size / canvas.dimensions.distance;
    const board = canvas.app.view;
    const preview = new PIXI.Graphics();
    preview.eventMode = "none";
    canvas.stage.addChild(preview);
    const tokens = candidateTokens();
    const boxes = tokens.map(token => ({ id: token.id, x: token.document.x, y: token.document.y, width: token.w, height: token.h }));
    let point = aim ?? { x: origin.x + canvas.dimensions.size * 2, y: origin.y };
    let shape = null,
      inside = [],
      done = false;
    const previousCursor = board.style.cursor;
    board.style.cursor = "crosshair";

    const snap = position => {
      if (settings.shape !== "circle") return position;
      try {
        const modes = CONST.GRID_SNAPPING_MODES;
        return canvas.grid.getSnappedPoint(position, { mode: modes.CENTER | modes.VERTEX });
      } catch {
        return position;
      }
    };
    const toCanvas = event => snap(canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY }));
    const onBoard = event => event.target === board;
    const redraw = () => {
      shape = buildShape(settings, { origin, point, pixelsPerFoot });
      const hit = new Set(tokensInShape(shape, boxes, { excludeId: settings.includeSelf ? null : casterId }).map(box => box.id));
      inside = tokens.filter(token => hit.has(token.id));
      preview.clear();
      drawArea(preview, shape, { fill: { color, alpha: 0.22 }, stroke: { width: 3, color, alpha: 0.9 } });
      for (const token of inside) {
        circle(preview, token.center.x, token.center.y, Math.max(token.w, token.h) * 0.55, {
          stroke: { width: 4, color: 0xffffff, alpha: 0.85 }
        });
      }
    };
    const finish = result => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("contextmenu", menu, true);
      window.removeEventListener("keydown", key, true);
      Hooks.off("canvasTearDown", teardownHook);
      board.style.cursor = previousCursor;
      preview.destroy();
      resolve(result);
    };
    const move = event => {
      if (!onBoard(event)) return;
      point = toCanvas(event);
      redraw();
    };
    const down = event => {
      if (!onBoard(event)) return;
      // Keep the click away from Foundry so it doesn't select, deselect or drag anything.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.button === 2) return finish(null);
      if (event.button !== 0) return;
      point = toCanvas(event);
      redraw();
      finish({ shape, tokens: inside });
    };
    const menu = event => {
      if (onBoard(event)) event.preventDefault();
    };
    const key = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(null);
    };
    const teardown = () => finish(null);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("contextmenu", menu, true);
    window.addEventListener("keydown", key, true);
    const teardownHook = Hooks.once("canvasTearDown", teardown);
    redraw();
    ui.notifications.info(`Aim ${areaLabel(settings)}: click the map to place it, right-click or Esc to cancel.`);
  });
}

// Everyone except a protected charmer starts ticked; targets remain editable for rulings.
export async function confirmAreaTargets(actor, item, tokens, settings) {
  const plan = abilityStrikePlan(actor, item);
  const record = abilityRecord(item, actor.system);
  const defense =
    plan.check === "heal"
      ? "Each ticked target is healed by the same roll."
      : plan.check === "save"
        ? `Each target makes a save against DC ${wholeNumber(plan.dc)}.`
        : `Area attack: each target can Dodge against DC ${wholeNumber(plan.dc)} for half damage.`;
  const rows = tokens.length
    ? tokens
        .map(token => {
          const blocked = charmBlocksTarget(actor, targetFromToken(token), { harmful: plan.check !== "heal" });
          return `<label class="wb-check-toggle"><input type="checkbox" name="t_${token.id}"${blocked ? "" : " checked"}> ${escapeHTML(token.name)}${blocked ? " · Charmed: linked charmer" : ""}</label>`;
        })
        .join("")
    : "<p>No one is inside the area.</p>";
  const form = await foundry.applications.api.DialogV2.input({
    classes: ["worlds-beyond", "wb-roll-dialog"],
    position: { width: 380 },
    window: { title: `Use ${item.name}` },
    content: `<div class="wb-check-options"><p class="wb-dialog-meta">${escapeHTML(areaLabel(settings))} · ${escapeHTML(record.summary)}</p><p>${defense}</p><fieldset><legend>Targets</legend>${rows}</fieldset>${plan.check === "heal" ? "" : charmOverrideHTML(actor)}</div>`,
    ok: { label: "Use" },
    rejectClose: false
  });
  if (!form) return null;
  return { tokens: tokens.filter(token => form[`t_${token.id}`]), ignoreCharm: form.ignoreCharm === true };
}
