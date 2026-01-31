export type UUID = string;
export type ISODateString = string;

export interface ApiError {
  code: string;
  error: string;
}

export interface PreRecordingQuestion {
  id: UUID;
  question_text: string;
  order_index: number;
  created_at?: ISODateString;
}

// v1 planned-session types
export type Mode = "guided" | "open";
export type ThemeCode =
  | "presence_grounding"
  | "clarity_simplicity"
  | "pacing_rhythm"
  | "energy_conviction"
  | "confidence_comfort"
  | "structure_organization"
  | "story_narrative";
export type PreQuestionType = "scale_1_5" | "binary_yes_no" | "binary_choice" | "text_short";

export interface PreQuestion extends PreRecordingQuestion {
  code: string;
  question_type: PreQuestionType;
}

export interface CommandOption {
  option_id: "A" | "B" | "C";
  intent: string;
  tier: number;
  mode: Mode;
  prompt_text_snapshot: string;
  is_primary: boolean;
}

export type PostQuestionType = "scale" | "binary" | "free_text";
export type PostQuestionSetId = number; // 1-20

export interface PostRecordingQuestion {
  id: UUID;
  question_text: string;
  question_type: PostQuestionType; // "scale" (1-5), "binary" (YES/NO), "free_text"
  question_set_id?: PostQuestionSetId; // Which set this question belongs to (1-20)
  order_index: number; // 0, 1, or 2 (within the set)
  created_at?: ISODateString;
}

export interface PreRecordingAnswerInput {
  question_id: UUID;
  answer_text: string;
}

export interface PostRecordingAnswerInput {
  question_id: UUID;
  answer_text: string; // For scale: "1"-"5", for binary: "YES"/"NO", for free_text: user's text
}

export interface StoredAnswer {
  id: UUID;
  question_id: UUID;
  answer_text: string;
  created_at: ISODateString;
}

export type FillerBreakdown = Record<string, number>;

export interface RecordingMetrics {
  wpm: number;
  filler_count: number;
  filler_breakdown: FillerBreakdown;
  duration_seconds: number;
  pacing_score?: number; // 0.0-1.0 (normalized)
  voice_stability?: number; // 0.0-1.0 (normalized)
  energy_score?: number; // 0.0-1.0 (normalized)
}

export interface RecordingAnalysis {
  report: string | null;
  trend_sentence: string | null;
}

export interface PerformanceScore {
  performance: number; // 0.0 - 1.0 (core performance score)
  final_kpi: number; // 0.0 - 1.0 (performance * mood_multiplier + bonuses, capped at 1.0)
  bonuses: {
    resilience?: number; // 0.0 - 0.05
    awareness?: number; // 0.0 - 0.03
    progress?: number; // 0.0 - 0.05
    streak?: number; // Optional: 0.0 - 0.05
    self_honesty?: number; // Optional: 0.0 - 0.03
  };
  raw_scores: {
    filler_score: number; // 0.0 - 1.0
    pacing_score: number; // 0.0 - 1.0
    voice_stability: number; // 0.0 - 1.0 (NEW)
    energy_score: number; // 0.0 - 1.0 (NEW)
    awareness_score: number; // 0.0 - 1.0 (from post-questions Q1)
  };
  mood_multiplier?: number; // 1.0 for positive, 0.75 for negative
  readiness_score?: number; // 0.0 - 1.0 (normalized from 1-10)
}

// Admin Feedback Types
export interface AdminFeedbackRequest {
  user_id: UUID;
  recording_id?: UUID; // Optional: link feedback to specific recording
  general_notes?: string; // General observations about the user
  custom_instructions?: string; // Custom instructions for AI analysis
  max_words?: number; // Max words for analysis report (default: 120)
  specific_questions?: Array<{
    question_text: string;
    question_type: "pre" | "post";
  }>;
}

export interface AdminFeedbackResponse {
  success: boolean;
  message?: string;
}

export interface UserAdminContext {
  general_notes: string | null;
  custom_instructions: string | null;
  max_words: number;
  specific_questions: Array<{
    id: UUID;
    question_text: string;
    question_type: "pre" | "post";
    created_at: ISODateString;
  }>;
  updated_at: ISODateString | null;
}

export interface RecordingForAdmin {
  recording_id: UUID;
  user_id: UUID;
  user_email?: string;
  session_id: UUID;
  transcription_text: string | null;
  analysis_report: string | null;
  metrics: RecordingMetrics;
  created_at: ISODateString;
  has_feedback: boolean; // Whether admin has provided feedback for this user
}

export interface AdminRecordingsListResponse {
  recordings: RecordingForAdmin[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionStatusResponse {
  has_active_session: boolean;
  session_id: UUID | null;

  pre_questions_completed: boolean;
  recording_completed: boolean;
  post_questions_completed: boolean;

  recording_id: UUID | null;

  created_at?: ISODateString;
  completed_at?: ISODateString | null;
  abandoned_at?: ISODateString | null;
}

export interface PreRecordingQuestionnaireInput {
  mood: "positive" | "negative"; // 🙂 or 🙁
  readiness: number; // 1-10 (body and mind readiness)
  inspiration_needed: boolean; // Maps to structure: true="guided", false="open"
  theme_code?: ThemeCode;
  mode?: Mode;
}

export interface SessionStartRequest {
  session_id?: UUID; // Resume: return same plan idempotently
  questionnaire?: PreRecordingQuestionnaireInput;
}

export interface SessionStartResponse {
  session_id: UUID;
  cursor?: number;
  mode?: Mode;
  structure?: Mode; // rollout compat
  theme_recommended_code?: ThemeCode;
  theme_recommended_reason?: string;
  theme_chosen_code: ThemeCode;
  theme_chosen_source: "system" | "user" | "admin";
  pre_questions: PreQuestion[]; // v1: length 1
  command_options: CommandOption[]; // v1: length 3
}

export interface SubmitPreAnswersRequest {
  session_id: UUID;
  answers: PreRecordingAnswerInput[];
}

export interface SubmitPreAnswersResponse {
  session_id: UUID;
  pre_questions_completed: true;
}

export interface UploadRecordingResponse {
  recording_id: UUID;
  status: "recording_uploaded";
  post_questions: PostRecordingQuestion[];
}

export interface SubmitPostAnswersRequest {
  recording_id: UUID;
  session_id: UUID;
  answers: PostRecordingAnswerInput[];
}

export interface SubmitPostAnswersResponse {
  recording_id: UUID;
  session_id: UUID;
  post_questions_completed: true;
  performance_score?: PerformanceScore; // Optional: calculated after submission
}

export interface GetRecordingResponse {
  recording_id: UUID;
  session_id: UUID;
  status: string;

  transcription_text: string | null;

  metrics: RecordingMetrics;
  analysis: RecordingAnalysis;
  performance_score?: PerformanceScore; // Optional: calculated after post-questions submitted

  answers: {
    pre: StoredAnswer[];
    post: StoredAnswer[];
  };

  created_at?: ISODateString;
}

export interface GetSignedAudioUrlResponse {
  signed_url: string;
  expires_in: number;
}

export interface RecordingListItemLite {
  id: UUID;
  created_at: ISODateString;
  duration: number;
}

export interface ListRecordingsResponse {
  items: RecordingListItemLite[];
  limit: number;
  offset: number;
  total?: number;
}

export interface UserIdentity {
  id: UUID;
  email: string;
}

export interface UserProfileResponse {
  user: UserIdentity;
  summary: {
    total_recordings: number;
    average_wpm?: number | null;
    average_filler_count?: number | null;
  };
  latest_recordings: RecordingListItemLite[];
}

