/* -------------------------------------------------------------------------- */
/*  A moment no exercise fitted — the coach's side (backend 2026-09-28,       */
/*  contract 35b / 35f).                                                      */
/*                                                                            */
/*  Behind the same blind gate as the practice review: the backend answers    */
/*  409 BLIND_RATING_REQUIRED until the coach has saved their own Yes/No on   */
/*  the moment, so the caller only asks after that. A 404 is the normal case  */
/*  (nothing to ask the coach), and a speaker who turned practice off is      */
/*  answered with nothing too. All three read as `null` here.                 */
/*                                                                            */
/*  Coach-only. Nothing from this module ever reaches the speaker's payload.  */
/* -------------------------------------------------------------------------- */

import { mapCandidates, type MatchCandidate } from "./machinePick";
import { coachReadInit } from "./coachAuth";

export type ExerciseRequestResolution =
  | "exercise_chosen"
  | "exercise_authored"
  | "no_safe_match";

export interface ExerciseRequestExercise {
  exerciseId: string;
  version: number;
  title: string;
  instruction: string;
  explanationVideoRef: string | null;
}

export interface CoachExerciseRequest {
  id: string;
  reason: "nothing_spotted" | "nothing_targets_it" | "library_matched";
  /** Why it reached the coach (the follow-up matrix, founder 2026-09-29). */
  kind: "error" | "praise" | "rewrite" | "ambiguity";
  spotted: { errorId: string; label: string }[];
  resolution: ExerciseRequestResolution | null;
  resolvedExerciseId: string | null;
  shared: boolean;
  /** The library has since matched this moment and the speaker already got
   *  that exercise, so a share from here would not reach them. */
  offeredSince: boolean;
  /** Best match first, in the backend's order. No rank or distance is kept. */
  availableExercises: ExerciseRequestExercise[];
  /** Every exercise the machine weighed, and why none fitted (step 6). */
  candidates: MatchCandidate[];
}

export type ExerciseRequestAnswer =
  | { resolution: "exercise_chosen"; exerciseId: string; share: boolean }
  | {
      resolution: "exercise_authored";
      custom: {
        title: string;
        explanationVideoUrl: string;
        instruction?: string;
        acousticProblemTags?: string[];
      };
      share: boolean;
    }
  | { resolution: "no_safe_match" };

const RESOLUTIONS: readonly string[] = [
  "exercise_chosen", "exercise_authored", "no_safe_match",
];

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        !!item && typeof item === "object")
    : [];
}

function mapExercise(item: Record<string, unknown>): ExerciseRequestExercise | null {
  const exerciseId = str(item.exercise_id);
  const title = str(item.title);
  if (!exerciseId || !title) return null;
  return {
    exerciseId,
    version: typeof item.version === "number" ? item.version : 1,
    title,
    instruction: typeof item.instruction === "string" ? item.instruction : "",
    explanationVideoRef: str(item.explanation_video_ref),
  };
}

export function mapCoachExerciseRequest(raw: unknown): CoachExerciseRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const resolution = typeof r.resolution === "string" &&
    RESOLUTIONS.includes(r.resolution)
    ? r.resolution as ExerciseRequestResolution : null;
  return {
    id,
    reason:
      r.reason === "nothing_targets_it" || r.reason === "library_matched"
        ? r.reason
        : "nothing_spotted",
    kind:
      r.kind === "praise" || r.kind === "rewrite" || r.kind === "ambiguity"
        ? r.kind
        : "error",
    spotted: records(r.spotted).flatMap((item) => {
      const errorId = str(item.error_id);
      return errorId ? [{ errorId, label: str(item.label) ?? errorId }] : [];
    }),
    resolution,
    resolvedExerciseId: str(r.resolved_exercise_id),
    shared: typeof r.shared_at === "string" && r.shared_at.length > 0,
    offeredSince: r.offered_since === true,
    availableExercises: records(r.available_exercises)
      .map(mapExercise)
      .filter((item): item is ExerciseRequestExercise => item !== null),
    candidates: mapCandidates(r.candidates),
  };
}

function requestPath(sessionId: string, snippetId: string): string {
  return `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request`;
}

/** The request for this moment, or null when there is none to show (404,
 *  the blind gate, practice turned off, or any failure). */
export async function fetchCoachExerciseRequest(
  sessionId: string,
  snippetId: string,
): Promise<CoachExerciseRequest | null> {
  try {
    const res = await fetch(requestPath(sessionId, snippetId), await coachReadInit());
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return mapCoachExerciseRequest(data?.request);
  } catch {
    return null;
  }
}

export function answerBody(answer: ExerciseRequestAnswer): Record<string, unknown> {
  if (answer.resolution === "no_safe_match") return { resolution: "no_safe_match" };
  if (answer.resolution === "exercise_chosen") {
    return {
      resolution: "exercise_chosen",
      exercise_id: answer.exerciseId,
      share_with_user: answer.share,
    };
  }
  const { custom } = answer;
  return {
    resolution: "exercise_authored",
    custom_exercise: {
      title: custom.title,
      explanation_video_url: custom.explanationVideoUrl,
      instruction: custom.instruction || undefined,
      acoustic_problem_tags: custom.acousticProblemTags?.length
        ? custom.acousticProblemTags : undefined,
    },
    share_with_user: answer.share,
  };
}

/** Sent when the backend refuses without a sentence of its own. */
const FALLBACK_REFUSAL = "Couldn’t save your answer. Try again.";

/** The coach's one answer. A refusal carries the backend's own sentence
 *  (catalogue refusals are written to be read), shown as it is. */
export async function answerCoachExerciseRequest(
  sessionId: string,
  snippetId: string,
  answer: ExerciseRequestAnswer,
): Promise<{ ok: true; request: CoachExerciseRequest } | { ok: false; message: string }> {
  try {
    const res = await fetch(requestPath(sessionId, snippetId), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answerBody(answer)),
    });
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, message: str(data?.error) ?? FALLBACK_REFUSAL };
    }
    const request = mapCoachExerciseRequest(data?.request);
    return request ? { ok: true, request } : { ok: false, message: FALLBACK_REFUSAL };
  } catch {
    return { ok: false, message: FALLBACK_REFUSAL };
  }
}
