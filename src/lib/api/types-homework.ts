/**
 * Homework flow (V2) — types for warm-up + two recordings flow.
 * Backend may not implement these yet; BFF and client are ready for when it does.
 */

export type UUID = string;

// —— Start homework session ——
export interface HomeworkStartResponse {
  session_id: UUID;
  warm_up_task_text: string;
}

// —— After recording_1: task text + optional metric labels for step 2 ——
export interface HomeworkRecording1Response {
  performance_score_1: number;
  task_text: string;
  metric_question_1_text?: string;
  metric_question_2_text?: string;
  metric_question_1?: string;
  metric_question_2?: string;
}

// —— After metric answers: final task for recording_2 ——
export interface HomeworkMetricAnswersResponse {
  final_task_text: string;
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
