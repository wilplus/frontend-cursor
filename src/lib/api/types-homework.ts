/**
 * Homework flow (V2) — types for warm-up + two recordings flow.
 * Backend may not implement these yet; BFF and client are ready for when it does.
 */

export type UUID = string;

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
  /** Backend: nested session (snake_case). Use for id, status, warm_up_task_text, final_task_text, context_long, performance_score_end. */
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
  };
  /** Backend: metric questions when task_block not present (top-level snake_case). */
  session_metric_question_1?: MetricQuestionItemV2 | string | null;
  session_metric_question_2?: MetricQuestionItemV2 | string | null;
  session_metric_question_3?: MetricQuestionItemV2 | string | null;
  /** When no active session: deadline (ISO 8601 UTC) for tutor to send feedback and new homework. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
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
export interface HomeworkReportResponse {
  report_text: string;
  scores: { warmup: number; final: number; overall: number };
  final_recording: { id: string | null; audio_url: string | null };
  /** Last 5 sessions' performance (oldest first). When absent, frontend may derive a single point from scores.overall. */
  performance_history?: PerformanceHistoryPoint[];
  /** When completed and deadline in future: ISO 8601 UTC. Omitted when past or not applicable. */
  tutor_feedback_deadline?: string | null;
}
