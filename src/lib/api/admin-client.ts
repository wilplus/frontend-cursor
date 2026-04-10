/**
 * Admin API client — calls Next.js BFF /api/admin/* (proxied to backend /v2/admin/*).
 * Use only in admin pages; BFF must send admin token.
 */

const getBase = () => (typeof window === "undefined" ? "" : "");

type AdminFetchOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

export type AdminApiError = Error & {
  status?: number;
  code?: string;
  error?: string;
  recording_1_processing_error_code?: string;
};

async function adminFetch<T>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const url = `${getBase()}/api/admin${path}`;
  const bodySerialized: BodyInit | null =
    body == null ? null : body instanceof FormData ? body : JSON.stringify(body);
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {
      ...(typeof headers === "object" && headers !== null ? headers : {}),
      ...(bodySerialized != null && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(bodySerialized != null && { body: bodySerialized }),
  };
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      code?: string;
      details?: string;
      recording_1_processing_error_code?: string;
    };
    const msg =
      err.error || err.message || err.code || err.details || `HTTP ${res.status} for ${path}`;
    const apiError = new Error(msg) as AdminApiError;
    apiError.status = res.status;
    if (err.code) apiError.code = err.code;
    if (err.error) apiError.error = err.error;
    if (err.recording_1_processing_error_code) {
      apiError.recording_1_processing_error_code = err.recording_1_processing_error_code;
    }
    throw apiError;
  }
  return res.json() as Promise<T>;
}

/** Single metric row values returned inside `measured_metrics.latest` (backend may add keys freely). */
export type MeasuredMetricsLatest = Record<string, string | number | boolean | null | undefined>;

/**
 * Top-level `measured_metrics` on GET /v2/admin/students/:id.
 * Backend shape may evolve; `latest` is the primary grid source when present.
 */
export interface MeasuredMetricsPayload {
  latest?: MeasuredMetricsLatest | null;
  measured_at?: string | null;
  updated_at?: string | null;
  source?: string | null;
  [key: string]: unknown;
}

export interface StudentListItem {
  user_id: string;
  /** When present, shown as primary label on the students list */
  email?: string | null;
  user_email?: string | null;
  name?: string | null;
  price_per_live_lesson?: number | null;
  sessions_count?: number;
  last_session_at?: string | null;
  avg_performance?: number | null;
}

export interface StudentProfile {
  user_id: string;
  email: string | null;
  name?: string | null;
  price_per_live_lesson?: number | null;
  credits?: number | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  /** Measured speech / session parameters (pass-through from GET student; render in admin UI). */
  measured_metrics?: MeasuredMetricsPayload | null;
  sniper_profile?: StudentSniperProgress | null;
  coaching_memory?: {
    last_5_scores?: number[] | null;
    recent_focus_task_ids?: string[] | null;
    updated_at?: string | null;
  } | null;
  last_report_delivered?: boolean | null;
  overrides: {
    show_exercise_step?: boolean;
    intended_emotion_prompt?: string;
    keywords_prompt?: string;
    emotion_check_question_text?: string;
    assigned_post_question_ids?: string[];
    assigned_exercise_ids?: string[];
    assigned_next_exercise_id?: string;
    assigned_next_task_ids?: string[];
    assigned_realtime_level?: number | null;
    assigned_realtime_step?: number | null;
    /** When true, student skips step 2 prompts. Backend must transition recording_1 → final_task_ready. */
    skip_metric_questions?: boolean;
    /** When true, student skips step 3 (report). Backend must transition recording_2 → completed. */
    skip_post_questions?: boolean;
  } | null;
  speaker_profile: {
    main_goal?: string;
    motivation?: string;
    strong_points?: string;
    weak_points?: string;
    charismatic_traits?: string;
    hobbies_interests?: string;
    personality_type?: string;
    coach_notes?: string;
  } | null;
  similar_students_by_wpm?: Array<{
    user_id: string;
    email: string;
    name?: string | null;
    wpm: number;
    session_id?: string;
  }>;
  sessions: Array<{
    id: string;
    created_at: string;
    completed_at?: string | null;
    status: string;
    recording_id?: string;
    report_id?: string;
    report_delivered?: boolean | null;
    student_completion_email_sent_at?: string | null;
    task_score?: number | null;
    /** Report grade 1–10 or null (not graded). */
    report_grade?: number | null;
    /** Optional short coach message attached to session grade. */
    coach_message?: string | null;
    /** Canonical session score (replaces dropped performance_score_1/2/end). */
    score?: number | null;
    question_1_score?: number | null;
    question_2_score?: number | null;
    question_3_score?: number | null;
    realtime_level_at_session?: number | null;
    realtime_step_at_session?: number | null;
    recording_preview?: {
      performance_score_v2?: number;
      transcription_preview?: string;
      words_per_minute?: number | null;
      /** Some backends send pace as `wpm` on preview. */
      wpm?: number | null;
      filler_words_count?: { total?: number; breakdown?: Record<string, number> } | null;
      performance_metrics_v2?: Record<string, unknown> | null;
      duration_ms?: number | null;
    };
    /** Top-level WPM when not nested (backend-dependent). */
    words_per_minute?: number | null;
    wpm?: number | null;
    performance_metrics_v2?: Record<string, unknown> | null;
    sniper_metrics?: {
      wpm?: number | null;
      pause_ms?: number | null;
      dynamic_db?: number | null;
      emphasis_per_min?: number | null;
      energy_ratio?: number | null;
      voiced_duration_sec?: number | null;
      pitch_center_st?: number | null;
      pitch_frame_count?: number | null;
      stage_score?: number | null;
      student_rating_1_10?: number | null;
    } | null;
    review?: {
      overall_quality?: string | null;
      confidence_score?: number | null;
      coach_style_score?: number | null;
    } | null;
    /** Full report text (backend returns full, not truncated). */
    report_preview?: { report_text_preview?: string };
  }>;
}

export interface StudentSniperProgress {
  user_id: string;
  realtime_level?: number | null;
  realtime_step?: number | null;
  sessions_with_pitch_count?: number | null;
  realtime_pitch_baseline_st?: number | null;
  session_count?: number | null;
  sessions_with_energy_count?: number | null;
  baseline_wpm?: number | null;
  baseline_pause_ms?: number | null;
  baseline_dynamic_db?: number | null;
  baseline_emphasis_per_min?: number | null;
  baseline_energy_ratio?: number | null;
  baseline_fatigue_sec?: number | null;
  updated_at?: string | null;
}

