import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  coachReviewState — the coach wrap-up screen's single read (FE-2 / PR #206) */
/*                                                                            */
/*  GET /v2/coach/arc/<arcId>/review-state drives the wrap-up: per-take review */
/*  states, the ideal-text assembly/approval status, and can_publish +         */
/*  blockers that mirror EXACTLY what publish-analysis enforces — so the        */
/*  PUBLISH button renders its real state (enabled / disabled-with-reason)      */
/*  instead of discovering the gate on a failed POST. Defensive: every field    */
/*  defaults safely; the whole fetch soft-fails to null.                       */
/* -------------------------------------------------------------------------- */

/** Per-take lifecycle: to_review → reviewed (coach saved) → delivered (published). */
export type ReviewTakeState = "to_review" | "reviewed" | "delivered";

export interface ReviewStateTake {
  sessionId: string;
  takeIndex: number | null;
  reviewState: ReviewTakeState | null;
  /** The take carries a re-read (a corrected re-recording) alongside the spoken. */
  hasReread: boolean;
}

/** Why publish is blocked — mirrors publish-analysis's own preconditions. */
export type PublishBlocker =
  | "TAKES_NOT_SAVED"
  | "IDEAL_TEXT_NOT_APPROVED"
  | "NO_TAKES";

export interface CoachReviewState {
  arcId: string;
  /** Terminal: the analysis has already been published (the 4 bubbles sent). */
  published: boolean;
  takes: ReviewStateTake[];
  takesSaved: number | null;
  takesTotal: number | null;
  takesTarget: number | null;
  ideal: {
    assemblyState: "pending" | "empty" | "ready" | null;
    ready: boolean;
    approved: boolean;
    source: "machine" | "coach" | null;
    takesDone: number | null;
  };
  /** True only when EVERY publish precondition is met (blockers is empty). */
  canPublish: boolean;
  blockers: PublishBlocker[];
  /** Sessions still awaiting a saved review — the deep-link targets for the
   *  TAKES_NOT_SAVED blocker copy. */
  pendingSessionIds: string[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickReviewState(v: unknown): ReviewTakeState | null {
  return v === "to_review" || v === "reviewed" || v === "delivered" ? v : null;
}

function pickBlocker(v: unknown): PublishBlocker | null {
  return v === "TAKES_NOT_SAVED" ||
    v === "IDEAL_TEXT_NOT_APPROVED" ||
    v === "NO_TAKES"
    ? v
    : null;
}

function pickTake(raw: unknown): ReviewStateTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sessionId = typeof r.session_id === "string" ? r.session_id : "";
  if (!sessionId) return null;
  return {
    sessionId,
    takeIndex: num(r.take_index),
    reviewState: pickReviewState(r.review_state),
    hasReread: r.has_reread === true,
  };
}

export function mapCoachReviewState(raw: unknown): CoachReviewState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const arcId = typeof r.arc_id === "string" ? r.arc_id : "";
  const idealRaw = (r.ideal ?? {}) as Record<string, unknown>;
  return {
    arcId,
    published: r.published === true,
    takes: Array.isArray(r.takes)
      ? r.takes.map(pickTake).filter((t): t is ReviewStateTake => t !== null)
      : [],
    takesSaved: num(r.takes_saved),
    takesTotal: num(r.takes_total),
    takesTarget: num(r.takes_target),
    ideal: {
      assemblyState:
        idealRaw.assembly_state === "pending"
          ? "pending"
          : idealRaw.assembly_state === "empty"
          ? "empty"
          : idealRaw.assembly_state === "ready"
          ? "ready"
          : null,
      ready: idealRaw.ready === true,
      approved: idealRaw.approved === true,
      source:
        idealRaw.source === "coach"
          ? "coach"
          : idealRaw.source === "machine"
          ? "machine"
          : null,
      takesDone: num(idealRaw.takes_done),
    },
    canPublish: r.can_publish === true,
    blockers: Array.isArray(r.blockers)
      ? r.blockers.map(pickBlocker).filter((b): b is PublishBlocker => b !== null)
      : [],
    pendingSessionIds: Array.isArray(r.pending_session_ids)
      ? r.pending_session_ids.filter(
          (s): s is string => typeof s === "string" && s.length > 0
        )
      : [],
  };
}

/** Fetch the wrap-up read. Soft-fails to null (the screen shows a retry cue). */
export async function fetchCoachReviewState(
  arcId: string
): Promise<CoachReviewState | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/review-state`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as unknown;
  return mapCoachReviewState(body);
}
