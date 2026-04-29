/**
 * Admin API client — calls Next.js BFF /api/admin/* (proxied to backend /v2/admin/*).
 * Use only in admin pages; BFF must send admin token.
 */

const getBase = () => (typeof window === "undefined" ? "" : "");

type AdminFetchOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  cache?: RequestCache;
  signal?: AbortSignal;
};

export type AdminApiError = Error & {
  status?: number;
  code?: string;
  error?: string;
  recording_1_processing_error_code?: string;
};

/** 409 from approve-send when delivery already running or draft locked */
export function isCopilotDeliveryInProgressError(err: unknown): boolean {
  const e = err as AdminApiError;
  return e?.status === 409 && (e.code === "DELIVERY_IN_PROGRESS" || e.code === "DELIVERY_CONFLICT");
}

/** Align with backend / proxy max body; client rejects larger files before upload. */
export const COPILOT_REFERENCE_VIDEO_MAX_BYTES = 500 * 1024 * 1024;


/** Slow networks + 500 MB — align with reverse-proxy / app server timeouts. */
export const COPILOT_REFERENCE_VIDEO_UPLOAD_XHR_TIMEOUT_MS = 45 * 60 * 1000;

export type CopilotReferenceVideoUploadProgress = {
  loaded: number;
  total: number;
  lengthComputable: boolean;
  /** Set when `lengthComputable` and `total > 0`. */
  percent: number | null;
};

function getBrowserPublicBackendUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    "";
  return raw ? raw.replace(/\/+$/, "") : null;
}

async function adminFetch<T>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, cache, signal } = options;
  const url = `${getBase()}/api/admin${path}`;
  const bodySerialized: BodyInit | null =
    body == null ? null : body instanceof FormData ? body : JSON.stringify(body);
  const init: RequestInit = {
    method,
    credentials: "include",
    ...(cache ? { cache } : {}),
    ...(signal ? { signal } : {}),
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
      res.status === 413
        ? "Upload too large for this app server (HTTP 413). Set NEXT_PUBLIC_API_URL and retry, or use a smaller file."
        : err.error || err.message || err.code || err.details || `HTTP ${res.status} for ${path}`;
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
  draft_generation_session_id?: string | null;
  /** Session row `created_at` from DB (ISO), when backend exposes it */
  session_created_at?: string | null;
  queue_position?: number;
  state: CopilotDraftStatus;
  /** When the student submitted the lesson / entered the queue (ISO), if backend sends it */
  submitted_at?: string | null;
  lesson_submitted_at?: string | null;
  created_at?: string | null;
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
    /** Coach PATCH `/profile-classification`; may mirror nested `learning_profile`. */
    profile_override_justification?: string | null;
    coach_override_profile?: string | null;
    learning_profile?: Record<string, unknown> | null;
    session_count?: number | null;
    completed_at?: string | null;
    canonical_score_for_display?: number | null;
  } | null;
}

/** Normalize cohort queue rows so `session_created_at` is set from common API aliases. */
function enrichCopilotStudentQueueItem(student: CopilotStudentQueueItem): CopilotStudentQueueItem {
  const record = asRecord(student as unknown);
  if (!record) return student;
  const sessionObj = asRecord(record.session);
  const resolved =
    asTrimmedString(student.session_created_at) ??
    asTrimmedString(record.session_created_at) ??
    asTrimmedString(record.sessionCreatedAt) ??
    asTrimmedString(record.homework_session_created_at) ??
    asTrimmedString(record.homeworkSessionCreatedAt) ??
    asTrimmedString(record.report_created_at) ??
    asTrimmedString(record.reportCreatedAt) ??
    (sessionObj
      ? asTrimmedString(sessionObj.created_at) ?? asTrimmedString(sessionObj.createdAt)
      : null) ??
    asTrimmedString(record.created_at);
  if (!resolved) return student;
  if (student.session_created_at === resolved) return student;
  return { ...student, session_created_at: resolved };
}

const queueSessionCreatedAtByStudent = new Map<string, Map<string, string>>();

async function getSessionCreatedAtFromStudentProfile(
  studentId: string,
  sessionId: string
): Promise<string | null> {
  if (!studentId || !sessionId) return null;
  const cachedBySession = queueSessionCreatedAtByStudent.get(studentId);
  if (cachedBySession?.has(sessionId)) {
    return cachedBySession.get(sessionId) ?? null;
  }

  const profile = await adminFetch<Record<string, unknown>>(`/students/${studentId}`);
  const sessionsRaw = Array.isArray((profile as { sessions?: unknown[] }).sessions)
    ? ((profile as { sessions?: unknown[] }).sessions as Array<Record<string, unknown>>)
    : [];

  const bySession = cachedBySession ?? new Map<string, string>();
  for (const row of sessionsRaw) {
    const sid = asTrimmedString(row.id) ?? asTrimmedString(row.session_id);
    const created =
      asTrimmedString(row.created_at) ??
      asTrimmedString(row.session_created_at) ??
      asTrimmedString(row.submitted_at);
    if (sid && created) bySession.set(sid, created);
  }
  queueSessionCreatedAtByStudent.set(studentId, bySession);
  return bySession.get(sessionId) ?? null;
}

/** Server-driven assignment delivery; prefer over inferring from status alone. */
export type CopilotDeliveryLifecycle = "idle" | "delivering" | "delivered" | "failed";
export type CopilotDeliveryFailedStep = "render" | "email";

export interface CopilotStudentDraft {
  id: string;
  student_id: string;
  session_id?: string | null;
  status: CopilotDraftStatus;
  /** Assignment pipeline: idle → delivering → delivered | failed */
  delivery_lifecycle?: CopilotDeliveryLifecycle | null;
  /** When delivery_lifecycle is failed, which step failed */
  delivery_failed_step?: CopilotDeliveryFailedStep | null;
  /** Email notify failed but student dashboard/assignment is unlocked */
  delivery_email_soft_failed?: boolean | null;
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
  updated_at?: string | null;
}

