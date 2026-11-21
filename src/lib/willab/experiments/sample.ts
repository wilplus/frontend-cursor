import { cellFor, gateOf } from "./grid";
import type { AnalyzeTakeResponse, Intervention, MomentAnalysis, PromptFile } from "./types";

/* Placeholder grids in the analyze-take shape. The first step in the
   file's order is the one that is not clear enough (confidence 0.2). */

export function sampleAnalysis(takeId: string, file: PromptFile): AnalyzeTakeResponse {
  const confidence: Record<string, number> = {};
  const summary: AnalyzeTakeResponse["summary"] = { gate: null };
  file.order.forEach((axis, index) => {
    const first = index === 0;
    confidence[axis] = first ? 0.2 : 0.8;
    summary[axis] = { score: first ? 0.2 : 0.6, confidence: confidence[axis] };
  });
  summary.gate = gateOf(file.order, confidence);
  return {
    take_id: takeId,
    model: "placeholder-v1",
    moments: [moment(file, 0, 8, 0.8), moment(file, 8, 16, 0.35)],
    summary,
  };
}

function moment(file: PromptFile, start: number, end: number, vocalLead: number): MomentAnalysis {
  const grid: MomentAnalysis["grid"] = {};
  file.order.forEach((axis, index) => {
    const lead = index === 0 ? vocalLead : index === 1 ? vocalLead - 0.2 : -0.3;
    grid[axis] = {
      vocal: cellFor(axis, "vocal", lead, file),
      verbal: cellFor(axis, "verbal", index === 0 ? 0.25 : -0.2, file),
    };
  });
  return { start, end, grid };
}

/** Starter rules the host can change. Not part of the prompt file. */
export function seedInterventions(file: PromptFile): Intervention[] {
  const first = file.order[0] ?? "engagement";
  const second = file.order[1] ?? first;
  const last = file.order[file.order.length - 1] ?? first;
  return [
    item("slow-open", "Slow the first line", { [first]: { verbal: 0.3, vocal: 0.9 }, [second]: { vocal: 0.8 } }, first),
    item("short-pause", "Leave a short pause", { [first]: { vocal: 0.7 } }, first),
    item("point-page", "Point at the page", { [last]: { verbal: -0.9 } }, last),
  ];
}

function item(id: string, name: string, grid: Intervention["grid"], step: string): Intervention {
  return { id, name, grid, threshold: 1, rule: { step } };
}
