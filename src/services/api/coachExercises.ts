import { criteriaForMainTarget, mainTargetOf } from "./journalAdmin";
import { mapSpeakingError, type SpeakingError } from "./speakingErrors";

/* -------------------------------------------------------------------------- */
/*  EXERCISE AUTHORING IN THE COACH PANEL — the coach's client                 */
/*  (founder 2026-09-29, decision 4)                                           */
/*                                                                            */
/*  The same library the CMS edits, through the coach's own door              */
/*  (/v2/coach/exercises, `require_admin_or_coach`), so a coach files and     */
/*  edits exercises without the shared CMS password. The backend runs the     */
/*  CMS's own refusals word for word; this client only shapes the request     */
/*  and reads the answer.                                                     */
/*                                                                            */
/*  EVERY SAVE KEEPS ITS VERSION (0395). What comes back carries the live     */
/*  row's version and, on the list, the latest version row: which door it     */
/*  came through and whether the video's transcript arrived. Nothing here     */
/*  reaches a speaker; the exercise reaches them only through the live row.   */
/*                                                                            */
/*  THE DRAFT IS A CANDIDATE. The script draft is returned to the coach and   */
/*  stored only beside the coach's final when they save — never served (LIVE  */
/*  LOOP: an exercise's text is copy the coach signs).                        */
/* -------------------------------------------------------------------------- */

export type TranscriptStatus =
  | "not_requested"
  | "pending"
  | "done"
  | "coach_authorization_missing"
  | "failed";

const TRANSCRIPT_STATUSES: readonly TranscriptStatus[] = [
  "not_requested", "pending", "done", "coach_authorization_missing", "failed",
];

/** One row of the version history (0395), as the list reads it. */
export interface ExerciseVersionRow {
  version: number;
  source: string;
  transcriptStatus: TranscriptStatus;
  aiDraftText: string | null;
  createdAt: string | null;
}

export interface CoachExercise {
  exerciseId: string;
  title: string;
  instruction: string;
  introductionCopy: string;
  explanationVideoUrl: string | null;
  acousticProblemTags: string[];
  matchingCriteria: Record<string, unknown>;
  active: boolean;
  version: number;
  latestVersion: ExerciseVersionRow | null;
}

/** An exercise as the form holds it. `mainTarget` is read from and written to
 *  `matching_criteria` (`criteriaForMainTarget`), never sent on its own. */
export interface CoachExerciseDraft {
  exerciseId: string;
  title: string;
  instruction: string;
  introductionCopy: string;
  acousticProblemTags: string[];
  mainTarget: string | null;
  /** The stored criteria of an existing exercise; null for a new one. */
  matchingCriteria: Record<string, unknown> | null;
  /** The stored video's address; empty for a new exercise, whose video
   *  arrives with its first save. */
  explanationVideoUrl: string;
  active: boolean;
  /** The AI draft the coach asked for, kept beside their final (0395). */
  aiDraftText: string | null;
  aiDraftModelVersion: string | null;
}

export type CoachExerciseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; code?: string };

export interface AuthoringLibrary {
  exercises: CoachExercise[];
  speakingErrors: SpeakingError[];
}

export interface SavedExercise {
  exercise: CoachExercise;
  version: number;
  transcriptStatus: TranscriptStatus | null;
}

export interface ScriptDraft {
  draft: string;
  modelVersion: string | null;
}

function mapVersionRow(raw: unknown): ExerciseVersionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.version !== "number") return null;
  const status = r.transcript_status;
  return {
    version: r.version,
    source: typeof r.source === "string" ? r.source : "",
    transcriptStatus: TRANSCRIPT_STATUSES.includes(status as TranscriptStatus)
      ? (status as TranscriptStatus) : "not_requested",
    aiDraftText: typeof r.ai_draft_text === "string" && r.ai_draft_text
      ? r.ai_draft_text : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
  };
}

