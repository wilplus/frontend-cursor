/**
 * Homework flow (V2) — types for a single-task practice flow.
 * Backend may not implement these yet; BFF and client are ready for when it does.
 */

import { firstTaskTextFromPool, mergeHomeworkTaskPair, taskFieldText } from "@/lib/api/homework-task-fields";

export type UUID = string;

function trimStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// —— Public status (must match backend exactly). Only use top-level status. ——
export type PublicHomeworkStatus =
  | "none"
  | "recording_1_required"
  | "task_block"
  | "final_task_ready"
  | "post_questions"
  | "completed"
  | "completing_from_recording_1"
  | "completing_from_recording_2"
  | "report_generating";

export type Step = 0 | 1 | 2 | 3;

/**
 * Single mapping: backend status → UI step.
 * Step 3 = report.
 */
export function mapStatusToStep(status: PublicHomeworkStatus): Step {
  switch (status) {
    case "none":
      return 0;
    case "recording_1_required":
      return 1;
    // task_block: between recordings — show self-rating (step 2) while job processes
    case "task_block":
      return 2;
    // final_task_ready → report
    case "final_task_ready":
      return 3;
    // post_questions, completing_*, completed, report_generating → report
    case "post_questions":
    case "completing_from_recording_2":
    case "completed":
    case "completing_from_recording_1":
    case "report_generating":
      return 3;
    default: {
      const _exhaustive: never = status;
      return 0;
    }
  }
}

function normalizeStatusToken(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim().replace(/\s+/g, "_") : "";
}

function getRawSession(
  raw: HomeworkSessionStatus | HomeworkResponse
): { id?: string; status?: string; state?: string } | null {
  if (!("session" in raw) || raw.session == null || typeof raw.session !== "object") {
    return null;
  }
  return raw.session as { id?: string; status?: string; state?: string };
}

/**
 * Derive the visible homework UI step from backend session status.
 * This is more specific than mapStatusToStep because it also considers
 * active-session flags, recording presence, and self-rating readiness.
 */
export function deriveHomeworkStep(
  raw: HomeworkSessionStatus | HomeworkResponse | null | undefined
): Step {
  if (!raw) return 0;
  const session = getRawSession(raw);

  if ("has_active_session" in raw && raw.has_active_session === false) {
    return 0;
  }

  const normalizedStatus = toPublicStatus(
    ("status" in raw ? raw.status : undefined) ?? session?.status
  );

  const rawStatusTokens = [
    "status" in raw ? raw.status : undefined,
    "session_state" in raw ? raw.session_state : undefined,
    session?.status,
    session?.state,
  ].map(normalizeStatusToken);

  const hasReportPayload =
    ("report_text" in raw && typeof raw.report_text === "string" && raw.report_text.trim().length > 0) ||
    ("score" in raw && typeof raw.score === "number");

  if (
    hasReportPayload ||
    normalizedStatus === "completed" ||
    normalizedStatus === "completing_from_recording_1" ||
    normalizedStatus === "completing_from_recording_2" ||
    normalizedStatus === "report_generating" ||
    normalizedStatus === "post_questions" ||
    rawStatusTokens.includes("completed") ||
    rawStatusTokens.includes("report_generated") ||
    rawStatusTokens.includes("report_generating") ||
    rawStatusTokens.includes("recording2_uploaded") ||
    rawStatusTokens.includes("recording2_scored") ||
    rawStatusTokens.includes("recording_2_uploaded") ||
    rawStatusTokens.includes("recording_2_scored")
  ) {
    return 3;
  }

  // Recording 2 was removed; final_task_ready maps to report
  if (normalizedStatus === "final_task_ready") {
    return 3;
  }

  const hasRecordingId =
    "recording_id" in raw &&
    typeof raw.recording_id === "string" &&
    raw.recording_id.trim().length > 0;
  const readyForSelfRating =
    "ready_for_self_rating" in raw && raw.ready_for_self_rating === true;

  if (readyForSelfRating || hasRecordingId) {
    return 2;
  }

  const hasSessionId =
    ("session_id" in raw && typeof raw.session_id === "string" && raw.session_id.trim().length > 0) ||
    (typeof session?.id === "string" && session.id.trim().length > 0);

  if (
    normalizedStatus === "recording_1_required" ||
    rawStatusTokens.includes("warm_up") ||
    rawStatusTokens.includes("created") ||
    rawStatusTokens.includes("warmup_recorded") ||
    hasSessionId ||
    ("has_active_session" in raw && raw.has_active_session === true)
  ) {
    return 1;
  }

  return 0;
}

