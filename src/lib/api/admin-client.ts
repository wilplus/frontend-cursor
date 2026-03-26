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
    };
    const msg =
      err.error || err.message || err.code || err.details || `HTTP ${res.status} for ${path}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
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
  sniper_profile?: StudentSniperProgress | null;
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
  sessions: Array<{
    id: string;
    created_at: string;
    completed_at?: string | null;
    status: string;
    recording_id?: string;
    report_id?: string;
    report_delivered?: boolean | null;
    student_completion_email_sent_at?: string | null;
    task_score?: number;
    /** Report grade 1–10 or null (not graded). */
    report_grade?: number | null;
    /** Optional short coach message attached to session grade. */
    coach_message?: string | null;
    recording_preview?: { performance_score_v2?: number; transcription_preview?: string };
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
  updated_at?: string | null;
}

export interface SendAssignmentResponse {
  status: string;
  sent?: boolean | null;
  realtime_level?: number | null;
  realtime_step?: number | null;
  sniper_profile?: StudentSniperProgress | null;
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
}

/** Full report for a completed session (admin modal). Aligns with homework report; extra fields optional. */
export interface AdminSessionReportResponse {
  report_text: string;
  scores: { warmup: number; final: number; overall: number };
  final_recording: { id: string | null; audio_url: string | null };
  recording?: AdminReportRecording | null;
  transcript?: string | null;
  filler_word_count?: number | null;
  strength_metric?: string | null;
  pace_metric?: string | null;
  coach_insight?: string | null;
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

export interface Exercise {
  id: string;
  title: string;
  video_url?: string | null;
  description?: string | null;
  min_task_score?: number;
  max_task_score?: number;
  is_active?: boolean;
  created_at?: string;
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

/** Warm-up task (per student); for homework flow. When assigned from pool, has pool_task_id. */
export interface WarmUpTask {
  id: string;
  user_id: string;
  text: string;
  order_index?: number;
  /** 0-1; used to select warm-up by student's last performance_score_end. */
  max_performance_score?: number;
  /** When assigned from pool, references v2_warm_up_task_pool.id. */
  pool_task_id?: string | null;
  created_at?: string;
}

/** Global warm-up task pool item (no user_id). */
export interface WarmUpPoolTask {
  id: string;
  text: string;
  order_index?: number;
  max_performance_score?: number;
  created_at?: string;
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

export const adminApi = {
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

  /** Optional body: { video_url?, video_description? }. Only keys with non-empty values are sent. Used in assignment email. */
  sendAssignment: (userId: string, body?: { video_url?: string; video_description?: string }) =>
    adminFetch<SendAssignmentResponse>(`/students/${userId}/send-assignment`, {
      method: "POST",
      ...(body && Object.keys(body).length > 0 ? { body } : {}),
    }),

  getWarmUpTasks: (userId: string) =>
    adminFetch<{ task_warm_up: WarmUpTask[] }>(`/students/${userId}/task-warm-up`).then((r) => r.task_warm_up ?? []),

  /** Sync student's warm-up tasks from pool. Body: { pool_task_ids: string[] }. */
  putStudentWarmUpTasksSync: (userId: string, body: { pool_task_ids: string[] }) =>
    adminFetch<{ task_warm_up: WarmUpTask[] }>(`/students/${userId}/task-warm-up`, { method: "PUT", body }),

  createWarmUpTask: (userId: string, data: { text: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_warm_up: WarmUpTask }>(`/students/${userId}/task-warm-up`, { method: "POST", body: data }),

  updateWarmUpTask: (userId: string, taskId: string, data: { text?: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_warm_up: WarmUpTask }>(`/students/${userId}/task-warm-up/${taskId}`, { method: "PUT", body: data }),

  deleteWarmUpTask: (userId: string, taskId: string) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/task-warm-up/${taskId}`, { method: "DELETE" }),

  getWarmUpTaskPool: () =>
    adminFetch<{ task_warm_up_pool?: WarmUpPoolTask[] }>("/task-warm-up-pool").then((r) =>
      Array.isArray(r.task_warm_up_pool) ? r.task_warm_up_pool : []
    ),

  createWarmUpPoolTask: (data: { text: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_warm_up: WarmUpPoolTask }>("/task-warm-up-pool", { method: "POST", body: data }),

  updateWarmUpPoolTask: (poolId: string, data: { text?: string; order_index?: number; max_performance_score?: number }) =>
    adminFetch<{ task_warm_up: WarmUpPoolTask }>(`/task-warm-up-pool/${poolId}`, { method: "PUT", body: data }),

  deleteWarmUpPoolTask: (poolId: string) =>
    adminFetch<Record<string, unknown>>(`/task-warm-up-pool/${poolId}`, { method: "DELETE" }),

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

  getExercises: () =>
    adminFetch<{ exercises: Exercise[] }>("/exercises").then((r) => r.exercises ?? []),

  createExercise: (data: Partial<Exercise>) =>
    adminFetch<{ exercise: Exercise }>("/exercises", { method: "POST", body: data }),

  updateExercise: (id: string, data: Partial<Exercise>) =>
    adminFetch<{ exercise: Exercise }>(`/exercises/${id}`, { method: "PUT", body: data }),

  deleteExercise: (id: string) =>
    adminFetch<{ status: string }>(`/exercises/${id}`, { method: "DELETE" }),

  getTasks: () =>
    adminFetch<{ tasks: Task[] }>("/tasks").then((r) => r.tasks ?? []),

  createTask: (data: Partial<Task>) =>
    adminFetch<{ task: Task }>("/tasks", { method: "POST", body: data }),

  updateTask: (id: string, data: Partial<Task>) =>
    adminFetch<{ task: Task }>(`/tasks/${id}`, { method: "PUT", body: data }),

  deleteTask: (id: string) =>
    adminFetch<{ status: string }>(`/tasks/${id}`, { method: "DELETE" }),

  /** Pool of post-recording questions (global). */
  getPostRecordingQuestionsPool: () =>
    adminFetch<{ post_recording_questions_pool?: PostQuestion[] }>("/post-recording-questions-pool").then((r) =>
      Array.isArray(r.post_recording_questions_pool) ? r.post_recording_questions_pool : []
    ),

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

  createPostQuestion: (data: Partial<PostQuestion>) =>
    adminFetch<{ question: PostQuestion }>("/post-recording-questions-pool", { method: "POST", body: data }),

  updatePostQuestion: (id: string, data: Partial<PostQuestion>) =>
    adminFetch<{ question: PostQuestion }>(`/post-recording-questions-pool/${id}`, { method: "PUT", body: data }),

  deletePostQuestion: (id: string) =>
    adminFetch<{ status: string }>(`/post-recording-questions-pool/${id}`, { method: "DELETE" }),

  /** @deprecated Use getPostRecordingQuestionsPool. Kept for compatibility. */
  getPostQuestions: () =>
    adminFetch<{ post_recording_questions_pool?: PostQuestion[] }>("/post-recording-questions-pool").then((r) =>
      Array.isArray(r.post_recording_questions_pool) ? r.post_recording_questions_pool : []
    ),

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
};