export type DraftGenerationStatus = "pending" | "ready" | "failed" | "not_started";

export interface CopilotStudentDraftsResponse {
  drafts: CopilotStudentDraft[];
  draft_generation_status?: DraftGenerationStatus;
  draft_generation_session_id?: string | null;
  /** Disambiguates which draft row reflects the most recent Send; null when nothing has ever been sent. */
  latest_sent_draft_id?: string | null;
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
  const sessionFromNested = pickStrFromCandidates([draftPayload, metadata], [
    "session_id",
    "sessionId",
    "homework_session_id",
    "homeworkSessionId",
  ]);

  const lifeRaw = raw.delivery_lifecycle ?? raw.deliveryLifecycle;
  const life =
    typeof lifeRaw === "string" && ["idle", "delivering", "delivered", "failed"].includes(lifeRaw)
      ? (lifeRaw as CopilotDeliveryLifecycle)
      : null;
  const stepRaw = raw.delivery_failed_step ?? raw.deliveryFailedStep;
  const failedStep =
    stepRaw === "render" || stepRaw === "email" ? (stepRaw as CopilotDeliveryFailedStep) : null;
  const softEmail =
    typeof (raw.delivery_email_soft_failed ?? raw.deliveryEmailSoftFailed) === "boolean"
      ? Boolean(raw.delivery_email_soft_failed ?? raw.deliveryEmailSoftFailed)
      : null;

  return {
    id: String(raw.id ?? raw.draft_id ?? ""),
    student_id: String(raw.student_id ?? raw.user_id ?? ""),
    session_id: pickStrFromRaw(raw, "session_id", "sessionId") ?? sessionFromNested,
    status: (typeof raw.status === "string" ? raw.status : "Draft") as CopilotDraftStatus,
    delivery_lifecycle: life,
    delivery_failed_step: failedStep,
    delivery_email_soft_failed: softEmail,
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
    updated_at: pickStrFromRaw(raw, "updated_at", "updatedAt"),
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
  /** Approve/Send: assignment visible to student but email delivery may have failed */
  email_failed_but_unlocked?: boolean;
}

export interface CopilotAnnotationChip {
  chip_key: string;
  label: string;
  description?: string | null;
  is_active?: boolean;
  section?: string | null;
}

export type ReferenceVideoTranscriptionStatus = "processing" | "done" | "failed" | string;

export interface AdminCopilotReferenceVideo {
  id: string;
  user_id?: string | null;
  session_id?: string | null;
  draft_id?: string | null;
  title?: string | null;
  original_filename?: string | null;
  reference_tags?: string[] | null;
  is_universal_video?: boolean;
  created_at?: string | null;
  transcription_status?: ReferenceVideoTranscriptionStatus | null;
  transcription_error?: string | null;
  transcript_text?: string | null;
  preview_url?: string | null;
}

export interface AdminCopilotReferenceVideosResponse {
  reference_videos: AdminCopilotReferenceVideo[];
  total: number;
  limit: number;
  offset: number;
}

export type CopilotReferenceVideoUploadResult = {
  reference_video?: AdminCopilotReferenceVideo;
  transcription_status?: string | null;
  transcription_error?: string | null;
  transcript_text?: string | null;
  preview_url?: string | null;
  /** True when upload/register succeeded but polling upload-jobs failed (e.g. jobs table unavailable). */
  degraded_job_tracking?: boolean;
};

/** Normalized row from GET upload-jobs/:id (job object). */
export type CopilotReferenceVideoUploadJobPayload = {
  stage: string;
  percent: number;
  message: string | null;
  reference_video_id?: string | null;
  error?: string | null;
  reference_video?: AdminCopilotReferenceVideo | null;
  preview_url?: string | null;
};

export type CopilotReferenceVideoUploadAccepted = {
  kind: "accepted";
  job_id: string;
  poll_url?: string;
  message?: string;
  /** When the backend embeds the row on register (optional). */
  reference_video?: AdminCopilotReferenceVideo | null;
};

function referenceVideoRowFromUnknown(raw: unknown): AdminCopilotReferenceVideo | null {
  const item = asRecord(raw);
  if (!item) return null;
  const id = asTrimmedString(item.id);
  if (!id) return null;
  const tagsRaw = item.reference_tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : null;
  return {
    id,
    user_id: asTrimmedString(item.user_id),
    session_id: asTrimmedString(item.session_id),
    draft_id: asTrimmedString(item.draft_id),
    title: asTrimmedString(item.title),
    original_filename: asTrimmedString(item.original_filename),
    reference_tags: tags,
    is_universal_video: typeof item.is_universal_video === "boolean" ? item.is_universal_video : false,
    created_at: asTrimmedString(item.created_at),
    transcription_status: asTrimmedString(item.transcription_status),
    transcription_error: asTrimmedString(item.transcription_error),
    transcript_text: asTrimmedString(item.transcript_text),
    preview_url: asTrimmedString(item.preview_url),
  };
}

function normalizeCopilotReferenceVideoJobPayload(raw: unknown): CopilotReferenceVideoUploadJobPayload {
  const j = asRecord(raw) ?? {};
  const pctRaw = j.percent;
  const pct =
    typeof pctRaw === "number" && Number.isFinite(pctRaw)
      ? Math.max(0, Math.min(100, Math.round(pctRaw)))
      : 0;
  const rvRaw = j.reference_video;
  const refVideo = referenceVideoRowFromUnknown(rvRaw);
  return {
    stage: typeof j.stage === "string" ? j.stage : "",
    percent: pct,
    message: typeof j.message === "string" ? j.message : null,
    reference_video_id: asTrimmedString(j.reference_video_id),
    error: typeof j.error === "string" ? j.error : null,
    reference_video: refVideo,
    preview_url: asTrimmedString(j.preview_url),
  };
}

function parseCopilotReferenceVideoJobPollBody(data: unknown): {
  status?: string;
  job: CopilotReferenceVideoUploadJobPayload;
} {
  const o = asRecord(data) ?? {};
  const jobRaw = o.job;
  return {
    status: typeof o.status === "string" ? o.status : undefined,
    job: normalizeCopilotReferenceVideoJobPayload(jobRaw),
  };
}

function jobPayloadToUploadResult(job: CopilotReferenceVideoUploadJobPayload): CopilotReferenceVideoUploadResult {
  const rv =
    job.reference_video ??
    (job.reference_video_id ? ({ id: job.reference_video_id } satisfies AdminCopilotReferenceVideo) : undefined);
  return {
    reference_video: rv,
    preview_url: job.preview_url ?? null,
    transcription_status: rv?.transcription_status ?? null,
    transcription_error: rv?.transcription_error ?? null,
    transcript_text: rv?.transcript_text ?? null,
  };
}

async function fetchCopilotReferenceVideoUploadJob(
  jobId: string,
  signal?: AbortSignal
): Promise<{ status?: string; job: CopilotReferenceVideoUploadJobPayload }> {
  const id = encodeURIComponent(jobId.trim());
  if (!id) throw new Error("Missing upload job id");
  const base = getBrowserPublicBackendUrl();
  if (base) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not signed in");
    const res = await fetch(`${base}/v2/admin/copilot/reference-videos/upload-jobs/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw referenceVideoUploadErrorFromXhr(res.status, data);
    }
    return parseCopilotReferenceVideoJobPollBody(data);
  }
  const res = await fetch(`${getBase()}/api/admin/copilot/reference-videos/upload-jobs/${id}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw referenceVideoUploadErrorFromXhr(res.status, data);
  }
  return parseCopilotReferenceVideoJobPollBody(data);
}

async function pollCopilotReferenceVideoUploadJobUntilDone(
  jobId: string,
  options: {
    signal?: AbortSignal;
    onJobProgress?: (job: CopilotReferenceVideoUploadJobPayload) => void;
    intervalMs?: number;
    initialHint?: string;
  }
): Promise<CopilotReferenceVideoUploadResult> {
  const interval = options.intervalMs ?? 750;
  options.onJobProgress?.({
    stage: "queued",
    percent: 0,
    message: options.initialHint ?? "Upload received, processing on server…",
  });
  for (;;) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const { job } = await fetchCopilotReferenceVideoUploadJob(jobId, options.signal);
    options.onJobProgress?.(job);
    const stage = job.stage.trim().toLowerCase();
    if (stage === "failed") {
      throw new Error(
        job.error?.trim() || job.message?.trim() || "Reference video processing failed."
      );
    }
    if (stage === "completed") {
      return jobPayloadToUploadResult(job);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, interval);
    });
  }
}

