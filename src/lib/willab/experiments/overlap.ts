import type { AnalyzeGate, AnalyzeMoment, AnalyzeStep, Intervention, InterventionHit, InterventionPick, PatternCell } from "./types";

/* Overlap of one moment's cue grid with an intervention pattern.
   A cell matches when the signs agree. A missing or null reading does not match.
   Zero matches only zero. Intensity is how close the two values are.
   The cell score is match + intensity (0 to 2). The overlap is the average.
   At most two hits are shown. The earlier step in order wins, and the gate
   step is that earliest unclear step. */

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function momentValue(moment: AnalyzeMoment, cell: PatternCell): number | null {
  const found = moment.grid.find((item) => item.step === cell.step && item.cue === cell.cue);
  return found?.value ?? null;
}

export function scorePattern(moment: AnalyzeMoment, grid: PatternCell[]): number {
  if (grid.length === 0) return 0;
  let total = 0;
  for (const cell of grid) {
    const value = momentValue(moment, cell);
    if (value === null || sign(value) !== sign(cell.value)) continue;
    const intensity = 1 - Math.min(1, Math.abs(value - cell.value));
    total += 1 + intensity;
  }
  return total / grid.length;
}

function stepOf(item: Intervention, order: readonly AnalyzeStep[]): AnalyzeStep {
  if (item.rule.step && order.includes(item.rule.step)) return item.rule.step;
  return item.grid[0]?.step ?? order[0] ?? "engagement";
}

export function pickInterventions(
  moment: AnalyzeMoment,
  items: readonly Intervention[],
  order: readonly AnalyzeStep[],
  takeId: string,
  gate: AnalyzeGate = null,
): InterventionPick {
  const hits = items
    .map((item) => hitFor(item, moment, order))
    .filter((hit) => hit.overlap >= hit.threshold)
    .sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step) || b.overlap - a.overlap);
  const shown: InterventionHit[] = [];
  const steps = gate ? [gate.step, ...order.filter((step) => step !== gate.step)] : [...order];
  for (const axis of steps) {
    for (const hit of hits) {
      if (hit.step !== axis || shown.length >= 2) continue;
      shown.push(hit);
    }
    if (shown.length >= 2) break;
  }
  return { take_id: takeId, order: [...order], moment, gate, hits, shown, chosen_id: null };
}

function hitFor(item: Intervention, moment: AnalyzeMoment, order: readonly AnalyzeStep[]): InterventionHit {
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
