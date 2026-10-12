/* -------------------------------------------------------------------------- */
/*  What the machine picked for a moment, and why (backend 2026-09-28,        */
/*  steps 6–7).                                                               */
/*                                                                            */
/*  COACH ONLY, and only behind the blind rating: the fields arrive solely in */
/*  the practice review and the exercise request, whose endpoints refuse to   */
/*  answer until the coach has rated the moment. The machine's confidence     */
/*  read of the clip and the raw measurements are never in these payloads,   */
/*  and nothing here maps them if they ever appear.                           */
/* -------------------------------------------------------------------------- */

export type CandidateReason =
  | "nothing_spotted"
  | "targets_nothing_that_fired"
  | "confidence_level_unplaceable"
  | "lower_fit_than_pool";

export interface MatchCandidate {
  exerciseId: string;
  outcome: "ranked" | "excluded";
  reason: CandidateReason | null;
  /** Order among the ranked, for sorting only. Never rendered as a number. */
  rank: number | null;
  fit: "exact" | "trial" | null;
  /** How many of this speaker's recurring problems it treats (step 7). */
  repeatHits: number;
  doneBefore: boolean;
}

const REASONS: readonly string[] = [
  "nothing_spotted", "targets_nothing_that_fired",
  "confidence_level_unplaceable", "lower_fit_than_pool",
];

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function fitOf(value: unknown): "exact" | "trial" | null {
  return value === "exact" || value === "trial" ? value : null;
}

/** Candidate rows: ranked ones first in their order, then the excluded. */
export function mapCandidates(value: unknown): MatchCandidate[] {
  const rows = records(value).flatMap((item): MatchCandidate[] => {
    if (typeof item.exercise_id !== "string" || !item.exercise_id) return [];
    return [{
      exerciseId: item.exercise_id,
      outcome: item.outcome === "ranked" ? "ranked" : "excluded",
      reason: typeof item.reason === "string" && REASONS.includes(item.reason)
        ? item.reason as CandidateReason : null,
      rank: typeof item.rank === "number" ? item.rank : null,
      fit: fitOf(item.fit),
      repeatHits: typeof item.repeat_hits === "number" && item.repeat_hits > 0 ? item.repeat_hits : 0,
      doneBefore: item.done_before === true,
    }];
  });
  const order = (c: MatchCandidate) =>
    c.outcome === "ranked" ? (c.rank ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER + 1;
  return rows.map((c, i) => ({ c, i }))
    .sort((a, b) => order(a.c) - order(b.c) || a.i - b.i)
    .map(({ c }) => c);
}
