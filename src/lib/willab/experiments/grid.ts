import type { CellReference, Channel, GridCell, PromptFile } from "./types";

/** The cell's key in the prompt file: the step itself, or the voice or
    word part when the file splits that step. */
export function scoredKey(axis: string, row: Channel, file: PromptFile): string {
  const voice = `${axis}_voice`;
  const words = `${axis}_words`;
  const listed = new Set([...file.baseline_scored, ...file.reference_scored]);
  if (listed.has(voice) || listed.has(words)) return row === "vocal" ? voice : words;
  return axis;
}

/** Which list in the prompt file holds this key. The wire name is
    `baseline` or `reference`. */
export function comparisonFor(key: string, file: PromptFile): CellReference {
  if (file.baseline_scored.includes(key)) return "baseline";
  if (file.reference_scored.includes(key)) return "reference";
  throw new Error(`The prompt file does not score ${key}.`);
}

export function clampCue(value: number): number {
  return Math.max(-1, Math.min(1, Math.round(value * 1000) / 1000));
}

export function cellFor(axis: string, row: Channel, value: number, file: PromptFile): GridCell {
  return { value: clampCue(value), reference: comparisonFor(scoredKey(axis, row, file), file) };
}

/** The first step whose confidence is below the placeholder floor. */
export const CONFIDENCE_FLOOR = 0.55;

export function gateOf(order: readonly string[], confidence: Record<string, number>): string | null {
  return order.find((axis) => (confidence[axis] ?? 0) < CONFIDENCE_FLOOR) ?? null;
}

export function stepSummary(summary: { gate: string | null } & Record<string, unknown>, axis: string): { score: number; confidence: number } | null {
  const row = summary[axis];
  if (!row || typeof row !== "object") return null;
  const score = (row as { score?: unknown }).score;
  const confidence = (row as { confidence?: unknown }).confidence;
  return typeof score === "number" && typeof confidence === "number" ? { score, confidence } : null;
}