export interface SendAssignmentResponse {
  status: string;
  sent?: boolean | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  sniper_profile?: StudentSniperProgress | null;
  additional_sends?: Array<{ user_id: string; status: string; email?: string }>;
}

export function getStudentSniperProgressFromProfile(
  profile: StudentProfile | null | undefined
): StudentSniperProgress | null {
  if (!profile) return null;

  const nestedProfile = profile.sniper_profile;
  const realtimeLevel = nestedProfile?.realtime_level ?? profile.realtime_level ?? null;
  const realtimeStep = nestedProfile?.realtime_step ?? profile.realtime_step ?? null;
  const sessionsWithPitchCount = nestedProfile?.sessions_with_pitch_count ?? null;
  const realtimePitchBaselineSt = nestedProfile?.realtime_pitch_baseline_st ?? null;
  const updatedAt = nestedProfile?.updated_at ?? null;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    sessionsWithPitchCount == null &&
    realtimePitchBaselineSt == null &&
    updatedAt == null
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? profile.user_id,
    realtime_level: realtimeLevel,
    realtime_step: realtimeStep,
    sessions_with_pitch_count: sessionsWithPitchCount,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    updated_at: updatedAt,
  };
}

/** Recording with transcription and filler words (optional; aligns with homework report). */
export interface AdminReportRecording {
  transcription_text?: string | null;
  filler_words_count?: { total: number; breakdown?: Record<string, number> };
  audio_url?: string | null;
  words_per_minute?: number | null;
  wpm?: number | null;
}

/** Full report for a completed session (admin modal). Aligns with homework report; extra fields optional. */
export interface AdminSessionReportResponse {
  report_text: string;
  scores?: { warmup?: number; final?: number; overall?: number };
  score_for_display?: number;
  final_recording: { id: string | null; audio_url: string | null };
  recording?: AdminReportRecording | null;
  transcript?: string | null;
  filler_word_count?: number | null;
  strength_metric?: string | null;
  pace_metric?: string | null;
  coach_insight?: string | null;
  /** Speaking rate when backend exposes it on the report (words per minute). */
  words_per_minute?: number | null;
  wpm?: number | null;
  performance_metrics_v2?: Record<string, unknown> | null;
  performance_history?: Array<{ date: string; score: number }>;
  /** Report grade 1–10 or null (not graded). */
  report_grade?: number | null;
  /** Optional coach message attached to the session grade. */
  coach_message?: string | null;
}

export interface RecordingReview {
  id: string;
  session_id?: string | null;
  recording_id?: string | null;
  reviewer_id: string;
  overall_quality: "good" | "bad" | "unclear";
  confidence_score: number;
  coach_style_score: number;
  notes?: string | null;
  rubric_version: string;
  created_at: string;
  updated_at: string;
}

export interface AdminRecordingImportResponse {
  status: string;
  recording_id: string;
  review_id?: string | null;
  playback_url?: string | null;
  message?: string | null;
}

export interface AdminImportedRecordingSourceMetadata {
  source_kind?: string | null;
  source_url?: string | null;
  source_title?: string | null;
  speaker_label?: string | null;
  language_code?: string | null;
  transcript_text?: string | null;
  import_notes?: string | null;
  recording_origin?: string | null;
  [key: string]: unknown;
}

export interface AdminImportedRecording {
  recording_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  processing_status?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  duration_ms?: number | null;
  source_metadata: AdminImportedRecordingSourceMetadata;
  latest_review: RecordingReview | null;
  playback_url?: string | null;
}