function referenceVideoUploadErrorFromXhr(status: number, data: unknown): AdminApiError {
  const err = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as {
    error?: string;
    message?: string;
    code?: string;
    details?: unknown;
  };
  const code = typeof err.code === "string" ? err.code : undefined;
  const detailsText =
    typeof err.details === "string"
      ? err.details
      : err.details != null
        ? JSON.stringify(err.details)
        : "";
  const is413 = status === 413 || code === "PAYLOAD_TOO_LARGE";
  const msg = is413
    ? code === "PAYLOAD_TOO_LARGE"
      ? "Upload rejected: file too large (PAYLOAD_TOO_LARGE). Use a smaller file or raise server / proxy body limits."
      : err.error ||
        err.message ||
        "Upload rejected: file too large for the proxy or server (HTTP 413). Set NEXT_PUBLIC_API_URL for direct upload, shrink the file, or raise client_max_body_size."
    : status === 500
      ? err.error ||
        err.message ||
        err.code ||
        detailsText ||
        "Server error (HTTP 500) while uploading reference video."
      : status === 400
        ? [err.error, err.message, err.code, detailsText, "Bad upload request (HTTP 400) from backend."]
            .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
            .join(" ")
      : err.error ||
        err.message ||
        err.code ||
        detailsText ||
        `HTTP ${status} for reference video upload`;
  const apiError = new Error(msg) as AdminApiError;
  apiError.status = status;
  if (code) apiError.code = code;
  if (err.error) apiError.error = err.error;
  return apiError;
}

/** True when GET upload-jobs (or related) failed because the Supabase job table / feature is off in this env. */
export function isCopilotReferenceUploadJobsUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const ae = err as AdminApiError;
  if (ae.code === "UPLOAD_JOBS_UNAVAILABLE") return true;
  if (ae.status === 503 && typeof ae.message === "string" && ae.message.toLowerCase().includes("upload job")) {
    return true;
  }
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("upload job tracking table") ||
    m.includes("upload_jobs_unavailable") ||
    m.includes("job tracking table is unavailable")
  );
}

type ReferenceVideoUploadUrlResponse = {
  upload_url: string;
  storage_path: string;
  bucket?: string;
  content_type: string;
};

