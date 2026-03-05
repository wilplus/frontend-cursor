/**
 * Homework flow (V2) — types for warm-up + two recordings flow.
 * Backend may not implement these yet; BFF and client are ready for when it does.
 */

export type UUID = string;

// —— Public status (must match backend exactly). Only use top-level status. ——
export type PublicHomeworkStatus =
  | "none"
  | "recording_1_required"
  | "task_block"
  | "final_task_ready"
  | "post_questions"
  | "completed"
  | "completing_from_recording_1"
  | "report_generating";

export type Step = 0 | 1 | 2 | 3 | 4 | 5;

/** Single mapping: backend status → UI step. completing_from_recording_1/report_generating = report in progress → step 5. */
export function mapStatusToStep(status: PublicHomeworkStatus): Step {
  switch (status) {
    case "none":
      return 0;
    case "recording_1_required":
      return 1;
    case "task_block":
    case "final_task_ready":
    case "post_questions":
    case "completed":
    case "completing_from_recording_1":
    case "report_generating":
      return 5;
    default: {
      const _exhaustive: never = status;
      return 0;
    }
  }
}

/** Unified response shape for GET status and all mutations. Top-level status only; optional data. Matches backend exactly. Backend sends report_text, not report. */
export interface HomeworkResponse {
  status: PublicHomeworkStatus;
  session_id?: string | null;
  warm_up_task?: WarmUpTask | null;
  warm_up_task_text?: string | null;
  task_text?: string | null;
  task_block?: TaskBlockV2 | null;
  final_task?: string | null;
  final_task_text?: string | null;
  report_text?: string | null;
  performance_score_2?: number | null;
  performance_score_end?: number | null;
  questions?: HomeworkQuestion[];
  tutor_feedback_deadline?: string | null;
  tutor_feedback_message?: string | null;
  /** Message from coach to the student for this homework (e.g. after assignment). Shown on flow when set; no video. Backend may send as tutor_video_description. */
  tutor_video_description?: string | null;
  /** When has_active_session === false: exercises assigned to this student. Shown on step 0 below Start homework. */
  assigned_exercises?: AssignedExercise[];
  session?: unknown;
  has_active_session?: boolean;
}

/** Normalize raw API status string to PublicHomeworkStatus. Use when building HomeworkResponse from GET. */
export function toPublicStatus(s: unknown): PublicHomeworkStatus {
  if (typeof s !== "string") return "none";
  const t = s.toLowerCase().trim().replace(/\s+/g, "_");
  const allowed: PublicHomeworkStatus[] = ["none", "recording_1_required", "task_block", "final_task_ready", "post_questions", "completed", "completing_from_recording_1", "report_generating"];
  if (allowed.includes(t as PublicHomeworkStatus)) return t as PublicHomeworkStatus;
  return "none";
}

/** Warm-up task shape returned by GET /session/status and POST /session/start. */
export interface WarmUpTask {
  id: string;
  text: string;
}

// —— Start homework session ——
export interface HomeworkStartResponse {
  session_id: UUID;
  warm_up_task_text?: string;
  /** When present, use this for the warm-up step (same shape as status.warm_up_task). */
  warm_up_task?: WarmUpTask | null;
}

// —— Session status (for resume / step derivation). Backend may return a subset. ——
/** Backend state-machine status (source of truth for step). Use these to derive step on load. */
export type HomeworkSessionStatusBackend =
  | "warm_up"           // step 1: warm-up recording
  | "task_block"        // step 2: metric questions
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
  warm_up_task_text?: string;
  /** Top-level warm-up from GET /session/status (backfilled when snapshot was missing). Use for display; fallback to warm_up_task_text. */
  warm_up_task?: WarmUpTask | null;
  /** When set, user has completed recording_1. */
  recording_1_id?: UUID | null;
  /** When set, user has completed recording_2. */
  recording_2_id?: UUID | null;
  task_text?: string | null;
  task_block?: TaskBlockV2 | null;
  /** Final task for recording_2 (from GET status or session). */
  final_task?: string | { text?: string } | null;
  final_task_text?: string | null;
  report_text?: string | null;
  performance_score_end?: number | null;
  /** Post-recording questions for step 4 (if any). */
  questions?: HomeworkQuestion[];
  /** Backend: no active session; clear state and require POST start. */
  has_active_session?: boolean;
  /** Backend: alternative to status (e.g. top-level session_state). */
  session_state?: string;
  /** Backend: nested session (snake_case). Use for id, status, warm_up_task_text, final_task_text, context_long, performance_score_end, tutor_video_description. */
  session?: {
    id?: string;
    status?: string;
    state?: string;
    warm_up_task_text?: string;
    warm_up_task?: WarmUpTask | null;
    final_task_text?: string | null;
    context_long?: string | null;
    performance_score_end?: number | null;
    session_metric_question_1?: MetricQuestionItemV2 | string | null;
    session_metric_question_2?: MetricQuestionItemV2 | string | null;
    session_metric_question_3?: MetricQuestionItemV2 | string | null;
    tutor_video_description?: string | null;
  };
  /** Backend: metric questions when task_block not present (top-level snake_case). */
  session_metric_question_1?: MetricQuestionItemV2 | string | null;
  session_metric_question_2?: MetricQuestionItemV2 | string | null;
  session_metric_question_3?: MetricQuestionItemV2 | string | null;
  /** When no active session: deadline (ISO 8601 UTC) for tutor to send feedback and new homework. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
  /** When no active session: optional message from tutor (e.g. warning to wait for feedback). Show as info banner on step 0. */
  tutor_feedback_message?: string | null;
  /** Message from coach for this homework (e.g. after assignment). Backend may send as tutor_video_description. */
  tutor_video_description?: string | null;
  /** When has_active_session === false: exercises assigned to this student (e.g. from admin assigned_next_exercise_id). Shown on step 0 below Start homework. */
  assigned_exercises?: AssignedExercise[];
  /** Backend: recording-1 job state. When not "pending", safe to call POST self-rating again to trigger completion. */
  recording_1_processing_status?: string | null;
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
  const q1 = raw.session_metric_question_1 ?? raw.session?.session_metric_question_1;
  const q2 = raw.session_metric_question_2 ?? raw.session?.session_metric_question_2;
  const q3 = raw.session_metric_question_3 ?? raw.session?.session_metric_question_3;
  const task_block =
    raw.task_block ??
    (q1 != null || q2 != null || q3 != null
      ? { metric_question_1: q1 ?? undefined, metric_question_2: q2 ?? undefined, metric_question_3: q3 ?? undefined }
      : null);
  return {
    status,
    session_id: raw.session_id ?? raw.session?.id ?? null,
    warm_up_task: raw.warm_up_task ?? raw.session?.warm_up_task ?? null,
    warm_up_task_text: raw.warm_up_task_text ?? raw.session?.warm_up_task_text ?? null,
    task_text: raw.task_text ?? null,
    task_block,
    final_task: typeof raw.final_task === "string" ? raw.final_task : null,
    final_task_text: raw.final_task_text ?? raw.session?.final_task_text ?? null,
    report_text: raw.report_text ?? raw.session?.context_long ?? null,
    performance_score_2: (raw as { performance_score_2?: number }).performance_score_2 ?? raw.performance_score_end ?? raw.session?.performance_score_end ?? null,
    performance_score_end: raw.performance_score_end ?? raw.session?.performance_score_end ?? null,
    questions: raw.questions ?? undefined,
    tutor_feedback_deadline: raw.tutor_feedback_deadline ?? null,
    tutor_feedback_message: raw.tutor_feedback_message ?? null,
    tutor_video_description: raw.tutor_video_description ?? raw.session?.tutor_video_description ?? null,
    assigned_exercises: Array.isArray(raw.assigned_exercises) ? raw.assigned_exercises : [],
  };
}

