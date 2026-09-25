export interface CoachPracticeAttempt {
  id: string;
  attemptIndex: number;
  audioRef: string;
  durationMs: number;
  assessment: string;
  isStrongest: boolean;
  isSelected: boolean;
  kept: boolean;
  userAnswer: "yes" | "no" | null;
  coachConfidenceDecision: "yes" | "no" | null;
}

export interface CoachPracticeExercise {
  exerciseId: string;
  version: number;
  title: string;
  instruction: string;
  explanationVideoRef: string | null;
  isCustom: boolean;
}

/** An error the coach named on this moment. Coach-only: the speaker's payload
 *  never carries it. */
export interface CoachNamedError {
  errorId: string;
  label: string;
}

/** What attaching an exercise from this moment taught the library, and can
 *  still be undone. Only teachings that changed the library are listed. */
export interface CoachLibraryTeaching {
  teachingId: string;
  exerciseId: string;
  errorId: string;
  errorLabel: string;
}

export interface CoachConfidencePractice {
  id: string;
  exactPassage: string;
  originalAudioRef: string | null;
  originalStartOffsetMs: number;
  originalDurationMs: number;
  originalUserAnswer: "yes" | "no" | null;
  finalUserAnswer: "yes" | "no" | null;
  professionalCoachDecision: "yes" | "no" | "refine" | null;
  coachShared: boolean;
  exercise: CoachPracticeExercise;
  availableExercises: CoachPracticeExercise[];
  attempts: CoachPracticeAttempt[];
  namedErrors: CoachNamedError[];
  libraryTeachings: CoachLibraryTeaching[];
}

function answer(value: unknown): "yes" | "no" | null {
  return value === "yes" || value === "no" ? value : null;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        !!item && typeof item === "object")
    : [];
}

function mapNamedErrors(value: unknown): CoachNamedError[] {
  return records(value).flatMap((item) =>
    typeof item.error_id === "string" && item.error_id
      ? [{
          errorId: item.error_id,
          label: typeof item.label === "string" && item.label
            ? item.label : item.error_id,
        }]
      : []);
}

function mapLibraryTeachings(value: unknown): CoachLibraryTeaching[] {
  return records(value).flatMap((item) =>
    typeof item.teaching_id === "string" &&
    typeof item.exercise_id === "string" &&
    typeof item.error_id === "string"
      ? [{
          teachingId: item.teaching_id,
          exerciseId: item.exercise_id,
          errorId: item.error_id,
          errorLabel: typeof item.error_label === "string" && item.error_label
            ? item.error_label : item.error_id,
        }]
      : []);
}

export function mapCoachConfidencePractice(raw: unknown): CoachConfidencePractice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ex = r.exercise && typeof r.exercise === "object"
    ? r.exercise as Record<string, unknown> : null;
  if (
    typeof r.id !== "string" || typeof r.exact_passage !== "string" ||
    !ex || typeof ex.exercise_id !== "string" || typeof ex.title !== "string" ||
    typeof ex.instruction !== "string"
  ) return null;
  const attempts = Array.isArray(r.attempts)
    ? r.attempts.flatMap((item): CoachPracticeAttempt[] => {
        if (!item || typeof item !== "object") return [];
        const a = item as Record<string, unknown>;
        if (
          typeof a.id !== "string" || typeof a.attempt_index !== "number" ||
          typeof a.audio_ref !== "string" || typeof a.duration_ms !== "number"
        ) return [];
        return [{
          id: a.id,
          attemptIndex: a.attempt_index,
          audioRef: a.audio_ref,
          durationMs: a.duration_ms,
          assessment: typeof a.assessment === "string" ? a.assessment : "",
          isStrongest: a.is_strongest === true,
          isSelected: a.is_selected === true,
          kept: a.kept === true,
          userAnswer: answer(a.user_answer),
          coachConfidenceDecision: answer(a.coach_confidence_decision),
        }];
      })
    : [];
  const decision = r.professional_coach_decision;
  const mapExercise = (
    value: unknown,
    isCustom = false,
  ): CoachPracticeExercise | null => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.exercise_id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.instruction !== "string"
    ) return null;
    return {
      exerciseId: item.exercise_id,
      version: typeof item.version === "number" ? item.version : 1,
      title: item.title,
      instruction: item.instruction,
      explanationVideoRef: typeof item.explanation_video_ref === "string"
        ? item.explanation_video_ref : null,
      isCustom: item.is_custom === true || isCustom,
    };
  };
  const mappedExercise = mapExercise(ex, ex.is_custom === true);
  if (!mappedExercise) return null;
  const availableExercises = Array.isArray(r.available_exercises)
    ? r.available_exercises
        .map((item) => mapExercise(item))
        .filter((item): item is CoachPracticeExercise => item !== null)
    : [];
  return {
    id: r.id,
    exactPassage: r.exact_passage,
    originalAudioRef: typeof r.original_audio_ref === "string" ? r.original_audio_ref : null,
    originalStartOffsetMs: typeof r.original_start_offset_ms === "number" ? r.original_start_offset_ms : 0,
    originalDurationMs: typeof r.original_duration_ms === "number" ? r.original_duration_ms : 0,
    originalUserAnswer: answer(r.original_user_answer),
    finalUserAnswer: answer(r.final_user_answer),
    professionalCoachDecision:
      decision === "yes" || decision === "no" || decision === "refine" ? decision : null,
    coachShared: typeof r.coach_shared_at === "string",
    exercise: mappedExercise,
    availableExercises,
    attempts,
    namedErrors: mapNamedErrors(r.named_errors),
    libraryTeachings: mapLibraryTeachings(r.library_teachings),
  };
}