async function requestReferenceVideoUploadUrl(
  file: File,
  signal?: AbortSignal
): Promise<ReferenceVideoUploadUrlResponse> {
  const fallbackContentType =
    (file.type || "application/octet-stream").split(";")[0].trim() || "application/octet-stream";
  const payload = {
    filename: file.name,
    file_size_bytes: file.size,
    content_type: fallbackContentType,
    storage_provider: "r2",
  };
  const base = getBrowserPublicBackendUrl();
  let res: Response;
  if (base) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not signed in");
    res = await fetch(`${base}/v2/admin/copilot/reference-videos/upload-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } else {
    res = await fetch(`${getBase()}/api/admin/copilot/reference-videos/upload-url`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw referenceVideoUploadErrorFromXhr(res.status, data);
  }
  const obj = asRecord(data) ?? {};
  const upload_url = asTrimmedString(obj.upload_url);
  const storage_path = asTrimmedString(obj.storage_path);
  if (!upload_url || !storage_path) {
    throw new Error("Backend did not return upload_url / storage_path.");
  }
  return {
    upload_url,
    storage_path,
    bucket: asTrimmedString(obj.bucket) ?? undefined,
    content_type: asTrimmedString(obj.content_type) || fallbackContentType,
  };
}

function uploadReferenceVideoToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: ((progress: CopilotReferenceVideoUploadProgress) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.timeout = COPILOT_REFERENCE_VIDEO_UPLOAD_XHR_TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      const lengthComputable = event.lengthComputable;
      const loaded = event.loaded;
      const total = event.total;
      const percent =
        lengthComputable && total > 0 ? Math.round((loaded / total) * 100) : null;
      onProgress?.({ loaded, total, lengthComputable, percent });
    };

    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanupAbort = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    xhr.onload = () => {
      cleanupAbort();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Cloudflare R2 upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => {
      cleanupAbort();
      reject(new Error("Network error during Cloudflare R2 upload"));
    };
    xhr.ontimeout = () => {
      cleanupAbort();
      reject(new Error("Cloudflare R2 upload timed out."));
    };
    xhr.onabort = () => {
      cleanupAbort();
      reject(new DOMException("Aborted", "AbortError"));
    };
    xhr.send(file);
  });
}

type RegisterReferenceVideoFromStorageParams = {
  storage_path: string;
  storage_provider: "r2";
  bucket?: string;
  session_id?: string;
  user_id?: string;
  draft_id?: string;
  track_progress?: boolean;
  title?: string;
  reference_tags?: string;
  is_universal_video?: boolean;
};

async function registerReferenceVideoFromStorage(
  params: RegisterReferenceVideoFromStorageParams,
  signal?: AbortSignal
): Promise<CopilotReferenceVideoUploadAccepted> {
  const base = getBrowserPublicBackendUrl();
  let res: Response;
  if (base) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not signed in");
    res = await fetch(`${base}/v2/admin/copilot/reference-videos/register-from-storage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
      signal,
    });
  } else {
    res = await fetch(`${getBase()}/api/admin/copilot/reference-videos/register-from-storage`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(params),
      signal,
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw referenceVideoUploadErrorFromXhr(res.status, data);
  }
  const obj = asRecord(data) ?? {};
  const jobId = asTrimmedString(obj.job_id);
  if (!jobId) {
    throw new Error("Backend did not return job_id from register-from-storage.");
  }
  const reference_video = referenceVideoRowFromUnknown(obj.reference_video);
  return {
    kind: "accepted",
    job_id: jobId,
    poll_url: asTrimmedString(obj.poll_url) ?? undefined,
    message: asTrimmedString(obj.message) ?? undefined,
    ...(reference_video ? { reference_video } : {}),
  };
}

/**
 * Cloudflare R2 3-step reference video upload with progress:
 * 1) POST /upload-url  2) PUT raw bytes to signed URL  3) POST /register-from-storage.
 */