export function mapCoachExercise(raw: unknown): CoachExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.exercise_id !== "string" || typeof r.title !== "string") return null;
  return {
    exerciseId: r.exercise_id,
    title: r.title,
    instruction: typeof r.instruction === "string" ? r.instruction : "",
    introductionCopy: typeof r.introduction_copy === "string" ? r.introduction_copy : "",
    explanationVideoUrl: typeof r.explanation_video_url === "string" && r.explanation_video_url
      ? r.explanation_video_url : null,
    acousticProblemTags: Array.isArray(r.acoustic_problem_tags)
      ? r.acoustic_problem_tags.filter((v): v is string => typeof v === "string") : [],
    matchingCriteria: r.matching_criteria && typeof r.matching_criteria === "object"
      ? (r.matching_criteria as Record<string, unknown>) : {},
    active: r.active === true,
    version: typeof r.version === "number" ? r.version : 1,
    latestVersion: mapVersionRow(r.latest_version),
  };
}

/** The form's draft for an existing exercise. */
export function draftFrom(exercise: CoachExercise): CoachExerciseDraft {
  return {
    exerciseId: exercise.exerciseId,
    title: exercise.title,
    instruction: exercise.instruction,
    introductionCopy: exercise.introductionCopy,
    acousticProblemTags: [...exercise.acousticProblemTags],
    mainTarget: mainTargetOf(exercise.matchingCriteria),
    matchingCriteria: exercise.matchingCriteria,
    explanationVideoUrl: exercise.explanationVideoUrl ?? "",
    active: exercise.active,
    aiDraftText: null,
    aiDraftModelVersion: null,
  };
}

export const BLANK_DRAFT: CoachExerciseDraft = {
  exerciseId: "",
  title: "",
  instruction: "",
  introductionCopy: "",
  acousticProblemTags: [],
  mainTarget: null,
  matchingCriteria: null,
  explanationVideoUrl: "",
  active: true,
  aiDraftText: null,
  aiDraftModelVersion: null,
};

/** The request body, in the backend's own names. The video's address is
 *  sent only when there is one: a new exercise's arrives with its file, and
 *  the backend fills it from storage. The AI draft rides along only when the
 *  coach asked for one. */
export function draftBody(draft: CoachExerciseDraft): Record<string, unknown> {
  const criteria = criteriaForMainTarget(draft.matchingCriteria, draft.mainTarget);
  return {
    exercise_id: draft.exerciseId.trim(),
    title: draft.title.trim(),
    instruction: draft.instruction.trim(),
    introduction_copy: draft.introductionCopy.trim(),
    acoustic_problem_tags: draft.acousticProblemTags,
    active: draft.active,
    ...(draft.explanationVideoUrl.trim()
      ? { explanation_video_url: draft.explanationVideoUrl.trim() } : {}),
    ...(criteria ? { matching_criteria: criteria } : {}),
    ...(draft.aiDraftText
      ? {
          ai_draft_text: draft.aiDraftText,
          ai_draft_model_version: draft.aiDraftModelVersion ?? "",
        }
      : {}),
  };
}

function readError(data: unknown, status: number): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (status === 401 || status === 403) return "Coach access required.";
  return `Request failed (HTTP ${status}).`;
}