// —— Metric question item (id + text, used in task_block) ——
export interface MetricQuestionItemV2 {
  id?: string;
  text: string;
  order_index?: number;
}

// —— Task block (after recording_1): API returns context_short + 3 metric questions only (no focus_task on step 2) ——
export interface TaskBlockV2 {
  context_short?: string;
  metric_question_1?: MetricQuestionItemV2 | string;
  metric_question_2?: MetricQuestionItemV2 | string;
  metric_question_3?: MetricQuestionItemV2 | string;
  /** @deprecated Not returned by API for metrics step; backend uses focus task only when generating final task (step 3). */
  focus_task?: unknown;
}

// —— After recording_1: task text + optional task_block / metric labels for step 2 ——
export interface HomeworkRecording1Response {
  performance_score_1: number;
  task_text: string;
  task_block?: TaskBlockV2;
  metric_question_1_text?: string;
  metric_question_2_text?: string;
  metric_question_3_text?: string;
  metric_question_1?: MetricQuestionItemV2 | string;
  metric_question_2?: MetricQuestionItemV2 | string;
  metric_question_3?: MetricQuestionItemV2 | string;
}

// —— After metric answers: final task for recording_2 ——
export interface MetricAnswersResponseV2 {
  final_task: string;
}

export interface HomeworkMetricAnswersResponse {
  final_task?: string;
  final_task_text?: string;
  /** When true, recording-1 analysis failed and backend used a general focus; see message. */
  recording_1_fallback?: boolean;
  /** Explanation when recording_1_fallback is true (e.g. "Your first recording couldn't be fully analyzed..."). */
  message?: string;
}

// —— After recording_2 ——
export interface HomeworkRecording2Response {
  performance_score_2: number;
}

// —— Post-recording questions (same shape as v2) ——
export interface HomeworkQuestion {
  id: UUID;
  text: string;
  answer_type?: string;
  order_index?: number;
}

export interface HomeworkQuestionsResponse {
  questions: HomeworkQuestion[];
}

// —— Post-answers → report ——
export interface HomeworkPostAnswersResponse {
  report_text: string;
  performance_score_end: number;
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
  scores: { warmup: number; final: number; overall: number };
  final_recording: { id: string | null; audio_url: string | null };
  /** Last 5 sessions' performance (oldest first). When absent, frontend may derive a single point from scores.overall. */
  performance_history?: PerformanceHistoryPoint[];
  /** When completed and deadline in future: ISO 8601 UTC. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
  /** New: optional recording with full transcription and filler words. When present, prefer over legacy transcript/filler_word_count. */
  recording?: ReportRecording | null;
  /** Optional 2-sentence coach insight. Omitted for older sessions or if generation failed. */
  coach_insight?: string | null;
  /** When report is from recording-1 only (e.g. skip from step 2): first recording playback and analysis. */
  recording_1?: { id: string | null; audio_url: string | null };
  /** Transcript of recording 1 (legacy; prefer recording.transcription_text when present). */
  transcript?: string | null;
  /** Filler words count (legacy; prefer recording.filler_words_count when present). */
  filler_word_count?: number | null;
  /** Strength metric label or value (e.g. "7/10" or "Good"). */
  strength_metric?: string | null;
  /** Pace metric label or value (e.g. "Steady"). */
  pace_metric?: string | null;
  /** When report is recording-1 only: performance score for first recording (0–1). Used for progress chart; frontend converts to 0–100. If absent, frontend may use scores.overall. */
  performance_score_1?: number | null;
  /** Main CTA at end of report (e.g. "Send the homework to the coach!"). On tap: go to step 0 and call GET session/status so timer can appear if needed. */
  report_cta?: string | null;
}