export function uploadCopilotReferenceVideoWithProgress(
  formData: FormData,
  options?: {
    onProgress?: (progress: CopilotReferenceVideoUploadProgress) => void;
    onJobProgress?: (job: CopilotReferenceVideoUploadJobPayload) => void;
    signal?: AbortSignal;
    /** Polling interval when the server returns 202 + job_id. Default 750ms. */
    jobPollIntervalMs?: number;
    /** When true (default), poll job status after registration. */
    trackServerJob?: boolean;
  }
): Promise<CopilotReferenceVideoUploadResult> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Reference video upload is only available in the browser"));
  }

  const onProgress = options?.onProgress;
  const onJobProgress = options?.onJobProgress;
  const signal = options?.signal;
  const trackServerJob = options?.trackServerJob !== false;

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        const videoFile = formData.get("video_file");
        if (!(videoFile instanceof File)) {
          reject(new Error("FormData is missing a valid video_file entry."));
          return;
        }

        const userIdRaw = formData.get("user_id");
        const draftIdRaw = formData.get("draft_id");
        const sessionIdRaw = formData.get("session_id");
        const titleRaw = formData.get("title");
        const tagsRaw = formData.get("reference_tags");
        const isUniversalRaw = formData.get("is_universal_video");
        const user_id = typeof userIdRaw === "string" && userIdRaw.trim() ? userIdRaw.trim() : undefined;
        const draft_id = typeof draftIdRaw === "string" && draftIdRaw.trim() ? draftIdRaw.trim() : undefined;
        const session_id =
          typeof sessionIdRaw === "string" && sessionIdRaw.trim() ? sessionIdRaw.trim() : undefined;
        const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : undefined;
        const reference_tags = typeof tagsRaw === "string" && tagsRaw.trim() ? tagsRaw.trim() : undefined;
        const is_universal_video = isUniversalRaw === "true";

        const uploadTarget = await requestReferenceVideoUploadUrl(videoFile, signal);

        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        await uploadReferenceVideoToR2(
          uploadTarget.upload_url,
          videoFile,
          uploadTarget.content_type,
          onProgress,
          signal
        );

        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        const accepted = await registerReferenceVideoFromStorage(
          {
            storage_path: uploadTarget.storage_path,
            storage_provider: "r2",
            bucket: uploadTarget.bucket,
            session_id,
            user_id,
            draft_id,
            track_progress: trackServerJob,
            title,
            reference_tags,
            is_universal_video,
          },
          signal
        );

        if (!trackServerJob) {
          reject(new Error("Async upload (202) received but server job polling is disabled."));
          return;
        }

        let result: CopilotReferenceVideoUploadResult;
        try {
          result = await pollCopilotReferenceVideoUploadJobUntilDone(accepted.job_id, {
            signal,
            onJobProgress,
            intervalMs: options?.jobPollIntervalMs,
            initialHint: accepted.message ?? undefined,
          });
        } catch (err) {
          if (!isCopilotReferenceUploadJobsUnavailableError(err)) {
            throw err;
          }
          const rv = accepted.reference_video;
          result = rv
            ? {
                reference_video: rv,
                preview_url: rv.preview_url ?? null,
                transcription_status: rv.transcription_status ?? null,
                transcription_error: rv.transcription_error ?? null,
                transcript_text: rv.transcript_text ?? null,
                degraded_job_tracking: true,
              }
            : {
                reference_video: undefined,
                preview_url: null,
                transcription_status: null,
                transcription_error: null,
                transcript_text: null,
                degraded_job_tracking: true,
              };
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

export interface AdminCopilotDraftPipelineStatusResponse {
  status?: string | null;
  stage?: "queued" | "running_tts" | "running_video" | "uploading" | "sent" | "failed" | string | null;
  error?: string | null;
  delivery_lifecycle?: CopilotDeliveryLifecycle | null;
  delivery_failed_step?: CopilotDeliveryFailedStep | null;
  delivery_email_soft_failed?: boolean | null;
  [key: string]: unknown;
}

function pickFirstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/** Merge root + nested `draft` fields from pipeline-status JSON. */
export function normalizeAdminCopilotDraftPipelineStatus(raw: unknown): AdminCopilotDraftPipelineStatusResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: null, stage: null };
  }
  const o = raw as Record<string, unknown>;
  const nested =
    o.draft && typeof o.draft === "object" && !Array.isArray(o.draft) ? (o.draft as Record<string, unknown>) : null;
  const life =
    (typeof o.delivery_lifecycle === "string" && o.delivery_lifecycle) ||
    (typeof o.deliveryLifecycle === "string" && o.deliveryLifecycle) ||
    (nested && typeof nested.delivery_lifecycle === "string" && nested.delivery_lifecycle) ||
    (nested && typeof nested.deliveryLifecycle === "string" && nested.deliveryLifecycle) ||
    null;
  const validLife =
    life && ["idle", "delivering", "delivered", "failed"].includes(life) ? (life as CopilotDeliveryLifecycle) : null;
  const stepRaw = pickFirstString(
    o.delivery_failed_step,
    o.deliveryFailedStep,
    nested?.delivery_failed_step,
    nested?.deliveryFailedStep
  );
  const failedStep: CopilotDeliveryFailedStep | null =
    stepRaw === "render" || stepRaw === "email" ? stepRaw : null;
  const softA = o.delivery_email_soft_failed ?? o.deliveryEmailSoftFailed;
  const softB = nested?.delivery_email_soft_failed ?? nested?.deliveryEmailSoftFailed;
  const soft: boolean | null =
    typeof softA === "boolean" ? softA : typeof softB === "boolean" ? softB : null;
  return {
    ...o,
    status: (pickFirstString(o.status, nested?.status) ?? o.status) as string | null | undefined,
    stage: (pickFirstString(
      o.stage,
      o.pipeline_stage,
      nested?.stage,
      nested?.pipeline_stage
    ) ?? o.stage) as AdminCopilotDraftPipelineStatusResponse["stage"],
    error: (pickFirstString(o.error, o.message, nested?.error) ?? o.error) as string | null | undefined,
    delivery_lifecycle: validLife ?? null,
    delivery_failed_step: failedStep,
    delivery_email_soft_failed: soft,
  };
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

export type StressSnippetScenario =
  | "after_pause"
  | "before_pause"
  | "high_filler_density"
  | "low_filler_density"
  | "uncertain";

export interface StressSnippetFeatures {
  pause_strength?: number;
  filler_density?: number;
  energy_std?: number;
  queue_skipped?: boolean;
  [key: string]: unknown;
}

/**
 * Authoritative shape returned by GET /v2/admin/stress-snippets.
 * `audio_url` is a signed URL to a ≤5s mp3 at `stress_snippets/<recording_id>/<snippet_id>.mp3`
 * and is the ONLY thing the UI should play. Do not fall back to the parent recording's audio.
 */
export interface StressSnippet {
  id: string;
  recording_id: string;
  session_id: string | null;
  user_id: string | null;
  source_type: "student" | "internet";
  scenario: StressSnippetScenario;

  // ms fields (legacy; backend still emits them)
  start_ms: number;
  end_ms: number;
  duration_ms: number;

  // seconds fields — snake_case
  start_sec: number;
  end_sec: number;
  duration_sec: number;

  // seconds fields — camelCase (Training Studio / Next clients)
  startSec: number;
  endSec: number;
  durationSec: number;

  // playback
  audio_url: string | null;
  playable: boolean;
  storage_path: string | null;

  // labeling
  coach_label: "stress" | "no_stress" | null;
  coach_label_notes: string | null;
  queue_skipped: boolean;

  classifier_stress_probability: number | null;
  classifier_confidence: number | null;
  selection_score: number | null;

  transcript_excerpt: string | null;
  features: StressSnippetFeatures | null;
  created_at: string;
}

export interface StressSnippetListResponse {
  snippets: StressSnippet[];
  source_type: string;
  label_state: string;
  sort: "newest" | "oldest";
  exclude_queue_skipped: boolean;
  limit: number;
  offset: number;
  count: number;
}

export interface StressSnippetSettings {
  auto_extract_enabled: boolean;
  runtime_key?: string;
  raw_value?: string | null;
}

/**
 * Charisma snippets mirror the stress-snippet shape exactly. Only the coach_label
 * domain differs: "charisma" / "no_charisma" (vs "stress" / "no_stress").
 */
