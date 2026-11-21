import type { Channel, Intervention, InterventionHit, InterventionPick, MomentAnalysis, PatternGrid } from "./types";

/* Overlap of a moment grid with an intervention grid.
   A cell matches when the signs agree. Zero matches only zero.
   Intensity is how close the two values are, from 0 to 1.
   The cell score is match + intensity, so 0 to 2.
   The overlap is the average of those cell scores.
   A hit fires when overlap >= that intervention's threshold.
   At most two are shown. The earlier step in the file's order wins. */

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function patternCells(grid: PatternGrid): { axis: string; row: Channel; value: number }[] {
  const cells: { axis: string; row: Channel; value: number }[] = [];
  for (const [axis, sides] of Object.entries(grid)) {
    for (const row of ["verbal", "vocal"] as const) {
      const value = sides?.[row];
      if (typeof value === "number") cells.push({ axis, row, value });
    }
  }
  return cells;
}

export function scorePattern(moment: MomentAnalysis, grid: PatternGrid): number {
  const cells = patternCells(grid);
  if (cells.length === 0) return 0;
  let total = 0;
  for (const cell of cells) {
    const momentValue = moment.grid[cell.axis]?.[cell.row]?.value ?? 0;
    if (sign(momentValue) !== sign(cell.value)) continue;
    const intensity = 1 - Math.min(1, Math.abs(momentValue - cell.value));
    total += 1 + intensity;
  }
  return total / cells.length;
}

function stepOf(item: Intervention, order: readonly string[]): string {
  if (item.rule.step && order.includes(item.rule.step)) return item.rule.step;
  return order.find((axis) => item.grid[axis] !== undefined) ?? order[0] ?? "";
}

/** Fired interventions, earliest step first, at most two. */
export function pickInterventions(moment: MomentAnalysis, items: readonly Intervention[], order: readonly string[], takeId: string): InterventionPick {
  const hits = items
    .map((item) => hitFor(item, moment, order))
    .filter((hit) => hit.overlap >= hit.threshold)
    .sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step) || b.overlap - a.overlap);
  const shown: InterventionHit[] = [];
  for (const axis of order) {
    for (const hit of hits) {
      if (hit.step !== axis || shown.length >= 2) continue;
      shown.push(hit);
    }
    if (shown.length >= 2) break;
  }
  return { take_id: takeId, order: [...order], moment, hits, shown, chosen_id: null };
}

function hitFor(item: Intervention, moment: MomentAnalysis, order: readonly string[]): InterventionHit {
  return {
    id: item.id,
    name: item.name,
    step: stepOf(item, order),
    overlap: scorePattern(moment, item.grid),
    threshold: item.threshold,
    rule: item.rule,
    grid: item.grid,
  };
}
