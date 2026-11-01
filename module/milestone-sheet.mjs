import { STATS, MILESTONE_SCORES } from "./stats.mjs";
import { milestoneGroups } from "./milestones.mjs";

const windows = new WeakMap();
export class MilestoneSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "div", canImport: false, sheetConfig: false, ownershipConfig: false,
    classes: ["worlds-beyond", "wb-sheet", "wb-milestone-sheet"], position: { width: 560, height: 600 },
    window: { resizable: true }, form: { submitOnChange: false },
    actions: { closeReference: function () { return this.close(); } }
  };
  static PARTS = { body: { template: "systems/worlds-beyond/templates/milestone-sheet.hbs", scrollable: [""] } };
  statKey = "";
  threshold = null;
  focusRequested = false;
  get title() { return `${this.document.name}: Milestones`; }

  async _prepareContext(options) {
    const groups = milestoneGroups(this.document.system);
    return Object.assign(await super._prepareContext(options), {
      unlocked: groups.flatMap(group => group.rows).filter(row => row.unlocked).length, total: 16,
      choices: [{ value: "", label: "All stats", selected: !this.statKey }, ...STATS.map(stat => ({ value: stat.key, label: stat.label, selected: stat.key === this.statKey }))],
      groups: groups.filter(group => !this.statKey || group.key === this.statKey).map(group => ({ ...group,
        rows: group.rows.map(row => ({ ...row, focused: group.key === this.statKey && row.threshold === this.threshold })) }))
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.focusRequested) {
      const entry = this.element.querySelector(`[data-milestone-id="${this.statKey}-${this.threshold}"]`);
      if (entry) { entry.open = true; entry.scrollIntoView({ block: "nearest" }); }
      this.focusRequested = false;
    }
    this.element.querySelector("[data-milestone-filter]")?.addEventListener("change", event => {
      this.statKey = STATS.some(stat => stat.key === event.target.value) ? event.target.value : "";
      this.threshold = null;
      this.render({ force: true });
    });
  }

  // This native document sheet registers for actor refreshes and permissions,
  // but is a reference only: Enter or a form event must never update the actor.
  async _processSubmitData() { return {}; }
}

export function openMilestones(actor, key = "", threshold = null) {
  let sheet = windows.get(actor);
  if (!sheet) { sheet = new MilestoneSheet({ document: actor }); windows.set(actor, sheet); }
  sheet.statKey = STATS.some(stat => stat.key === key) ? key : "";
  sheet.threshold = MILESTONE_SCORES.includes(Number(threshold)) ? Number(threshold) : null;
  sheet.focusRequested = !!sheet.statKey && sheet.threshold !== null;
  return sheet.render({ force: true });
}