export type CharismaSnippetScenario = StressSnippetScenario;
export type CharismaSnippetFeatures = StressSnippetFeatures;

export interface CharismaSnippet {
  id: string;
  recording_id: string;
  session_id: string | null;
  user_id: string | null;
  source_type: "student" | "internet";
  scenario: CharismaSnippetScenario;

  // ms fields (legacy; backend still emits them)
  start_ms: number;
  end_ms: number;
  duration_ms: number;

  // seconds fields — snake_case
  start_sec: number;
  end_sec: number;
  duration_sec: number;

  // seconds fields — camelCase (Training Studio / Next clients)
  startSec: number;
  endSec: number;
  durationSec: number;

  // playback
  audio_url: string | null;
  playable: boolean;
  storage_path: string | null;

  // labeling
  coach_label: "charisma" | "no_charisma" | null;
  coach_label_notes: string | null;
  queue_skipped: boolean;

  classifier_stress_probability: number | null;
  classifier_confidence: number | null;
  selection_score: number | null;

  transcript_excerpt: string | null;
  features: CharismaSnippetFeatures | null;
  created_at: string;
}

export interface CharismaSnippetListResponse {
  snippets: CharismaSnippet[];
  source_type: string;
  label_state: string;
  sort: "newest" | "oldest";
  exclude_queue_skipped: boolean;
  limit: number;
  offset: number;
  count: number;
}

export interface CharismaSnippetSettings {
  auto_extract_enabled: boolean;
  runtime_key?: string;
  raw_value?: string | null;
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

  getCopilotCohortStudents: (
    cohortId: string,
    params?: { limit?: number; offset?: number; include_archived?: boolean }
  ) => {
    const search = new URLSearchParams();
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    search.set("include_archived", params?.include_archived ? "true" : "false");
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<{ students: CopilotStudentQueueItem[] }>(
      `/copilot/cohorts/${cohortId}/students${suffix}`,
      { cache: "no-store" }
    ).then(async (res) => {
      const enriched = (Array.isArray(res.students) ? res.students : []).map((s) =>
        enrichCopilotStudentQueueItem(s)
      );
      const missing = enriched.filter(
        (row) =>
          !asTrimmedString(row.session_created_at) &&
          !!asTrimmedString(row.student_id) &&
          !!asTrimmedString(row.session_id)
      );
      if (missing.length === 0) return { students: enriched };

      const updates = await Promise.all(
        missing.map(async (row) => {
          const sid = asTrimmedString(row.session_id);
          const studentId = asTrimmedString(row.student_id);
          if (!sid || !studentId) return null;
          try {
            const createdAt = await getSessionCreatedAtFromStudentProfile(studentId, sid);
            return createdAt ? { studentId, sid, createdAt } : null;
          } catch {
            return null;
          }
        })
      );
      const byKey = new Map<string, string>();
      for (const item of updates) {
        if (!item) continue;
        byKey.set(`${item.studentId}:${item.sid}`, item.createdAt);
      }

      return {
        students: enriched.map((row) => {
          if (asTrimmedString(row.session_created_at)) return row;
          const sid = asTrimmedString(row.session_id);
          const studentId = asTrimmedString(row.student_id);
          if (!sid || !studentId) return row;
          const resolved = byKey.get(`${studentId}:${sid}`);
          return resolved ? { ...row, session_created_at: resolved } : row;
        }),
      };
    });
  },

  setCopilotQueueArchived: (
    studentId: string,
    body: { session_id: string; sessionId: string }
  ) =>
    adminFetch<{ user_id: string; session_id: string; archived: boolean }>(
      `/copilot/students/${studentId}/queue-archive`,
      { method: "POST", body }
    ),

  unsetCopilotQueueArchived: (
    studentId: string,
    body: { session_id: string; sessionId: string }
  ) =>
    adminFetch<{ user_id: string; session_id: string; archived: boolean }>(
      `/copilot/students/${studentId}/queue-archive`,
      { method: "DELETE", body }
    ),