/** Unified response shape for GET status and all mutations. Top-level status only; optional data. Matches backend exactly. Backend sends report_text, not report. */
export interface HomeworkResponse {
  status: PublicHomeworkStatus;
  session_id?: string | null;
  recording_id?: string | null;
  task?: string | null;
  report_text?: string | null;
  /** Canonical session score (0–1). */
  score?: number | null;
  tutor_feedback_deadline?: string | null;
  tutor_feedback_message?: string | null;
  /** Optional step-0 homework video URL. Preferred over assigned_exercises[].video_url when present. */
  tutor_video_url?: string | null;
  /** Optional coach intro text for the current homework. Can accompany tutor_video_url on step 0 and other flow messaging. */
  tutor_video_description?: string | null;
  /** When true: tutor_video_url is the generic "welcome video" fallback (first-time users with no personal coach assignment yet). Show a friendlier welcome label and hide the Start homework CTA. */
  tutor_video_is_universal?: boolean | null;
  /** When has_active_session === false: exercises assigned to this student. Shown on step 0 below Start homework. */
  assigned_exercises?: AssignedExercise[];
  review_pending?: boolean | null;
  has_assigned_homework?: boolean | null;
  homework_ready?: boolean | null;
  main_screen_state?: string | null;
  main_screen_message?: string | null;
  sniper_profile?: {
    user_id?: string;
    realtime_level?: number | null;
    realtime_step?: number | null;
    realtime_pitch_baseline_st?: number | null;
    sessions_with_pitch_count?: number | null;
    updated_at?: string | null;
  } | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  last_report_delivered?: boolean | null;
  session?: unknown;
  has_active_session?: boolean;
  /** Remaining homework credits (from GET status). Charged −5 on completion+report on backend, not on start. Included for step 0 and when has_active_session is true. */
  credits?: number | null;
}

/** Normalize raw API status string to PublicHomeworkStatus. Use when building HomeworkResponse from GET. */
export function toPublicStatus(s: unknown): PublicHomeworkStatus {
  if (typeof s !== "string") return "none";
  const t = s.toLowerCase().trim().replace(/\s+/g, "_");
  const allowed: PublicHomeworkStatus[] = ["none", "recording_1_required", "task_block", "final_task_ready", "post_questions", "completed", "completing_from_recording_1", "completing_from_recording_2", "report_generating"];
  if (allowed.includes(t as PublicHomeworkStatus)) return t as PublicHomeworkStatus;
  return "none";
}

// —— Start homework session ——
export interface HomeworkStartResponse {
  session_id: UUID;
  task?: string | null;
}

// —— Session status (for resume / step derivation). Backend may return a subset. ——
/** Backend state-machine status (source of truth for step). Use these to derive step on load. */
export type HomeworkSessionStatusBackend =
  | "warm_up"           // step 1: warm-up recording
  | "task_block"        // legacy backend name for the step-2 question block
  | "final_task_ready"  // step 3: final task + recording-2
  | "post_questions"    // step 4: reflective questions
  | "completed";        // step 5: report

export type HomeworkSessionStatusEnum =
  | "created"
  | "warmup_recorded"
  | "warmup_scored"
  | "focus_selected"
  | "task_generated"
  | "recording2_uploaded"
  | "recording2_scored"
  | "post_questions_done"
  | "report_generated";

