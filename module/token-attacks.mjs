import { promptAttack, targetFromToken } from "./attack-actions.mjs";
import { itemList, loadoutError } from "./loadout.mjs";
import { targetedAbilities } from "./ability-strikes.mjs";
const pending = new Set();

export function clickAttacker(target, event = {}) {
  if (game.activeTool !== "select" || !event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return null;
  if (
    !target.actor ||
    !target.isVisible ||
    !target.layer.active ||
    target.layer._draggedToken ||
    globalThis.canvas?.regions?._placementContext ||
    globalThis.canvas?.controls?.ruler?.active ||
    CONFIG.Canvas.rulerClass.canMeasure
  )
    return null;
  const controlled = canvas.tokens.controlled;
  if (controlled.length !== 1 || controlled[0] === target) return null;
  const actor = controlled[0].actor;
  return actor?.isOwner && actor.type === "character" ? actor : null;
}

export async function promptTokenAttack(actor, targetToken) {
  if (!actor?.isOwner || actor.type !== "character" || !targetToken?.isVisible) return;
  if (pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try {
    return await chooseTokenAttack(actor, targetToken);
  } finally {
    pending.delete(actor.uuid);
  }
}

async function chooseTokenAttack(actor, targetToken) {
  const target = targetFromToken(targetToken);
  if (!target) return;
  const weapons = itemList(actor.items).filter(item => item.type === "weapon" && item.system.equipped);
  const abilities = targetedAbilities(actor);
  if (!weapons.length && !abilities.length)
    throw new Error("Equip a weapon, or set an ability's Targeting in its editor, to attack from the map.");
  // With weapons as the only option, refuse a broken loadout before asking anything.
  const loadout = loadoutError(actor.items);
  if (loadout && !abilities.length) throw new Error(`${loadout} Re-equip your intended weapon on the sheet to correct the loadout.`);
  let choice = weapons.length ? `weapon:${weapons[0].id}` : `ability:${abilities[0].id}`;
  if (weapons.length + abilities.length > 1) {
    const form = await foundry.applications.api.DialogV2.input({
      classes: ["worlds-beyond", "wb-roll-dialog"],
      position: { width: 380 },
      rejectClose: false,
      window: { title: `Attack ${target.name}` },
      ok: { label: "Choose" },
      content: await foundry.applications.handlebars.renderTemplate("systems/worlds-beyond/templates/token-attack-dialog.hbs", {
        attacker: actor.name,
        target: target.name,
        weapons: weapons.map(item => ({ value: `weapon:${item.id}`, name: item.name })),
        abilities: abilities.map(item => ({ value: `ability:${item.id}`, name: item.name }))
      })
    });
    if (!form) return;
    choice = form.choice;
  }
  const [kind, id] = String(choice ?? "").split(":");
  if (kind === "ability") {
    const { useTargetedAbility } = await import("./area-targeting.mjs");
    return useTargetedAbility(actor, actor.items.get(id), { aimToken: targetToken });
  }
  const weapon = actor.items.get(id);
  if (weapon?.type !== "weapon" || !weapon.system.equipped) throw new Error("That weapon is no longer equipped.");
  if (loadout) throw new Error(`${loadout} Re-equip your intended weapon on the sheet to correct the loadout.`);
  return promptAttack(actor, weapon.id, target);
}

export function registerTokenAttacks() {
  const Base = CONFIG.Token.objectClass;
  CONFIG.Token.objectClass = class WorldsBeyondToken extends Base {
    _canControl(user, event) {
      if (super._canControl(user, event)) return true;
      // Grant only a pointer click for the attack menu, never control/drag/update
      // permission over another player's or an enemy's token.
      return event?.type === "pointerdown" && !!clickAttacker(this, event);
    }

    _onClickLeft(event) {
      const actor = clickAttacker(this, event);
      if (!actor) return super._onClickLeft(event);
      event.stopPropagation();
      this.setTarget(true, { releaseOthers: true });
      void promptTokenAttack(actor, this).catch(error => ui.notifications.error(error.message));
    }
  };
}