  getCopilotStudentDrafts: (
    studentId: string,
    params?: { session_id?: string; auto_create?: boolean }
  ) => {
    const search = new URLSearchParams();
    if (params?.session_id) search.set("session_id", params.session_id);
    if (params?.auto_create === false) search.set("auto_create", "false");
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<CopilotStudentDraftsResponse & { latest_sent_draft_id?: string | null }>(
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
      latest_sent_draft_id:
        typeof res.latest_sent_draft_id === "string"
          ? res.latest_sent_draft_id
          : res.latest_sent_draft_id === null
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
    ).then((res) => {
      const record = asRecord(res.audit);
      return {
        audit: record ? normalizeCopilotStudentDraft(record) : null,
      };
    });
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

  approveSendCopilotDraft: (studentId: string, draftId: string, body?: { session_id?: string; idempotency_key?: string }) =>
    adminFetch<Record<string, unknown>>(
      `/copilot/students/${studentId}/drafts/${draftId}/approve-send`,
      { method: "POST", body: body ?? {} }
    ).then((res) => {
      const raw = res as Record<string, unknown>;
      const draftRec = raw.draft;
      return {
        ...res,
        email_failed_but_unlocked: typeof raw.email_failed_but_unlocked === "boolean" ? raw.email_failed_but_unlocked : false,
        draft:
          draftRec && typeof draftRec === "object" && !Array.isArray(draftRec)
            ? normalizeCopilotStudentDraft(draftRec as Record<string, unknown>)
            : undefined,
      };
    }),

  getCopilotDraftPipelineStatus: (studentId: string, draftId: string) =>
    adminFetch<unknown>(`/students/${studentId}/drafts/${draftId}/pipeline-status`, { cache: "no-store" }).then(
      normalizeAdminCopilotDraftPipelineStatus
    ),

  retryCopilotAssignmentEmail: (studentId: string, draftId: string) =>
    adminFetch<{ status?: string; draft?: CopilotStudentDraft; email_failed_but_unlocked?: boolean }>(
      `/copilot/students/${studentId}/drafts/${draftId}/retry-assignment-email`,
      { method: "POST", body: {} }
    ).then((res) => {
      const raw = res as Record<string, unknown>;
      const d = raw.draft;
      return {
        ...res,
        draft:
          d && typeof d === "object" && !Array.isArray(d)
            ? normalizeCopilotStudentDraft(d as Record<string, unknown>)
            : undefined,
      };
    }),

  getCopilotDraftFeedbackVideoUrl: (studentId: string, draftId: string) =>
    adminFetch<{ video_url?: string | null; feedback_video_url?: string | null }>(
      `/students/${studentId}/drafts/${draftId}/feedback-video-url`
    ),

  getCopilotReferenceVideos: (params?: {
    limit?: number;
    offset?: number;
    include_preview_url?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    if (typeof params?.include_preview_url === "boolean") {
      search.set("include_preview_url", params.include_preview_url ? "true" : "false");
    }
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<Record<string, unknown>>(`/copilot/reference-videos${suffix}`).then((res) => {
      const list = Array.isArray((res as { reference_videos?: unknown[] }).reference_videos)
        ? ((res as { reference_videos?: unknown[] }).reference_videos as Array<Record<string, unknown>>)
        : [];
      const normalized: AdminCopilotReferenceVideo[] = [];
      for (const item of list) {
        const id = asTrimmedString(item.id);
        if (!id) continue;
        const tagsRaw = item.reference_tags;
        const tags = Array.isArray(tagsRaw)
          ? tagsRaw.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
          : typeof tagsRaw === "string"
            ? tagsRaw
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
            : null;
        normalized.push({
          id,
          user_id: asTrimmedString(item.user_id),
          session_id: asTrimmedString(item.session_id),
          draft_id: asTrimmedString(item.draft_id),
          title: asTrimmedString(item.title),
          original_filename: asTrimmedString(item.original_filename),
          reference_tags: tags,
          is_universal_video: typeof item.is_universal_video === "boolean" ? item.is_universal_video : false,
          created_at: asTrimmedString(item.created_at),
          transcription_status: asTrimmedString(item.transcription_status),
          transcription_error: asTrimmedString(item.transcription_error),
          transcript_text: asTrimmedString(item.transcript_text),
          preview_url: asTrimmedString(item.preview_url),
        });
      }
      return {
        reference_videos: normalized,
        total: asNumber((res as { total?: unknown }).total) ?? normalized.length,
        limit: asNumber((res as { limit?: unknown }).limit) ?? params?.limit ?? normalized.length,
        offset: asNumber((res as { offset?: unknown }).offset) ?? params?.offset ?? 0,
      } satisfies AdminCopilotReferenceVideosResponse;
    });
  },

  uploadCopilotReferenceVideo: (formData: FormData) =>
    uploadCopilotReferenceVideoWithProgress(formData),

  getCopilotReferenceVideoPlaybackUrl: (referenceVideoId: string, expiresIn = 3600) => {
    const search = new URLSearchParams();
    search.set("expires_in", String(expiresIn));
    return adminFetch<{ signed_url?: string | null; expires_in?: number }>(
      `/copilot/reference-videos/${referenceVideoId}/playback-url?${search.toString()}`
    );
  },

  attachReferenceVideoToCopilotDraft: (
    studentId: string,
    draftId: string,
    referenceVideoId: string
  ) =>
    adminFetch<Record<string, unknown>>(
      `/copilot/students/${studentId}/drafts/${draftId}/attach-reference-video`,
      {
        method: "POST",
        body: { reference_video_id: referenceVideoId },
      }
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
    source_type?: "student" | "internet" | "all";
    label_state?: "all" | "labeled" | "unlabeled";
    recording_id?: string;
    sort?: "newest" | "oldest";
    exclude_queue_skipped?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.source_type) search.set("source_type", params.source_type);
    if (params?.label_state) search.set("label_state", params.label_state);
    if (params?.recording_id) search.set("recording_id", params.recording_id);
    if (params?.sort) search.set("sort", params.sort);
    if (typeof params?.exclude_queue_skipped === "boolean") {
      search.set("exclude_queue_skipped", params.exclude_queue_skipped ? "true" : "false");
    }
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<StressSnippetListResponse>(`/stress-snippets${suffix}`).then((res) => ({
      snippets: Array.isArray(res.snippets) ? res.snippets : [],
      source_type: res.source_type ?? params?.source_type ?? "all",
      label_state: res.label_state ?? params?.label_state ?? "all",
      sort: res.sort ?? params?.sort ?? "newest",
      exclude_queue_skipped: Boolean(res.exclude_queue_skipped),
      limit: typeof res.limit === "number" ? res.limit : params?.limit ?? 0,
      offset: typeof res.offset === "number" ? res.offset : params?.offset ?? 0,
      count: typeof res.count === "number" ? res.count : (res.snippets?.length ?? 0),
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
      runtime_key: res.settings?.runtime_key,
      raw_value: res.settings?.raw_value ?? null,
    })),

  updateStressSnippetSettings: (autoExtractEnabled: boolean) =>
    adminFetch<{ settings?: StressSnippetSettings; auto_extract_enabled?: boolean }>(
      "/stress-snippets/settings",
      { method: "PUT", body: { auto_extract_enabled: autoExtractEnabled } }
    ).then((res) => ({
      auto_extract_enabled:
        typeof res.settings?.auto_extract_enabled === "boolean"
          ? res.settings.auto_extract_enabled
          : Boolean(res.auto_extract_enabled),
    })),

  generateStressSnippets: (
    recordingId: string,
    body?: { max_snippets?: number; clip_seconds?: number; clear_existing?: boolean }
  ) =>
    adminFetch<{
      generated_count?: number;
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

  unlabelStressSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: StressSnippet }>(`/stress-snippets/${snippetId}/label`, {
      method: "DELETE",
    }),

  queueSkipStressSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: StressSnippet }>(
      `/stress-snippets/${snippetId}/queue-skip`,
      { method: "POST" }
    ),

  queueUnskipStressSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: StressSnippet }>(
      `/stress-snippets/${snippetId}/queue-unskip`,
      { method: "POST" }
    ),