export interface AdminRecordingImportsResponse {
  recordings: AdminImportedRecording[];
  total: number;
  limit: number;
  offset: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Per-student tasks list: backend may use `tasks` after DB rename or legacy keys. */
function pickStudentTasksArray(r: Record<string, unknown>): StudentTask[] {
  for (const key of ["tasks", "task_warm_up", "warm_up_tasks"] as const) {
    const v = r[key];
    if (Array.isArray(v)) return v as StudentTask[];
  }
  return [];
}

/** Global task pool list: `tasks_pool` (new) or `task_warm_up_pool` (legacy). */
function pickTasksPoolArray(r: Record<string, unknown>): TasksPoolItem[] {
  for (const key of ["tasks_pool", "task_warm_up_pool", "tasks", "items"] as const) {
    const v = r[key];
    if (Array.isArray(v)) {
      return v
        .map((item) => normalizeTasksPoolItem(item))
        .filter((item): item is TasksPoolItem => item != null);
    }
  }
  return [];
}

function pickSingleStudentTaskEntity(r: Record<string, unknown>): StudentTask | null {
  for (const key of ["task", "task_warm_up", "tasks"] as const) {
    const v = r[key];
    if (v != null && typeof v === "object" && !Array.isArray(v)) return v as StudentTask;
  }
  return null;
}

/** Single pool row from POST/PUT pool or create-pool-and-assign. Contract: `tasks_pool` object (see API-POOL-CONTRACT). */
function pickSinglePoolTaskEntity(r: Record<string, unknown>): TasksPoolItem | null {
  const tp = r.tasks_pool;
  if (tp != null && typeof tp === "object") {
    if (!Array.isArray(tp)) {
      const row = normalizeTasksPoolItem(tp);
      if (row) return row;
    } else if (tp.length > 0) {
      const row = normalizeTasksPoolItem(tp[0]);
      if (row) return row;
    }
  }
  for (const key of ["tasks_pool_item", "task", "task_warm_up"] as const) {
    const v = r[key];
    if (v != null && typeof v === "object" && !Array.isArray(v)) return normalizeTasksPoolItem(v);
  }
  return null;
}

function normalizeTasksPoolItem(value: unknown): TasksPoolItem | null {
  const record = asRecord(value);
  const id = asTrimmedString(record?.id);
  const text =
    asTrimmedString(record?.text) ??
    asTrimmedString(record?.prompt_text) ??
    asTrimmedString(record?.promptText) ??
    asTrimmedString(record?.title) ??
    asTrimmedString(record?.task);
  if (!id || !text) return null;
  const targetProfile =
    asTrimmedString(record?.target_profile) ??
    asTrimmedString(record?.targetProfile);
  const level = asNumber(record?.level);
  const step =
    asNumber(record?.step_in_level) ??
    asNumber(record?.stepInLevel) ??
    asNumber(record?.target_stage);
  return {
    id,
    text,
    order_index: asNumber(record?.order_index) ?? asNumber(record?.orderIndex) ?? undefined,
    max_performance_score:
      asNumber(record?.max_performance_score) ?? asNumber(record?.maxPerformanceScore) ?? undefined,
    target_profile:
      targetProfile === "The Overwhelmed" ||
      targetProfile === "The Stressor" ||
      targetProfile === "The Drifter" ||
      targetProfile === "The Master"
        ? targetProfile
        : null,
    level: level ?? null,
    step_in_level: step ?? null,
    is_active: typeof record?.is_active === "boolean" ? record.is_active : true,
    replaces_task_id:
      asTrimmedString(record?.replaces_task_id) ??
      asTrimmedString(record?.replacesTaskId),
    created_at:
      asTrimmedString(record?.created_at) ??
      asTrimmedString(record?.createdAt) ??
      undefined,
  };
}

function normalizeReview(value: unknown): RecordingReview | null {
  const record = asRecord(value);
  const id = asTrimmedString(record?.id);
  const reviewerId = asTrimmedString(record?.reviewer_id);
  const overallQuality = record?.overall_quality;
  const confidenceScore = asNumber(record?.confidence_score);
  const coachStyleScore = asNumber(record?.coach_style_score);
  const rubricVersion = asTrimmedString(record?.rubric_version);
  const createdAt = asTrimmedString(record?.created_at);
  const updatedAt = asTrimmedString(record?.updated_at);
  if (
    !id ||
    !reviewerId ||
    (overallQuality !== "good" && overallQuality !== "bad" && overallQuality !== "unclear") ||
    confidenceScore == null ||
    coachStyleScore == null ||
    !rubricVersion ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    session_id: asTrimmedString(record?.session_id),
    recording_id: asTrimmedString(record?.recording_id),
    reviewer_id: reviewerId,
    overall_quality: overallQuality,
    confidence_score: confidenceScore,
    coach_style_score: coachStyleScore,
    notes: asTrimmedString(record?.notes),
    rubric_version: rubricVersion,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeSourceMetadata(value: unknown): AdminImportedRecordingSourceMetadata {
  const record = asRecord(value);
  if (!record) return {};
  return {
    ...record,
    source_kind: asTrimmedString(record.source_kind),
    source_url: asTrimmedString(record.source_url),
    source_title: asTrimmedString(record.source_title),
    speaker_label: asTrimmedString(record.speaker_label),
    language_code: asTrimmedString(record.language_code),
    transcript_text: asTrimmedString(record.transcript_text),
    import_notes: asTrimmedString(record.import_notes),
    recording_origin: asTrimmedString(record.recording_origin),
  };
}

function normalizeImportedRecording(value: unknown): AdminImportedRecording | null {
  const record = asRecord(value);
  const recordingId = asTrimmedString(record?.recording_id) ?? asTrimmedString(record?.id);
  if (!record || !recordingId) return null;

  const sourceMetadata = normalizeSourceMetadata(record.source_metadata);
  return {
    recording_id: recordingId,
    created_at: asTrimmedString(record.created_at),
    updated_at: asTrimmedString(record.updated_at),
    user_id: asTrimmedString(record.user_id),
    session_id: asTrimmedString(record.session_id),
    processing_status: asTrimmedString(record.processing_status),
    original_filename: asTrimmedString(record.original_filename),
    mime_type: asTrimmedString(record.mime_type),
    file_size_bytes: asNumber(record.file_size_bytes),
    duration_ms: asNumber(record.duration_ms),
    source_metadata: {
      source_kind: sourceMetadata.source_kind ?? asTrimmedString(record.source_kind),
      source_url: sourceMetadata.source_url ?? asTrimmedString(record.source_url),
      source_title: sourceMetadata.source_title ?? asTrimmedString(record.source_title),
      speaker_label: sourceMetadata.speaker_label ?? asTrimmedString(record.speaker_label),
      language_code: sourceMetadata.language_code ?? asTrimmedString(record.language_code),
      transcript_text: sourceMetadata.transcript_text ?? asTrimmedString(record.transcript_text),
      import_notes: sourceMetadata.import_notes ?? asTrimmedString(record.import_notes),
      recording_origin:
        sourceMetadata.recording_origin ?? asTrimmedString(record.recording_origin),
      ...sourceMetadata,
    },
    latest_review: normalizeReview(record.latest_review ?? record.review ?? record.latestReview),
    playback_url:
      asTrimmedString(record.playback_url) ??
      asTrimmedString(record.signed_playback_url) ??
      asTrimmedString(record.audio_url),
  };
}

function normalizeImportedRecordingDetail(value: unknown): AdminImportedRecording {
  const outer = asRecord(value);
  const nested = asRecord(outer?.recording);
  const normalized =
    normalizeImportedRecording(nested ?? outer) ??
    (() => {
      throw new Error("Invalid recording detail response");
    })();

  if (!outer) return normalized;
  return {
    ...normalized,
    latest_review:
      normalized.latest_review ??
      normalizeReview(outer.latest_review ?? outer.review ?? outer.latestReview),
    playback_url:
      normalized.playback_url ??
      asTrimmedString(outer.playback_url) ??
      asTrimmedString(outer.signed_playback_url) ??
      asTrimmedString(outer.audio_url),
  };
}

export interface Task {
  id: string;
  title: string;
  prompt_text?: string | null;
  min_task_score?: number;
  max_task_score?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface PostQuestion {
  id: string;
  code?: string | null;
  text: string;
  answer_type: string;
  is_active?: boolean;
  order_index?: number;
}

export interface MetricLabel {
  code: string;
  left_label: string;
  right_label: string;
}

/** Per-student task row (`tasks` table; BFF /api/admin/students/:id/tasks). */
export interface StudentTask {
  id: string;
  user_id: string;
  text: string;
  order_index?: number;
  /** 0–1; used to select a task by the student's last score. */
  max_performance_score?: number;
  /** When assigned from pool, references tasks_pool.id. */
  pool_task_id?: string | null;
  created_at?: string;
}

/** Global tasks pool row (`tasks_pool` table; BFF /api/admin/tasks-pool). */
export interface TasksPoolItem {
  id: string;
  text: string;
  order_index?: number;
  max_performance_score?: number;
  target_profile?: "The Overwhelmed" | "The Stressor" | "The Drifter" | "The Master" | null;
  level?: number | null;
  step_in_level?: number | null;
  is_active?: boolean;
  replaces_task_id?: string | null;
  created_at?: string;
}

export interface TasksPoolItemUpsertPayload {
  text: string;
  order_index?: number;
  max_performance_score?: number;
  target_profile?: "The Overwhelmed" | "The Stressor" | "The Drifter" | "The Master" | null;
  level?: number | null;
  step_in_level?: number | null;
  is_active?: boolean;
  replaces_task_id?: string | null;
}

/** Focus task (per student); when assigned from pool, has pool_task_id. */
export interface FocusTask {
  id: string;
  user_id: string;
  text: string;
  order_index?: number;
  max_performance_score?: number;
  pool_task_id?: string | null;
  created_at?: string;
}

/** Global focus task pool item (no user_id). */
export interface FocusTaskPoolItem {
  id: string;
  text: string;
  order_index?: number;
  max_performance_score?: number;
  created_at?: string;
}

/** Metric question (position 1, 2, or 3); used in task text for future homework flow. */
export interface MetricQuestion {
  id: string;
  position: 1 | 2 | 3;
  text: string;
  created_at?: string;
}

export interface CoachSuggestionResponse {
  status: string;
  homework_message: string;
  task_suggestion: string;
  video_script: string;
  raw_text: string;
}

export interface CoachSuggestionHistory {
  status: string;
  user_id: string;
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
  updated_at: string | null;
}

export type CopilotDraftStatus = "Draft" | "Ready" | "Sent";

export interface CopilotCohortStack {
  id: string;
  profile_bucket: string;
  stage_key: string;
  pending_count: number;
  metadata?: Record<string, unknown> | null;
}

export interface CopilotStudentQueueItem {
  student_id: string;
  session_id?: string | null;
  queue_position?: number;
  state: CopilotDraftStatus;
  updated_at?: string | null;
  completed_at?: string | null;
  draft_count?: number;
  ready_count?: number;
  sent_count?: number;
  profile?: {
    name?: string | null;
    email?: string | null;
    stage?: string | null;
    justification?: string | null;
    behavioral_profile?: string | null;
    behavioral_profile_justification?: string | null;
    session_count?: number | null;
    completed_at?: string | null;
    canonical_score_for_display?: number | null;
  } | null;
}

export interface CopilotStudentDraft {
  id: string;
  student_id: string;
  session_id?: string | null;
  status: CopilotDraftStatus;
  ai_insight?: string | null;
  corrected_insight?: string | null;
  good_as_is?: boolean;
  /** AI baselines (backend pre-fill); current values remain in *\_draft fields. */
  ai_grade_draft?: number | null;
  ai_comment_draft?: string | null;
  ai_email_draft?: string | null;
  ai_task_suggestion?: string | null;
  ai_script_draft?: string | null;
  grade_draft?: number | null;
  comment_draft?: string | null;
  task_draft?: string | null;
  email_draft?: string | null;
  script_draft?: string | null;
  cohort_profile?: string | null;
  cohort_stage?: string | number | null;
  score_for_display?: number | null;
  reason_chip_required?: boolean;
  metadata?: Record<string, unknown> | null;
}

export type DraftGenerationStatus = "pending" | "ready" | "failed" | "not_started";

export interface CopilotStudentDraftsResponse {
  drafts: CopilotStudentDraft[];
  draft_generation_status?: DraftGenerationStatus;
  draft_generation_session_id?: string | null;
}

function pickStrFromRaw(raw: Record<string, unknown>, snake: string, camel: string): string | null {
  const a = raw[snake];
  const b = raw[camel];
  if (typeof a === "string") return a;
  if (typeof b === "string") return b;
  return null;
}

function pickNumFromRaw(raw: Record<string, unknown>, snake: string, camel: string): number | null {
  const a = raw[snake];
  const b = raw[camel];
  if (typeof a === "number" && Number.isFinite(a)) return a;
  if (typeof b === "number" && Number.isFinite(b)) return b;
  return null;
}

function pickStrFromCandidates(
  sources: Array<Record<string, unknown> | null>,
  keys: string[]
): string | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return null;
}

/** Unify snake_case vs camelCase and common payload aliases from backend JSON. */
export function normalizeCopilotStudentDraft(raw: Record<string, unknown>): CopilotStudentDraft {
  const draftPayload =
    raw.draft_payload && typeof raw.draft_payload === "object"
      ? (raw.draft_payload as Record<string, unknown>)
      : null;
  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : draftPayload;
  const textSources: Array<Record<string, unknown> | null> = [raw, draftPayload, metadata];

  return {
    id: String(raw.id ?? raw.draft_id ?? ""),
    student_id: String(raw.student_id ?? raw.user_id ?? ""),
    session_id: pickStrFromRaw(raw, "session_id", "sessionId"),
    status: (typeof raw.status === "string" ? raw.status : "Draft") as CopilotDraftStatus,
    ai_insight: pickStrFromRaw(raw, "ai_insight", "aiInsight"),
    corrected_insight: pickStrFromRaw(raw, "corrected_insight", "correctedInsight"),
    good_as_is:
      typeof raw.good_as_is === "boolean"
        ? raw.good_as_is
        : typeof raw.goodAsIs === "boolean"
          ? raw.goodAsIs
          : undefined,
    ai_grade_draft: pickNumFromRaw(raw, "ai_grade_draft", "aiGradeDraft"),
    ai_comment_draft: pickStrFromCandidates(textSources, [
      "ai_comment_draft",
      "aiCommentDraft",
      "comment_draft_ai",
      "commentDraftAi",
    ]),
    ai_email_draft: pickStrFromCandidates(textSources, [
      "ai_email_draft",
      "aiEmailDraft",
      "homework_message",
      "homeworkMessage",
    ]),
    ai_task_suggestion: pickStrFromCandidates(textSources, [
      "ai_task_suggestion",
      "aiTaskSuggestion",
      "task_suggestion",
      "taskSuggestion",
    ]),
    ai_script_draft: pickStrFromCandidates(textSources, [
      "ai_script_draft",
      "aiScriptDraft",
      "video_script",
      "videoScript",
    ]),
    grade_draft: pickNumFromRaw(raw, "grade_draft", "gradeDraft"),
    comment_draft: pickStrFromRaw(raw, "comment_draft", "commentDraft"),
    task_draft: pickStrFromCandidates(textSources, [
      "task_draft",
      "taskDraft",
      "task_suggestion",
      "taskSuggestion",
    ]),
    email_draft: pickStrFromCandidates(textSources, [
      "email_draft",
      "emailDraft",
      "homework_message",
      "homeworkMessage",
    ]),
    script_draft: pickStrFromCandidates(textSources, [
      "script_draft",
      "scriptDraft",
      "video_script",
      "videoScript",
    ]),
    cohort_profile: pickStrFromRaw(raw, "cohort_profile", "cohortProfile"),
    cohort_stage: (raw.cohort_stage ?? raw.cohortStage ?? null) as string | number | null,
    score_for_display:
      typeof raw.score_for_display === "number"
        ? raw.score_for_display
        : typeof raw.scoreForDisplay === "number"
          ? raw.scoreForDisplay
          : undefined,
    reason_chip_required:
      typeof raw.reason_chip_required === "boolean"
        ? raw.reason_chip_required
        : typeof raw.reasonChipRequired === "boolean"
          ? raw.reasonChipRequired
          : undefined,
    metadata,
  };
}

export interface CopilotAuditPayload {
  session_id?: string | null;
  good_as_is?: boolean;
  corrected_insight?: string | null;
  reason_chips?: Array<{ chip_key: string; custom_reason?: string | null }>;
  reason_chip_custom?: string | null;
}

export interface CopilotDraftPatchPayload {
  session_id?: string | null;
  grade_draft?: number | null;
  comment_draft?: string | null;
  task_draft?: string | null;
  email_draft?: string | null;
  script_draft?: string | null;
  /** Merged/replaced per backend contract; used e.g. for reviewer_score AI feedback. */
  metadata?: Record<string, unknown> | null;
  reason_chips?: Array<{ chip_key: string; custom_reason?: string | null }>;
  reason_chip_custom?: string | null;
}

export interface CopilotSendPayload {
  session_id?: string;
  draft_id?: string;
  idempotency_key?: string;
  /** Optional override for draft video when sending/approve-send. */
  video_url?: string;
}

export interface CopilotSendResponse {
  status: string;
  state?: CopilotDraftStatus;
  sent_at?: string;
  sent?: boolean | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  sniper_profile?: StudentSniperProgress | null;
}

export interface CopilotAnnotationChip {
  chip_key: string;
  label: string;
  description?: string | null;
  is_active?: boolean;
  section?: string | null;
}

export interface AcousticDojoClip {
  clip_id: string;
  source_type: "student" | "external";
  source_metadata?: Record<string, unknown> | null;
  audio_url?: string | null;
  duration_sec?: number | null;
  student_id?: string | null;
  session_id?: string | null;
}

export interface AcousticDojoLabelPayload {
  clip_id: string;
  source_metadata?: Record<string, unknown> | null;
  label_stress: boolean;
  label_charisma: boolean;
  confidence: number;
  labeled_by: string;
}

export interface StressSnippet {
  id: string;
  recording_id?: string | null;
  source_type?: "student" | "internet" | "external" | null;
  audio_url?: string | null;
  snippet_start_ms?: number | null;
  snippet_end_ms?: number | null;
  snippet_duration_ms?: number | null;
  clip_seconds?: number | null;
  transcript_text?: string | null;
  transcript?: string | null;
  coach_label?: "stress" | "no_stress" | null;
  coach_label_notes?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface StressSnippetSettings {
  auto_extract_enabled: boolean;
}

export const adminApi = {
  getCopilotCohorts: (params?: {
    profile_bucket?: string;
    stage_key?: string;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.profile_bucket) search.set("profile_bucket", params.profile_bucket);
    if (params?.stage_key) search.set("stage_key", params.stage_key);
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<Record<string, unknown>>(`/copilot/cohorts${suffix}`).then((res) => {
      const rawCohorts = Array.isArray((res as { cohorts?: unknown[] }).cohorts)
        ? ((res as { cohorts?: unknown[] }).cohorts as Array<Record<string, unknown>>)
        : [];
      const cohorts: CopilotCohortStack[] = rawCohorts.map((cohort) => {
        const profileBucket = String(cohort.profile_bucket ?? cohort.profile ?? "unknown");
        const stageKey = String(cohort.stage_key ?? cohort.stage ?? "unknown");
        return {
          id:
            typeof cohort.id === "string" && cohort.id.trim()
              ? cohort.id
              : `${profileBucket}::${stageKey}`,
          profile_bucket: profileBucket,
          stage_key: stageKey,
          pending_count:
            typeof cohort.pending_count === "number"
              ? cohort.pending_count
              : typeof cohort.draft_count === "number"
                ? cohort.draft_count
                : 0,
          metadata:
            cohort.metadata && typeof cohort.metadata === "object"
              ? (cohort.metadata as Record<string, unknown>)
              : null,
        };
      });
      return { cohorts };
    });
  },

  getCopilotCohortStudents: (cohortId: string, params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{ students: CopilotStudentQueueItem[] }>(
      `/copilot/cohorts/${cohortId}/students${suffix}`
    );
  },

  getCopilotStudentDrafts: (studentId: string, params?: { session_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.session_id) search.set("session_id", params.session_id);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<CopilotStudentDraftsResponse>(
      `/copilot/students/${studentId}/drafts${suffix}`
    ).then((res) => ({
      drafts: (Array.isArray(res.drafts) ? res.drafts : []).map((d) => {
        const record = asRecord(d);
        return record ? normalizeCopilotStudentDraft(record) : d;
      }),
      draft_generation_status:
        typeof res.draft_generation_status === "string"
          ? (res.draft_generation_status as DraftGenerationStatus)
          : undefined,
      draft_generation_session_id:
        typeof res.draft_generation_session_id === "string"
          ? res.draft_generation_session_id
          : res.draft_generation_session_id === null
            ? null
            : undefined,
    }));
  },

  updateCopilotStudentDrafts: (studentId: string, body: CopilotDraftPatchPayload) =>
    adminFetch<{ status: string; draft?: CopilotStudentDraft }>(
      `/copilot/students/${studentId}/drafts`,
      { method: "PUT", body }
    ).then((res) => ({
      ...res,
      draft: (() => {
        const record = asRecord(res.draft);
        return record ? normalizeCopilotStudentDraft(record) : res.draft;
      })(),
    })),

  getCopilotStudentAudit: (studentId: string, params?: { session_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.session_id) search.set("session_id", params.session_id);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{ audit: CopilotStudentDraft | null }>(
      `/copilot/students/${studentId}/audit${suffix}`
    );
  },

  updateCopilotStudentAudit: (studentId: string, body: CopilotAuditPayload) =>
    adminFetch<{ status: string; audit?: CopilotStudentDraft }>(
      `/copilot/students/${studentId}/audit`,
      { method: "PUT", body }
    ),

  approveCopilotStudent: (
    studentId: string,
    body?: CopilotSendPayload
  ) =>
    adminFetch<CopilotSendResponse>(
      `/copilot/students/${studentId}/approve`,
      { method: "POST", body: body ?? {} }
    ),

  sendCopilotStudent: (
    studentId: string,
    body?: CopilotSendPayload
  ) =>
    adminFetch<CopilotSendResponse>(
      `/copilot/students/${studentId}/send`,
      { method: "POST", body: body ?? {} }
    ),

  getCopilotAnnotationChips: () =>
    adminFetch<Record<string, unknown>>("/copilot/annotation-chips").then((res) => {
      const fromChips = Array.isArray((res as { chips?: unknown[] }).chips)
        ? ((res as { chips?: unknown[] }).chips as CopilotAnnotationChip[])
        : null;
      const fromAnnotationChips = Array.isArray((res as { annotation_chips?: unknown[] }).annotation_chips)
        ? ((res as { annotation_chips?: unknown[] }).annotation_chips as CopilotAnnotationChip[])
        : null;
      return {
        chips: fromChips ?? fromAnnotationChips ?? [],
      };
    }),

  patchStudentProfileClassification: (
    userId: string,
    body: {
      behavioral_profile?: string;
      coach_override_profile?: string;
      profile_override_justification?: string | null;
      reason_chip?: string;
      reason_chip_custom?: string | null;
    }
  ) =>
    adminFetch<{ status?: string }>(`/students/${userId}/profile-classification`, {
      method: "PATCH",
      body,
    }),

  createCopilotAnnotationChip: (body: {
    chip_key: string;
    label: string;
    description?: string | null;
    is_active?: boolean;
  }) =>
    adminFetch<{ status: string; chip?: CopilotAnnotationChip }>("/copilot/annotation-chips", {
      method: "POST",
      body,
    }),

  getAcousticDojoNextClips: (params?: { limit?: number; source_type?: "student" | "external" }) => {
    const search = new URLSearchParams();
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (params?.source_type) search.set("source_type", params.source_type);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{ clips: AcousticDojoClip[]; streak?: number; today_count?: number; leaderboard?: Array<{ labeled_by: string; labels_count: number }> }>(
      `/acoustic-dojo/next-clips${suffix}`
    );
  },

  submitAcousticDojoLabel: (body: AcousticDojoLabelPayload) =>
    adminFetch<{ status: string; accepted: boolean; next_clip_id?: string | null }>(
      "/acoustic-dojo/labels",
      { method: "POST", body }
    ),

  listStressSnippets: (params?: {
    source_type?: "student" | "internet" | "external" | "all";
    label_state?: "all" | "labeled" | "unlabeled";
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.source_type && params.source_type !== "all") {
      search.set("source_type", params.source_type);
    }
    if (params?.label_state && params.label_state !== "all") {
      search.set("label_state", params.label_state);
    }
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{
      snippets?: StressSnippet[];
      total?: number;
      limit?: number;
      offset?: number;
    }>(`/stress-snippets${suffix}`).then((res) => ({
      snippets: Array.isArray(res.snippets) ? res.snippets : [],
      total: typeof res.total === "number" ? res.total : 0,
      limit: typeof res.limit === "number" ? res.limit : params?.limit ?? 0,
      offset: typeof res.offset === "number" ? res.offset : params?.offset ?? 0,
    }));
  },

  getStressSnippetSettings: () =>
    adminFetch<{ settings?: StressSnippetSettings; auto_extract_enabled?: boolean }>(
      "/stress-snippets/settings"
    ).then((res) => ({
      auto_extract_enabled:
        typeof res.settings?.auto_extract_enabled === "boolean"
          ? res.settings.auto_extract_enabled
          : Boolean(res.auto_extract_enabled),
    })),

  updateStressSnippetSettings: (autoExtractEnabled: boolean) =>
    adminFetch<{ settings?: StressSnippetSettings; auto_extract_enabled?: boolean }>(
      "/stress-snippets/settings",
      { method: "PUT", body: { auto_extract_enabled: autoExtractEnabled } }
    ).then((res) => ({
      settings: {
        auto_extract_enabled:
          typeof res.settings?.auto_extract_enabled === "boolean"
            ? res.settings.auto_extract_enabled
            : Boolean(res.auto_extract_enabled),
      },
    })),

  generateStressSnippets: (
    recordingId: string,
    body?: { max_snippets?: number; clip_seconds?: number; clear_existing?: boolean }
  ) =>
    adminFetch<{
      generated_count: number;
      status?: string;
      snippets?: StressSnippet[];
    }>(`/recordings/${recordingId}/stress-snippets/generate`, { method: "POST", body: body ?? {} }),

  labelStressSnippet: (
    snippetId: string,
    body: { label: "stress" | "no_stress"; notes?: string | null }
  ) =>
    adminFetch<{ status?: string; snippet?: StressSnippet }>(`/stress-snippets/${snippetId}/label`, {
      method: "PATCH",
      body,
    }),

  exportDpoData: (params?: { from?: string; to?: string; format?: "json" | "csv" }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.format) search.set("format", params.format);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{
      rows: Array<{
        draft_id: string;
        student_id: string;
        session_id?: string | null;
        rejected_ai_text?: string | null;
        chosen_coach_text?: string | null;
        reason_chip_keys?: string[] | null;
        context_metadata?: Record<string, unknown> | null;
      }>;
    }>(`/dpo/export${suffix}`);
  },

  getStudents: (params?: { limit?: number; offset?: number }) =>
    adminFetch<{ students: StudentListItem[]; limit?: number; offset?: number }>(
      `/students?${new URLSearchParams((params ?? {}) as Record<string, string>).toString()}`
    ),

  getStudentProfile: (userId: string) =>
    adminFetch<StudentProfile>(`/students/${userId}`),

  getStudentSniperProgress: (userId: string) =>
    adminFetch<{ profile: StudentSniperProgress | null }>(`/students/${userId}/sniper-profile`).then(
      (r) => r.profile ?? null
    ),

  putStudentSniperProgress: (
    userId: string,
    body: { realtime_level?: number | null; realtime_step?: number | null }
  ) =>
    adminFetch<{ profile: StudentSniperProgress | null }>(`/students/${userId}/sniper-profile`, {
      method: "PUT",
      body,
    }).then((r) => r.profile ?? null),

  patchStudent: (
    userId: string,
    body: { name?: string | null; price_per_live_lesson?: number | null; credits?: number | null }
  ) => adminFetch<{ status?: string }>(`/students/${userId}`, { method: "PATCH", body }),

  deleteStudent: (userId: string) =>
    adminFetch<{ status?: string }>(`/students/${userId}`, { method: "DELETE" }),

  /** Full report for a student's completed session (for admin report modal). */
  getStudentSessionReport: (userId: string, sessionId: string) =>
    adminFetch<AdminSessionReportResponse>(
      `/students/${userId}/sessions/${sessionId}/report`
    ),

  /** Playback URL for a recording (admin). Use when report modal has recording_id but no audio_url. */
  getRecordingPlaybackUrl: (recordingId: string) =>
    adminFetch<{ audio_url: string }>(`/recordings/${recordingId}/playback-url`),

  /** Import an external recording and create its initial ML label set. */
  importRecording: (formData: FormData) =>
    adminFetch<AdminRecordingImportResponse>("/recordings/import", {
      method: "POST",
      body: formData,
    }),

  uploadExternalRecording: (formData: FormData) =>
    adminFetch<{
      status: string;
      recording_id: string;
      review_id?: string;
      playback_url?: string;
      generated_snippets_count?: number;
      message?: string;
    }>("/recordings/import", { method: "POST", body: formData }),

  getRecordingImports: (params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<unknown>(`/recordings/imports${suffix}`).then((raw) => {
      const record = asRecord(raw);
      const items = Array.isArray(record?.recordings)
        ? record.recordings
        : Array.isArray(record?.imports)
          ? record.imports
          : Array.isArray(record?.items)
            ? record.items
            : [];
      return {
        recordings: items
          .map((item) => normalizeImportedRecording(item))
          .filter((item): item is AdminImportedRecording => item != null),
        total: asNumber(record?.total) ?? asNumber(record?.count) ?? items.length,
        limit: asNumber(record?.limit) ?? params?.limit ?? items.length,
        offset: asNumber(record?.offset) ?? params?.offset ?? 0,
      } satisfies AdminRecordingImportsResponse;
    });
  },

  getRecordingImportDetail: (recordingId: string) =>
    adminFetch<unknown>(`/recordings/${recordingId}`).then((raw) =>
      normalizeImportedRecordingDetail(raw)
    ),

  patchRecordingReview: (
    recordingId: string,
    body: {
      overall_quality: RecordingReview["overall_quality"];
      confidence_score: number;
      coach_style_score: number;
      notes?: string | null;
      rubric_version: string;
    }
  ) =>
    adminFetch<unknown>(`/recordings/${recordingId}/review`, { method: "PATCH", body }).then(
      (raw) => {
        const record = asRecord(raw);
        const review =
          normalizeReview(record?.review ?? record?.latest_review ?? record) ??
          (() => {
            throw new Error("Invalid review response");
          })();
        return {
          status: asTrimmedString(record?.status) ?? "ok",
          review,
        };
      }
    ),

  /** PATCH session: set or clear report_grade (1–10 or null). Proxies to PATCH /v2/admin/students/:id/sessions/:sessionId. */
  patchSession: (
    userId: string,
    sessionId: string,
    body: { report_grade: number | null; coach_message?: string | null }
  ) =>
    adminFetch<{ status: string; report_grade?: number | null; coach_message?: string | null }>(
      `/students/${userId}/sessions/${sessionId}`,
      { method: "PATCH", body }
    ),

  /** Internal ML review labels stored in Supabase; separate from student-facing coach feedback. */
  getSessionReview: (userId: string, sessionId: string) =>
    adminFetch<{ review: RecordingReview | null }>(
      `/students/${userId}/sessions/${sessionId}/review`
    ),

  /** Save or update internal ML review labels for a session. */
  patchSessionReview: (
    userId: string,
    sessionId: string,
    body: {
      recording_id?: string | null;
      overall_quality: RecordingReview["overall_quality"];
      confidence_score: number;
      coach_style_score: number;
      notes?: string | null;
      rubric_version?: string;
    }
  ) =>
    adminFetch<{ status: string; review: RecordingReview }>(
      `/students/${userId}/sessions/${sessionId}/review`,
      { method: "PATCH", body }
    ),

  putOverrides: (userId: string, data: Record<string, unknown>) =>
    adminFetch<{ status: string }>(`/students/${userId}/overrides`, { method: "PUT", body: data }),

  putSpeakerProfile: (userId: string, data: Record<string, unknown>) =>
    adminFetch<{ status: string }>(`/students/${userId}/speaker-profile`, { method: "PUT", body: data }),

  /** Optional body: { video_url?, video_description?, additional_user_ids? }. Triggers student homework (send-homework). */
  sendAssignment: (userId: string, body?: { video_url?: string; video_description?: string; additional_user_ids?: string[] }) =>
    adminFetch<SendAssignmentResponse>(`/students/${userId}/send-assignment`, {
      method: "POST",
      ...(body && Object.keys(body).length > 0 ? { body } : {}),
    }),

  getStudentTasks: (userId: string) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks`).then((r) => pickStudentTasksArray(r)),

  /** Sync student's tasks from pool. Body: { pool_task_ids: string[] }. */
  putStudentTasksSync: (userId: string, body: { pool_task_ids: string[] }) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks`, { method: "PUT", body }).then(
      (r) => ({ ...r, tasks: pickStudentTasksArray(r) }) as { tasks: StudentTask[]; status?: string }
    ),

  /**
   * Creates a global pool task and assigns it to the student (single backend call).
   * BFF: see students/:id/tasks/create-pool-and-assign.
   */
  createTasksPoolItemAndAssign: (
    userId: string,
    data: TasksPoolItemUpsertPayload
  ) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks/create-pool-and-assign`, {
      method: "POST",
      body: data,
    }).then((r) => {
      const tasks_pool = pickSinglePoolTaskEntity(r);
      const tasks = pickStudentTasksArray(r);
      const droppedRaw = r.dropped_non_pool_tasks;
      const dropped_non_pool_tasks =
        typeof droppedRaw === "number" && Number.isFinite(droppedRaw) ? droppedRaw : 0;
      const task = pickSingleStudentTaskEntity(r) ?? tasks[0] ?? null;
      if (!task) {
        throw new Error("Unexpected response from create-pool-and-assign (missing tasks)");
      }
      return { tasks_pool, tasks, dropped_non_pool_tasks, task };
    }),

  createStudentTask: (userId: string, data: { text: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks`, { method: "POST", body: data }).then((r) => {
      const task = pickSingleStudentTaskEntity(r);
      if (!task) throw new Error("Unexpected response from create task");
      return { task };
    }),

  updateStudentTask: (
    userId: string,
    taskId: string,
    data: { text?: string; order_index?: number; max_performance_score?: number }
  ) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks/${taskId}`, { method: "PUT", body: data }).then(
      (r) => {
        const task = pickSingleStudentTaskEntity(r);
        if (!task) throw new Error("Unexpected response from update task");
        return { task };
      }
    ),

  deleteStudentTask: (userId: string, taskId: string) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/tasks/${taskId}`, { method: "DELETE" }),

