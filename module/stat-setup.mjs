import { STATS } from "./stats.mjs";
import { STAT_ROLL_FORMULA, STAT_AWARD_LEVELS, statAwards, statIncreases, validateStatAwards, assignStatResult, assignedStatUpdates } from "./stat-advancement.mjs";
import { fitDialogDisclosures } from "./dialog-layout.mjs";

const SYSTEM_ID = "worlds-beyond";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const operations = new Map();
const sourceState = actor => {
  const source = actor.system.toObject();
  return { level: source.level ?? actor.system.level, stats: source.stats, advancement: source.advancement ?? {} };
};
const signature = actor => JSON.stringify(sourceState(actor));

// A draft cannot silently replace scores/allocations changed in another window.
// Unrelated resource spending does not invalidate it. Recheck ownership at save.
export async function saveStatSetup(actor, baseline, updates) {
  const previous = operations.get(actor.uuid) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    if (!actor.isOwner) throw new Error("You need permission to edit this character.");
    if (signature(actor) !== baseline) throw new Error("This character's stats or level changed. Reopen this window to use the latest values.");
    return actor.update(updates);
  });
  operations.set(actor.uuid, current);
  try { return await current; }
  finally { if (operations.get(actor.uuid) === current) operations.delete(actor.uuid); }
}