export interface HomeworkSessionStatus {
  session_id?: UUID;
  status?: HomeworkSessionStatusEnum | string;
  /** Session recording identifier returned by the backend. */
  recording_id?: UUID | null;
  task?: string | null;
  /** Opening prompt (some backends send this instead of or in addition to `task`). */
  task_text?: string | null;
  report_text?: string | null;
  score?: number | null;
  /** Backend: no active session; clear state and require POST start. */
  has_active_session?: boolean;
  /** Backend: alternative to status (e.g. top-level session_state). */
  session_state?: string;
  /** Backend: nested session (snake_case). Use for id, status, context_long, score, tutor video fields. */
  session?: {
    id?: string;
    status?: string;
    state?: string;
    context_long?: string | null;
    score?: number | null;
    task?: string | null;
    task_text?: string | null;
    tasks_pool?: Array<string | { id?: string; text?: string }> | null;
    task_pool?: Array<string | { id?: string; text?: string }> | null;
    tutor_video_url?: string | null;
    tutor_video_description?: string | null;
  };
  /** When no active session: deadline (ISO 8601 UTC) for tutor to send feedback and new homework. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
  /** When no active session: optional message from tutor (e.g. warning to wait for feedback). Show as info banner on step 0. */
  tutor_feedback_message?: string | null;
  /** Optional step-0 homework video URL. Preferred over assigned_exercises[].video_url when present. */
  tutor_video_url?: string | null;
  /** Optional coach intro text for the current homework. Can accompany tutor_video_url on step 0 and other flow messaging. */
  tutor_video_description?: string | null;
  /** When true: tutor_video_url is the generic "welcome video" fallback (first-time users with no personal coach assignment yet). Show a friendlier welcome label and hide the Start homework CTA. */
  tutor_video_is_universal?: boolean | null;
  /** When has_active_session === false: exercises assigned to this student (e.g. from admin assigned_next_exercise_id). Shown on step 0 below Start homework. */
  assigned_exercises?: AssignedExercise[];
  review_pending?: boolean | null;
  has_assigned_homework?: boolean | null;
  homework_ready?: boolean | null;
  main_screen_state?: string | null;
  main_screen_message?: string | null;
  sniper_profile?: {
    user_id?: string;
    realtime_level?: number | null;
    realtime_step?: number | null;
    realtime_pitch_baseline_st?: number | null;
    sessions_with_pitch_count?: number | null;
    updated_at?: string | null;
  } | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  last_report_delivered?: boolean | null;
  /** Backend: recording-1 job state. When not "pending", safe to call POST self-rating again to trigger completion. */
  recording_1_processing_status?: string | null;
  /** Backend: when true, show the current 1–5 self-rating step and allow POST self-rating. */
  ready_for_self_rating?: boolean | null;
  /** Remaining homework credits (from GET status). Charged −5 on completion+report on backend, not on start. Included when has_active_session is true or false. */
  credits?: number | null;
  /** Willab credit gate (F1): false once the user can't afford the next analysis
   *  (server-owned; the FE must NOT hardcode the `credits >= 5` threshold). */
  can_start_analysis?: boolean | null;
  /** Phase-1 pricing: true once the $50 full audit is purchased for the active
   *  arc (per-arc entitlement). Drives the free→paid locked rendering. Absent /
   *  null on an older payload → treated as paid (no spurious lock). */
  audit_paid?: boolean | null;
  /** The full-audit price in minor units + currency (for the paywall copy). */
  audit_price?: { amount_minor: number; currency: string } | null;
  /** Opening-recording prompt pool; first item used when `task` / `task_text` absent. Prefer `tasks_pool` (admin/homework contract). */
  tasks_pool?: Array<string | { id?: string; text?: string }> | null;
  /** @deprecated Prefer `tasks_pool`; still accepted for older responses. */
  task_pool?: Array<string | { id?: string; text?: string }> | null;
}

/** Exercise item returned in GET session/status when no active session (from assigned_exercises). */
export interface AssignedExercise {
  id: string;
  title: string;
  video_url?: string | null;
  description?: string | null;
}

/** Build HomeworkResponse from GET status. Normalizes status to top-level (only place that reads nested session.status). */
export function getStatusToHomeworkResponse(raw: HomeworkSessionStatus): HomeworkResponse {
  const status = toPublicStatus(raw.status ?? raw.session?.status);
  const legacyRaw = raw as HomeworkSessionStatus & {
    task_text?: string | null;
    final_task?: string | { text?: string } | null;
    final_task_text?: string | null;
    tasks_pool?: HomeworkSessionStatus["tasks_pool"];
    task_pool?: HomeworkSessionStatus["task_pool"];
    session?: HomeworkSessionStatus["session"] & {
      task?: string | null;
      task_text?: string | null;
      tasks_pool?: HomeworkSessionStatus["tasks_pool"];
      task_pool?: HomeworkSessionStatus["task_pool"];
      final_task_text?: string | null;
    };
  };
  const nested = legacyRaw.session;
  const taskFromFields = mergeHomeworkTaskPair(
    taskFieldText(raw.task) ?? taskFieldText(nested?.task) ?? null,
    trimStr(legacyRaw.task_text) ?? trimStr(nested?.task_text) ?? null
  );
  const task =
    taskFromFields ??
    firstTaskTextFromPool(raw.tasks_pool) ??
    firstTaskTextFromPool(raw.task_pool) ??
    firstTaskTextFromPool(nested?.tasks_pool) ??
    firstTaskTextFromPool(nested?.task_pool) ??
    (typeof legacyRaw.final_task === "string" ? legacyRaw.final_task : null) ??
    legacyRaw.final_task_text ??
    legacyRaw.session?.final_task_text ??
    null;
  return {
    status,
    session_id: raw.session_id ?? raw.session?.id ?? null,
    recording_id: raw.recording_id ?? null,
    task,
    report_text: raw.report_text ?? raw.session?.context_long ?? null,
    score: raw.score ?? raw.session?.score ?? null,
    tutor_feedback_deadline: raw.tutor_feedback_deadline ?? null,
    tutor_feedback_message: raw.tutor_feedback_message ?? null,
    tutor_video_url: raw.tutor_video_url ?? raw.session?.tutor_video_url ?? null,
    tutor_video_description: raw.tutor_video_description ?? raw.session?.tutor_video_description ?? null,
    tutor_video_is_universal: raw.tutor_video_is_universal ?? null,
    assigned_exercises: Array.isArray(raw.assigned_exercises) ? raw.assigned_exercises : [],
    review_pending: raw.review_pending ?? null,
    main_screen_state: raw.main_screen_state ?? null,
    main_screen_message: raw.main_screen_message ?? null,
    sniper_profile: raw.sniper_profile ?? null,
    realtime_level: raw.realtime_level ?? raw.sniper_profile?.realtime_level ?? null,
    realtime_step: raw.realtime_step ?? raw.sniper_profile?.realtime_step ?? null,
    last_report_delivered: raw.last_report_delivered ?? null,
    credits: raw.credits ?? null,
  };
}

