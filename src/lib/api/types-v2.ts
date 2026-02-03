/**
 * V2 API types — universal questions, exercise, task, plan, metrics, report.
 */

export type UUID = string;
export type ISODateString = string;

// —— Universal questions (3 fixed) ——
export type UniversalQuestionAnswerType = "slider_0_1" | "scale_1_10" | "binary";

export interface UniversalQuestion {
  id: UUID;
  code: string; // mood | readiness | mode_preference
  text: string;
  answer_type: UniversalQuestionAnswerType;
  position: number;
}

// —— Universal answers: task_score inputs (backend: (c1+c2+c3)/3, 0..1) ——
// Q1 mood: Good=1, Not great=0
// Q2 readiness: 1–10 (backend uses readiness/10 → 0.1..1)
// Q3 mode_preference: 0 = Yes guide me, 1 = No I will choose
export interface UniversalAnswersInput {
  mood: 0 | 1; // 1 = Good, 0 = Not great
  readiness: number; // 1..10
  mode_preference: 0 | 1; // 0 = Yes guide me, 1 = No I will choose
}

// —— Exercise (optional step) ——
export interface ExerciseV2 {
  id: UUID;
  title: string;
  video_url: string;
  description: string;
}

// —— Task (recording prompt) ——
export interface TaskV2 {
  id: UUID;
  title: string;
  prompt_text: string;
}

// —— Intent prompts (per-student overridable labels) ——
export interface IntentPrompts {
  intended_emotion_prompt: string;
  keywords_prompt: string;
}

// —— Post-recording questions (exactly 3 per session) ——
export type PostRecordingQuestionAnswerTypeV2 = "yes_no" | "scale_1_5" | "text";

export interface PostRecordingQuestionV2 {
  id: UUID;
  code: string | null; // e.g. 'emotion_achieved_check'
  text: string;
  answer_type: PostRecordingQuestionAnswerTypeV2;
  order_index: number;
}

// —— Plan snapshot (returned after universal-answers) ——
export interface PlanSnapshotV2 {
  task_score: number;
  exercise: ExerciseV2 | null;
  tasks: TaskV2[]; // 1 if guide-me, 3 if choose
  intent_prompts: IntentPrompts;
  post_questions: PostRecordingQuestionV2[];
}

// —— Session start (v2) ——
export interface SessionStartResponseV2 {
  session_id: UUID;
  status?: string;
  // If resuming, may include partial state
  universal_answers_submitted?: boolean;
  exercise_feedback_submitted?: boolean;
  task_selected?: boolean;
  intent_submitted?: boolean;
  recording_id?: UUID | null;
  post_answers_submitted?: boolean;
}

// —— Session status (v2) ——
export interface SessionStatusResponseV2 {
  has_active_session: boolean;
  session_id: UUID | null;
  status?: string;
  universal_answers_submitted?: boolean;
  exercise_feedback_submitted?: boolean;
  task_selected?: boolean;
  intent_submitted?: boolean;
  recording_id?: UUID | null;
  post_answers_submitted?: boolean;
  created_at?: ISODateString;
}

// —— Universal answers response (includes plan) ——
export interface UniversalAnswersResponseV2 {
  session_id: UUID;
  plan: PlanSnapshotV2;
}

// —— Exercise feedback ——
export interface ExerciseFeedbackRequestV2 {
  exercise_liked: boolean;
}

// —— Select task (choose-mode only) ——
export interface SelectTaskRequestV2 {
  task_id: UUID;
}

// —— Intent ——
export interface IntentRequestV2 {
  intended_emotion: string;
  keywords: [string, string, string];
}

// —— Recording upload (v2): multipart audio, session_id, task_id, duration_seconds ——
export interface UploadRecordingResponseV2 {
  recording_id: UUID;
  status: string;
  post_questions: PostRecordingQuestionV2[];
  performance_metrics?: PerformanceMetricV2[];
  metric_labels_snapshot?: MetricLabelV2[];
}

// —— Metrics (5 fixed codes) ——
export interface MetricLabelV2 {
  code: string;
  left_label: string;
  right_label: string;
}

export interface PerformanceMetricV2 {
  code: string;
  raw_value?: number | string | boolean;
  normalized_score: number; // 0..1
  explanation?: string;
}

// —— Post-answers (v2) ——
export interface PostAnswerInputV2 {
  question_id: UUID;
  answer_text: string;
}

export interface SubmitPostAnswersRequestV2 {
  session_id: UUID;
  recording_id: UUID;
  answers: PostAnswerInputV2[];
}

export interface SubmitPostAnswersResponseV2 {
  session_id: UUID;
  recording_id: UUID;
  report: ReportV2;
  performance_score: number;
  performance_metrics: PerformanceMetricV2[];
  metric_labels_snapshot: MetricLabelV2[];
}

// —— Report ——
export interface ReportV2 {
  id: UUID;
  report_text: string;
  created_at?: ISODateString;
}

// —— ApiError (reuse shape) ——
export interface ApiErrorV2 {
  code: string;
  error: string;
}