export class StatSetup extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "wb-sheet", "wb-stat-setup"],
    position: { width: 500, height: "auto" }, window: { resizable: true },
    actions: { setup: StatSetup.#onAction }
  };
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/stat-setup.hbs` } };

  constructor(actor, mode = "generation") {
    super({ window: { title: mode === "generation" ? "Roll & assign stats" : "Stat point increases" } });
    this.actor = actor;
    this.mode = mode;
    this.source = sourceState(actor);
    this.baseline = signature(actor);
    this.rows = STATS.map(stat => ({ stat: stat.key, score: null, dice: "" }));
    this.advancement = structuredClone(this.source.advancement);
    this.selectedLevel = statAwards(this.source.level, this.advancement).find(award => award.remaining > 0)?.level
      ?? statAwards(this.source.level, this.advancement).at(-1)?.level;
    this.busy = false;
    this.discarded = false;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const increases = statIncreases(this.source.level, this.advancement);
    const awards = statAwards(this.source.level, this.advancement);
    const award = awards.find(row => row.level === this.selectedLevel);
    const filled = this.rows.filter(row => row.score !== null).length;
    return Object.assign(context, {
      generation: this.mode === "generation", editable: this.actor.isOwner && !this.busy, busy: this.busy,
      filled, full: filled === 8, canApply: filled > 0 && !this.busy && this.actor.isOwner,
      awards: awards.map(row => ({ ...row, selected: row.level === this.selectedLevel })), award,
      nextAward: STAT_AWARD_LEVELS.find(at => at > this.source.level),
      rows: this.rows.map((row, index) => ({ ...row, index, number: index + 1,
        hasScore: row.score !== null,
        choices: STATS.map(stat => ({ value: stat.key, label: stat.abbr, selected: stat.key === row.stat })),
        increase: increases[row.stat], preview: row.score === null ? null : row.score + increases[row.stat]
      })),
      stats: STATS.map(stat => {
        const points = award?.allocation[stat.key] ?? 0;
        const base = Number(this.source.stats[stat.key]?.value ?? 12), total = base + increases[stat.key];
        return { ...stat, points, base, total,
          canAdd: !!award && award.remaining > 0 && points < 2 && total < 28,
          canRemove: points > 0 };
      })
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    fitDialogDisclosures(this);
    for (const input of this.element.querySelectorAll("[data-result-score]")) {
      input.addEventListener("input", () => {
        if (!this.actor.isOwner || this.busy) return;
        const row = this.rows[Number(input.dataset.resultScore)];
        row.score = input.value.trim() === "" ? null : Number(input.value);
        row.dice = "";
        // Keep the focused input and Apply button in place while typing.
        const increase = statIncreases(this.source.level, this.advancement)[row.stat];
        const detail = this.element.querySelector(`[data-result-details="${input.dataset.resultScore}"]`);
        detail.textContent = row.score === null ? "Not rolled" : `Typed score${increase ? ` · with stat points: ${row.score + increase} (+${increase})` : ""}`;
        const filled = this.rows.filter(row => row.score !== null).length;
        const apply = this.element.querySelector('[data-operation="apply"]');
        apply.textContent = `Apply ${filled} scores`;
        apply.disabled = !filled;
        this.element.querySelector('[data-operation="roll-one"]').disabled = filled === 8;
        this.element.querySelector('[data-operation="roll-all"]').textContent = filled === 8 ? "Reroll eight" : filled ? "Roll remaining" : "Roll eight";
      });
    }
    for (const select of this.element.querySelectorAll("[data-result-stat]")) {
      select.addEventListener("change", () => {
        if (!this.actor.isOwner || this.busy) return;
        this.rows = assignStatResult(this.rows, Number(select.dataset.resultStat), select.value);
        this.render({ force: true });
      });
    }
  }

  static async #onAction(event, target) {
    if (this.busy) return;
    const operation = target.dataset.operation;
    if (operation === "cancel") return this.close();
    if (!this.actor.isOwner) return;
    try {
      if (operation === "roll-one" || operation === "roll-all") return await this.rollScores(operation === "roll-one");
      if (operation === "clear") this.rows = this.rows.map(row => ({ ...row, score: null, dice: "" }));
      if (operation === "level") this.selectedLevel = Number(target.dataset.level);
      if (operation === "reset") this.advancement[`level${this.selectedLevel}`] = Object.fromEntries(STATS.map(stat => [stat.key, 0]));
      if (operation === "add" || operation === "remove") {
        const next = structuredClone(this.advancement), key = `level${this.selectedLevel}`, stat = target.dataset.stat;
        if (!STATS.some(row => row.key === stat) || !statAwards(this.source.level).some(row => row.level === this.selectedLevel)) return;
        next[key] ??= {};
        next[key][stat] = (next[key][stat] ?? 0) + (operation === "add" ? 1 : -1);
        validateStatAwards(this.source.level, next, this.source.stats, this.advancement);
        this.advancement = next;
      }
      if (operation === "apply") return await this.apply();
      await this.render({ force: true });
      const focus = this.element.querySelector(`[data-operation="${operation}"][data-stat="${target.dataset.stat}"]:not(:disabled)`)
        ?? this.element.querySelector(`[data-stat="${target.dataset.stat}"]:not(:disabled)`);
      focus?.focus();
    } catch (error) { ui.notifications.error(error.message); }
  }

  async rollScores(one = false) {
    if (this.busy || this.discarded || !this.actor.isOwner) return;
    const indices = this.rows.flatMap((row, index) => row.score === null ? [index] : []);
    const selected = one ? indices.slice(0, 1) : indices.length ? indices : this.rows.map((row, index) => index);
    if (!selected.length) return;
    this.busy = true;
    await this.render({ force: true });
    try {
      const results = [];
      for (const index of selected) {
        const roll = await new foundry.dice.Roll(STAT_ROLL_FORMULA).evaluate({ allowInteractive: false });
        const dice = roll.dice.flatMap(die => die.results.filter(result => result.active !== false).map(result => result.result));
        results.push({ index, score: roll.total, dice: dice.join(" + ") });
      }
      for (const result of results) Object.assign(this.rows[result.index], { score: result.score, dice: result.dice });
    } finally { this.busy = false; if (!this.discarded) await this.render({ force: true }); }
  }

  async apply() {
    if (this.busy || this.discarded || !this.actor.isOwner) return;
    let updates;
    if (this.mode === "generation") updates = assignedStatUpdates(this.rows);
    else {
      validateStatAwards(this.source.level, this.advancement, this.source.stats, this.source.advancement);
      updates = {};
      for (const award of statAwards(this.source.level, this.advancement)) for (const stat of STATS) {
        updates[`system.advancement.${award.key}.${stat.key}`] = award.allocation[stat.key];
      }
      if (!Object.keys(updates).length) return this.close();
    }
    this.busy = true;
    await this.render({ force: true });
    try { await saveStatSetup(this.actor, this.baseline, updates); await this.close(); }
    finally { this.busy = false; if (this.rendered) await this.render({ force: true }); }
  }

  async close(options) {
    this.discarded = true;
    return super.close(options);
  }
}

export function openStatSetup(actor, mode) {
  if (!actor.isOwner) return;
  return new StatSetup(actor, mode).render({ force: true });
}