// —— Step-2 prompt item (id + text, used in the legacy task_block payload) ——
export interface QuestionPromptItemV2 {
  id?: string;
  text: string;
  order_index?: number;
}

// QuestionBlockV2 is kept for homework-client.ts getRecordingUploadUrl which still references it.
export interface QuestionBlockV2 {
  context_short?: string;
  metric_question_1?: QuestionPromptItemV2 | string;
  metric_question_2?: QuestionPromptItemV2 | string;
  metric_question_3?: QuestionPromptItemV2 | string;
  /** @deprecated Legacy backend field kept for compatibility. */
  focus_task?: unknown;
}

export interface HomeworkRecording1Response {
  /** Canonical score (replaces performance_score_1). */
  score?: number | null;
  /** @deprecated Kept for backward compat. */
  performance_score_1?: number;
  recording_id?: UUID | null;
}

/** POST recording-2 response (backend shape may include additional fields). */
export interface HomeworkRecording2Response {
  status?: string;
  recording_id?: UUID | null;
  [key: string]: unknown;
}

export interface HomeworkTaskAnswersResponse {
  final_task?: string;
  final_task_text?: string;
  /** When true, recording-1 analysis failed and backend used a general focus; see message. */
  recording_1_fallback?: boolean;
  /** Explanation when recording_1_fallback is true. */
  message?: string;
}

/** One point for "Progress over sessions" chart: date and combined score (0–100). */
export interface PerformanceHistoryPoint {
  date: string; // ISO or display date
  score: number; // 0–100
}

// —— GET report (step 5 panel: player + graph + text) ——

/** New shape: single recording with transcription and filler words. Optional for backward compat. */
export interface ReportRecording {
  transcription_text?: string | null;
  filler_words_count?: { total: number; breakdown?: Record<string, number> };
  audio_url?: string | null;
}

export interface HomeworkReportResponse {
  report_text: string;
  scores?: { warmup?: number; final?: number; overall?: number };
  /** Canonical backend score for UI display (0–100). */
  score_for_display?: number;
  realtime_level?: number | null;
  realtime_step?: number | null;
  sniper_profile?: {
    user_id?: string;
    realtime_level?: number | null;
    realtime_step?: number | null;
    realtime_pitch_baseline_st?: number | null;
    sessions_with_pitch_count?: number | null;
    updated_at?: string | null;
  } | null;
  final_recording: { id: string | null; audio_url: string | null };
  /** Last 5 sessions' performance (oldest first). When absent, frontend may derive a single point from scores.overall. */
  performance_history?: PerformanceHistoryPoint[];
  /** When completed and deadline in future: ISO 8601 UTC. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
  /** New: optional recording with full transcription and filler words. When present, prefer over legacy transcript/filler_word_count. */
  recording?: ReportRecording | null;
  /** Optional 2-sentence coach insight. Omitted for older sessions or if generation failed. */
  coach_insight?: string | null;
  /** Report grade 1–10 (if provided by coach/admin). */
  report_grade?: number | null;
  /** Optional coach message attached to the grade. */
  coach_message?: string | null;
  /** Same as coach_message — backend field name used in report response. */
  report_comment?: string | null;
  /** When report is from recording-1 only (e.g. skip from step 2): first recording playback and analysis. */
  recording_1?: { id: string | null; audio_url: string | null };
  /** Transcript of recording 1 (legacy; prefer recording.transcription_text when present). */
  transcript?: string | null;
  /** Top-level transcription text — some backend versions omit the `recording` wrapper and return this directly. */
  transcription_text?: string | null;
  /** Filler words count (legacy; prefer recording.filler_words_count when present). */
  filler_word_count?: number | null;
  /** Strength metric label or value (e.g. "7/10" or "Good"). */
  strength_metric?: string | null;
  /** Pace metric label or value (e.g. "Steady"). */
  pace_metric?: string | null;
  /** Canonical score for this session (0–100). Replaces performance_score_1. */
  score?: number | null;
  /** @deprecated Kept for backward compat with older backends. */
  performance_score_1?: number | null;
  /** Main CTA at end of report (e.g. "Send the homework to the coach!"). On tap: go to step 0 and call GET session/status so timer can appear if needed. */
  report_cta?: string | null;
}
