export type UUID = string;
export type ISODateString = string;

export interface ApiError {
  code: string;
  error: string;
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

/** Fresh signed playback URL (BE /v2/recordings/{id}/playback-url). */
export interface GetSignedAudioUrlResponse {
  audio_url: string;
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

/**
 * Snippet-sharing consent surface. One-time global question asked after
 * the user rates their very first snippet (see ChatInterview consent
 * splice). `has_answered` flips true once the user picks Yes/No — the
 * frontend uses it to suppress the prompt on subsequent chats. `opt_in`
 * carries the actual choice (null until answered).
 */
export interface SharingConsentResponse {
  has_answered: boolean;
  opt_in: boolean | null;
}