  getTasksPool: () => adminFetch<Record<string, unknown>>("/tasks-pool").then((r) => pickTasksPoolArray(r)),

  createTasksPoolItem: (data: TasksPoolItemUpsertPayload) =>
    adminFetch<Record<string, unknown>>("/tasks-pool", { method: "POST", body: data }).then((r) => {
      const item = pickSinglePoolTaskEntity(r);
      if (!item) throw new Error("Unexpected response from create pool task");
      return { tasks_pool: item };
    }),

  updateTasksPoolItem: (
    poolId: string,
    data: Partial<TasksPoolItemUpsertPayload>
  ) =>
    adminFetch<Record<string, unknown>>(`/tasks-pool/${poolId}`, { method: "PUT", body: data }).then((r) => {
      const item = pickSinglePoolTaskEntity(r);
      if (!item) throw new Error("Unexpected response from update pool task");
      return { tasks_pool: item };
    }),

  deleteTasksPoolItem: (poolId: string) =>
    adminFetch<Record<string, unknown>>(`/tasks-pool/${poolId}`, { method: "DELETE" }),

  getFocusTasks: (userId: string) =>
    adminFetch<{ task_focus: FocusTask[] }>(`/students/${userId}/task-focus`).then((r) => r.task_focus ?? []),

  putStudentFocusTasksSync: (userId: string, body: { pool_task_ids: string[] }) =>
    adminFetch<{ task_focus: FocusTask[] }>(`/students/${userId}/task-focus`, { method: "PUT", body }),