async function call<T>(
  path: string,
  init: RequestInit,
  pick: (data: unknown) => T | null,
): Promise<CoachExerciseResult<T>> {
  let res: Response;
  let data: unknown;
  try {
    res = await fetch(path, init);
    data = await res.json().catch(() => ({}));
  } catch {
    return { ok: false, status: 0, message: "Network error. Try again." };
  }
  if (!res.ok) {
    const code = (data as Record<string, unknown> | null)?.code;
    return {
      ok: false,
      status: res.status,
      message: readError(data, res.status),
      ...(typeof code === "string" && code ? { code } : {}),
    };
  }
  const picked = pick(data);
  if (picked === null) {
    return { ok: false, status: res.status, message: "Unreadable answer from the server." };
  }
  return { ok: true, data: picked };
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function pickSaved(data: unknown): SavedExercise | null {
  const d = asRecord(data);
  const exercise = mapCoachExercise(d.exercise);
  if (!exercise) return null;
  const status = d.transcript_status;
  return {
    exercise,
    version: typeof d.version === "number" ? d.version : exercise.version,
    transcriptStatus: TRANSCRIPT_STATUSES.includes(status as TranscriptStatus)
      ? (status as TranscriptStatus) : null,
  };
}

/** The whole library as an author reads it, retired entries included, with
 *  the speaking errors the pickers offer. */
export function listCoachExercises() {
  return call<AuthoringLibrary>("/api/v2/coach/exercises", { method: "GET" }, (data) => {
    const d = asRecord(data);
    return {
      exercises: (Array.isArray(d.exercises) ? d.exercises : [])
        .map(mapCoachExercise)
        .filter((item): item is CoachExercise => item !== null),
      speakingErrors: (Array.isArray(d.speaking_errors) ? d.speaking_errors : [])
        .map(mapSpeakingError)
        .filter((item): item is SpeakingError => item !== null),
    };
  });
}

/** Save the words and targets of an exercise that already has its video. */
export function saveCoachExercise(draft: CoachExerciseDraft) {
  return call<SavedExercise>(
    "/api/v2/coach/exercises",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftBody(draft)),
    },
    pickSaved,
  );
}

/** Save with a video: the one call a NEW exercise is born through (the
 *  library refuses an exercise without a video), and the way an existing one
 *  gets a new recording. The definition rides beside the file and is checked
 *  before anything is stored. */
export function saveCoachExerciseWithVideo(draft: CoachExerciseDraft, file: File) {
  const form = new FormData();
  form.append("video_file", file, file.name);
  const { explanation_video_url: _stored, ...definition } = draftBody(draft);
  void _stored;
  form.append("exercise", JSON.stringify(definition));
  const id = encodeURIComponent(draft.exerciseId.trim());
  return call<SavedExercise>(
    `/api/v2/coach/exercises/${id}/video`,
    { method: "POST", body: form },
    pickSaved,
  );
}

/** A first script for the video, to the coach only. Nothing is stored. */
export function draftExerciseScript(input: {
  errorIds: string[];
  title?: string;
  notes?: string;
}) {
  return call<ScriptDraft>(
    "/api/v2/coach/exercises/script-draft",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_ids: input.errorIds,
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      }),
    },
    (data) => {
      const d = asRecord(data);
      if (typeof d.draft !== "string" || !d.draft.trim()) return null;
      return {
        draft: d.draft,
        modelVersion: typeof d.model_version === "string" ? d.model_version : null,
      };
    },
  );
}

/* -------------------------------------------------------------------------- */
/*  Client-side validation                                                     */
/*                                                                            */
/*  Mirrors EXERCISE_ID_SHAPE in services/diagnostic_exercise_catalogue.py.   */
/*  The backend is the real guard; this exists so an author is told why       */
/*  before they submit, and before a video leaves their machine.              */
/* -------------------------------------------------------------------------- */

export const EXERCISE_ID_SHAPE = /^[a-z][a-z0-9_-]{1,62}$/;

/** A sentence explaining the first problem with a draft, or null. Coach-facing
 *  wording; founder sign-off pending (accepted design, 2026-09-29). */
export function draftProblem(
  draft: CoachExerciseDraft,
  hasVideo: boolean,
): string | null {
  if (!EXERCISE_ID_SHAPE.test(draft.exerciseId.trim())) {
    return "The id needs lower-case letters, digits, hyphens and underscores only, starting with a letter.";
  }
  if (!draft.title.trim()) return "Give the exercise a name.";
  if (draft.acousticProblemTags.length === 0) return "Pick at least one speaking error it treats.";
  if (!hasVideo) return "An exercise needs its video before it can be saved.";
  return null;
}

/** An id from a title: `Land the ending` → `land-the-ending`. */
export function suggestExerciseId(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 63);
}
