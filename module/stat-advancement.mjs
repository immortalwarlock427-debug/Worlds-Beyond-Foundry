import { STATS } from "./stats.mjs";

export const STAT_ROLL_FORMULA = "2d6 + 1d12";
export const STAT_AWARD_LEVELS = [4, 8, 12, 16, 19];
export const STAT_AWARD_POINTS = 4;
const keys = STATS.map(stat => stat.key);

export function statAwards(level, advancement = {}) {
  return STAT_AWARD_LEVELS.filter(at => at <= Number(level)).map(at => {
    const allocation = Object.fromEntries(keys.map(key => [key, Number(advancement[`level${at}`]?.[key] ?? 0)]));
    const spent = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    return { level: at, key: `level${at}`, allocation, spent, remaining: STAT_AWARD_POINTS - spent };
  });
}

export function statIncreases(level, advancement) {
  const totals = Object.fromEntries(keys.map(key => [key, 0]));
  for (const award of statAwards(level, advancement)) for (const key of keys) totals[key] += award.allocation[key];
  return totals;
}

export function validateStatAwards(level, advancement, stats = {}, previous = {}) {
  for (const at of STAT_AWARD_LEVELS) {
    const values = keys.map(key => Number(advancement[`level${at}`]?.[key] ?? 0));
    if (values.some(value => !Number.isInteger(value) || value < 0 || value > 2)) throw new Error("Spend at most 2 points in one stat for each award.");
    if (values.reduce((sum, value) => sum + value, 0) > STAT_AWARD_POINTS) throw new Error(`Level ${at} provides 4 stat points.`);
    if (at > Number(level) && keys.some(key => (advancement[`level${at}`]?.[key] ?? 0) !== (previous[`level${at}`]?.[key] ?? 0))) {
      throw new Error(`Reach level ${at} before spending its stat points.`);
    }
  }
  const before = statIncreases(level, previous), after = statIncreases(level, advancement);
  for (const key of keys) {
    if (after[key] > before[key] && Number(stats[key]?.value ?? 12) + after[key] > 28) {
      throw new Error(`${STATS.find(stat => stat.key === key).label} can reach 28 from stat points. Gear and manual corrections remain separate.`);
    }
  }
}

// Assignments refer to result slots, so equal totals remain independent rolls.
export function assignStatResult(rows, index, stat) {
  if (!Number.isInteger(index) || !rows[index] || !keys.includes(stat)) throw new Error("Choose a result and a stat.");
  const next = rows.map(row => ({ ...row }));
  const other = next.findIndex((row, i) => i !== index && row.stat === stat);
  if (other >= 0) next[other].stat = next[index].stat;
  next[index].stat = stat;
  return next;
}

export function assignedStatUpdates(rows) {
  if (rows.length !== keys.length || new Set(rows.map(row => row.stat)).size !== keys.length || rows.some(row => !keys.includes(row.stat))) {
    throw new Error("Assign each result to a different stat.");
  }
  const updates = {};
  for (const { stat, score } of rows) {
    if (score === null || score === "") continue;
    if (!Number.isInteger(score) || score < 0) throw new Error("Enter a whole-number score of 0 or higher, or leave the result blank.");
    updates[`system.stats.${stat}.value`] = score;
    updates[`system.stats.${stat}.manual`] = false;
    updates[`system.stats.${stat}.resetValue`] = null;
  }
  if (!Object.keys(updates).length) throw new Error("Roll or enter at least one score first.");
  return updates;
}