  getStressSnippetPlaybackUrl: (snippetId: string) =>
    adminFetch<{ playback_url: string | null; expires_at?: string; snippet_id?: string }>(
      `/stress-snippets/${snippetId}/playback-url`
    ),

  // ─── Charisma snippets ───────────────────────────────────────────────────
  // Mirror of stress-snippet methods against /charisma-snippets/* endpoints.
  listCharismaSnippets: (params?: {
    source_type?: "student" | "internet" | "all";
    label_state?: "all" | "labeled" | "unlabeled";
    recording_id?: string;
    sort?: "newest" | "oldest";
    exclude_queue_skipped?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.source_type) search.set("source_type", params.source_type);
    if (params?.label_state) search.set("label_state", params.label_state);
    if (params?.recording_id) search.set("recording_id", params.recording_id);
    if (params?.sort) search.set("sort", params.sort);
    if (typeof params?.exclude_queue_skipped === "boolean") {
      search.set("exclude_queue_skipped", params.exclude_queue_skipped ? "true" : "false");
    }
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));
    if (typeof params?.offset === "number") search.set("offset", String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return adminFetch<CharismaSnippetListResponse>(`/charisma-snippets${suffix}`).then((res) => ({
      snippets: Array.isArray(res.snippets) ? res.snippets : [],
      source_type: res.source_type ?? params?.source_type ?? "all",
      label_state: res.label_state ?? params?.label_state ?? "all",
      sort: res.sort ?? params?.sort ?? "newest",
      exclude_queue_skipped: Boolean(res.exclude_queue_skipped),
      limit: typeof res.limit === "number" ? res.limit : params?.limit ?? 0,
      offset: typeof res.offset === "number" ? res.offset : params?.offset ?? 0,
      count: typeof res.count === "number" ? res.count : (res.snippets?.length ?? 0),
    }));
  },

  getCharismaSnippetSettings: () =>
    adminFetch<{ settings?: CharismaSnippetSettings; auto_extract_enabled?: boolean }>(
      "/charisma-snippets/settings"
    ).then((res) => ({
      auto_extract_enabled:
        typeof res.settings?.auto_extract_enabled === "boolean"
          ? res.settings.auto_extract_enabled
          : Boolean(res.auto_extract_enabled),
      runtime_key: res.settings?.runtime_key,
      raw_value: res.settings?.raw_value ?? null,
    })),

  updateCharismaSnippetSettings: (autoExtractEnabled: boolean) =>
    adminFetch<{ settings?: CharismaSnippetSettings; auto_extract_enabled?: boolean }>(
      "/charisma-snippets/settings",
      { method: "PUT", body: { auto_extract_enabled: autoExtractEnabled } }
    ).then((res) => ({
      auto_extract_enabled:
        typeof res.settings?.auto_extract_enabled === "boolean"
          ? res.settings.auto_extract_enabled
          : Boolean(res.auto_extract_enabled),
    })),

  generateCharismaSnippets: (
    recordingId: string,
    body?: { max_snippets?: number; clip_seconds?: number; clear_existing?: boolean }
  ) =>
    adminFetch<{
      generated_count?: number;
      status?: string;
      snippets?: CharismaSnippet[];
    }>(`/recordings/${recordingId}/charisma-snippets/generate`, { method: "POST", body: body ?? {} }),

  labelCharismaSnippet: (
    snippetId: string,
    body: { label: "charisma" | "no_charisma"; notes?: string | null }
  ) =>
    adminFetch<{ status?: string; snippet?: CharismaSnippet }>(
      `/charisma-snippets/${snippetId}/label`,
      { method: "PATCH", body }
    ),

  unlabelCharismaSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: CharismaSnippet }>(
      `/charisma-snippets/${snippetId}/label`,
      { method: "DELETE" }
    ),

  queueSkipCharismaSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: CharismaSnippet }>(
      `/charisma-snippets/${snippetId}/queue-skip`,
      { method: "POST" }
    ),

  queueUnskipCharismaSnippet: (snippetId: string) =>
    adminFetch<{ status?: string; snippet?: CharismaSnippet }>(
      `/charisma-snippets/${snippetId}/queue-unskip`,
      { method: "POST" }
    ),

  getCharismaSnippetPlaybackUrl: (snippetId: string) =>
    adminFetch<{ playback_url: string | null; expires_at?: string; snippet_id?: string }>(
      `/charisma-snippets/${snippetId}/playback-url`
    ),

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

  /**
   * Admin-only: upload a curated audio file for a student. Backend creates a fresh
   * v2 homework session, stores the audio, and runs the same analysis pipeline as
   * a live recording (Whisper, sniper metrics, recommendation classifier).
   * Used to calibrate the recommendation engine against reference audio.
   */
  uploadStudentRecording: (
    userId: string,
    audioFile: File,
    opts?: { durationSeconds?: number; signal?: AbortSignal }
  ) => {
    const form = new FormData();
    form.append("audio_file", audioFile);
    if (opts?.durationSeconds != null) {
      form.append("duration_seconds", String(opts.durationSeconds));
    }
    return adminFetch<{
      status: "ok";
      session_id: string;
      recording_id: string;
      storage_path: string;
      message: string;
    }>(`/students/${userId}/sessions/upload-recording`, {
      method: "POST",
      body: form,
      ...(opts?.signal ? { signal: opts.signal } : {}),
    });
  },

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