  createFocusTask: (userId: string, data: { text: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_focus: FocusTask }>(`/students/${userId}/task-focus`, { method: "POST", body: data }),

  updateFocusTask: (userId: string, taskId: string, data: { text?: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_focus: FocusTask }>(`/students/${userId}/task-focus/${taskId}`, { method: "PUT", body: data }),

  deleteFocusTask: (userId: string, taskId: string) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/task-focus/${taskId}`, { method: "DELETE" }),

  getFocusTaskPool: () =>
    adminFetch<{ task_focus_pool?: FocusTaskPoolItem[] }>("/task-focus-pool").then((r) =>
      Array.isArray(r.task_focus_pool) ? r.task_focus_pool : []
    ),

  createFocusTaskPoolItem: (data: { text: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_focus: FocusTaskPoolItem }>("/task-focus-pool", { method: "POST", body: data }),

  updateFocusTaskPoolItem: (poolId: string, data: { text?: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_focus: FocusTaskPoolItem }>(`/task-focus-pool/${poolId}`, { method: "PUT", body: data }),

  deleteFocusTaskPoolItem: (poolId: string) =>
    adminFetch<Record<string, unknown>>(`/task-focus-pool/${poolId}`, { method: "DELETE" }),

  getTasks: () =>
    adminFetch<{ tasks: Task[] }>("/tasks").then((r) => r.tasks ?? []),

  createTask: (data: Partial<Task>) =>
    adminFetch<{ task: Task }>("/tasks", { method: "POST", body: data }),

  updateTask: (id: string, data: Partial<Task>) =>
    adminFetch<{ task: Task }>(`/tasks/${id}`, { method: "PUT", body: data }),

  deleteTask: (id: string) =>
    adminFetch<{ status: string }>(`/tasks/${id}`, { method: "DELETE" }),

  /** Per-student post-recording questions list. */
  getStudentPostRecordingQuestions: (userId: string) =>
    adminFetch<{ post_recording_questions: PostQuestion[] }>(`/students/${userId}/post-recording-questions`).then(
      (r) => r.post_recording_questions ?? []
    ),

  /** Sync from pool. Body: { pool_question_ids: string[] }. */
  putStudentPostRecordingQuestionsSync: (userId: string, body: { pool_question_ids: string[] }) =>
    adminFetch<{ post_recording_questions: PostQuestion[] }>(`/students/${userId}/post-recording-questions`, {
      method: "PUT",
      body,
    }),

  /** Create per-student post-recording question. */
  createPostRecordingQuestion: (
    userId: string,
    data: { text: string; order_index?: number; answer_type?: string }
  ) =>
    adminFetch<{ post_recording_question: PostQuestion }>(`/students/${userId}/post-recording-questions`, {
      method: "POST",
      body: data,
    }),

  /** Update per-student post-recording question. */
  updatePostRecordingQuestion: (userId: string, questionId: string, data: Partial<PostQuestion>) =>
    adminFetch<{ post_recording_question: PostQuestion }>(
      `/students/${userId}/post-recording-questions/${questionId}`,
      { method: "PUT", body: data }
    ),

  /** Delete per-student post-recording question. */
  deletePostRecordingQuestion: (userId: string, questionId: string) =>
    adminFetch<{ status?: string }>(`/students/${userId}/post-recording-questions/${questionId}`, {
      method: "DELETE",
    }),

  getMetricLabels: () =>
    adminFetch<{ metrics?: MetricLabel[]; metric_labels?: MetricLabel[] }>("/metrics").then(
      (r) => r.metrics ?? r.metric_labels ?? []
    ),

  putMetricLabels: (metrics: MetricLabel[]) =>
    adminFetch<{ status: string }>("/metrics", { method: "PUT", body: { metrics } }),

  getMetricQuestions: () =>
    adminFetch<{ questions: MetricQuestion[] }>("/metric-questions").then((r) => r.questions ?? []),

  createMetricQuestion: (data: { position: 1 | 2 | 3; text: string }) =>
    adminFetch<{ question: MetricQuestion }>("/metric-questions", { method: "POST", body: data }),

  updateMetricQuestion: (id: string, data: { position?: 1 | 2 | 3; text?: string }) =>
    adminFetch<{ question: MetricQuestion }>(`/metric-questions/${id}`, { method: "PUT", body: data }),

  deleteMetricQuestion: (id: string) =>
    adminFetch<Record<string, unknown>>(`/metric-questions/${id}`, { method: "DELETE" }),

  sendCoachSuggestion: (userId: string, message: string) =>
    adminFetch<CoachSuggestionResponse>(
      `/students/${userId}/coach-suggestions`,
      { method: "POST", body: { message } }
    ),

  getCoachSuggestionHistory: (userId: string) =>
    adminFetch<CoachSuggestionHistory>(
      `/students/${userId}/coach-suggestions/history`
    ),

  clearCoachSuggestionHistory: (userId: string) =>
    adminFetch<{ status: string }>(
      `/students/${userId}/coach-suggestions/history`,
      { method: "DELETE" }
    ),
};