export async function fetchCoachConfidencePractice(
  sessionId: string,
  snippetId: string,
): Promise<CoachConfidencePractice | null> {
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/confidence-practice`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return mapCoachConfidencePractice(data?.practice);
  } catch {
    return null;
  }
}

export async function saveCoachConfidencePractice(
  sessionId: string,
  snippetId: string,
  decision: "yes" | "no" | "refine",
  selectedAttemptDecision: "yes" | "no" | null,
  shareWithUser: boolean,
  selection:
    | { kind: "library"; exerciseId: string; explanationVideoUrl?: string }
    | {
        kind: "custom";
        title: string;
        instruction: string;
        explanationVideoUrl?: string;
      },
): Promise<CoachConfidencePractice | null> {
  try {
    const res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/confidence-practice`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professional_coach_decision: decision,
          selected_attempt_coach_decision: selectedAttemptDecision ?? undefined,
          exercise_id: selection.kind === "library" ? selection.exerciseId : undefined,
          custom_exercise: selection.kind === "custom"
            ? {
                title: selection.title,
                instruction: selection.instruction,
                explanation_video_url: selection.explanationVideoUrl || undefined,
              }
            : undefined,
          explanation_video_url: selection.explanationVideoUrl || undefined,
          share_with_user: shareWithUser,
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return mapCoachConfidencePractice(data?.practice);
  } catch {
    return null;
  }
}

function practicePath(sessionId: string, snippetId: string): string {
  return `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/confidence-practice`;
}

async function practiceCall(
  url: string,
  init: RequestInit,
): Promise<CoachConfidencePractice | null> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    return mapCoachConfidencePractice(data?.practice);
  } catch {
    return null;
  }
}

/** One edit on the coach's practice review, as a PATCH on the review itself.
 *  The backend keeps the coach's exercise surface to one purpose-guarded
 *  route, so naming and undoing ride on it, behind its own blind gate. */
function patchPractice(
  sessionId: string,
  snippetId: string,
  edit: Record<string, unknown>,
): Promise<CoachConfidencePractice | null> {
  return practiceCall(practicePath(sessionId, snippetId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
}

/** Name (or withdraw) an error on this moment. The error must already be in
 *  the library. Returns the refreshed practice, or null when it failed. */
export function nameMomentError(
  sessionId: string,
  snippetId: string,
  errorId: string,
  named: boolean,
): Promise<CoachConfidencePractice | null> {
  return patchPractice(sessionId, snippetId, {
    name_error: { error_id: errorId, named },
  });
}

/** Undo what attaching an exercise from this moment taught the library. */
export function undoLibraryTeaching(
  sessionId: string,
  snippetId: string,
  teachingId: string,
): Promise<CoachConfidencePractice | null> {
  return patchPractice(sessionId, snippetId, { undo_teaching: teachingId });
}
