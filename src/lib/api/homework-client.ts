/**
 * Homework flow API client — calls BFF /api/homework/* (proxied to backend /v2/homework/*).
 * Backend may not implement these endpoints yet; 404/501 will surface as errors.
 */
import type {
  HomeworkStartResponse,
  HomeworkSessionStatus,
  HomeworkRecording1Response,
  HomeworkMetricAnswersResponse,
  HomeworkRecording2Response,
  HomeworkQuestionsResponse,
  HomeworkPostAnswersResponse,
  HomeworkReportResponse,
  TaskBlockV2,
} from "@/lib/api/types-homework";
async function getAuthFetchOptions(
  extra: Record<string, string> = {}
): Promise<{ headers: Record<string, string>; credentials: RequestCredentials }> {
  const headers = { ...extra };
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    } catch {
      // ignore
    }
  }
  return { headers, credentials: "include" };
}

/** Thrown when API returns 422 or other error; may have .code (e.g. NO_WARMUP_CONFIGURED, VALIDATION_ERROR). 409 may include .backendStatus and .hint from response body. */
export type HomeworkApiError = Error & {
  code?: string;
  status?: number;
  backendStatus?: string;
  hint?: string;
  details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
};

async function parseErrorBody(res: Response): Promise<{ message: string; code?: string; status?: string; hint?: string; details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number } }> {
  try {
    const body = (await res.json()) as {
      error?: string;
      message?: string;
      code?: string;
      status?: string;
      hint?: string;
      details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
    };
    let message =
      body.error || body.message || res.statusText || `Request failed ${res.status}`;
    const code = body.code;
    const status = body.status;
    const hint = body.hint;
    if (res.status === 422 && code === "RECORDING_DURATION_OUT_OF_RANGE" && body.details) {
      const d = body.details;
      const minMin = d.min_seconds != null ? Math.ceil(d.min_seconds / 60) : 1;
      const maxMin = d.max_seconds != null ? Math.floor(d.max_seconds / 60) : 5;
      message = `Recording must be between ${minMin} and ${maxMin} minutes. You recorded ${d.duration_seconds != null ? `${Math.round(d.duration_seconds)}s` : "too short"}. Please try again.`;
    }
    if (hint && res.status === 409) message = `${message} ${hint}`;
    return { message, code, status, hint, details: body.details };
  } catch {
    return { message: res.statusText || `Request failed ${res.status}` };
  }
}

/** Safe parse: empty or non-JSON body won't throw; returns {} so 200 doesn't stick UI. */
async function safeParseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || !text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const { message, code, status, hint, details } = await parseErrorBody(res);
    if (res.status === 409 && typeof window !== "undefined") {
      console.warn("[HomeworkFlow] 409 from API", { message, code, status });
    }
    if (res.status === 404) {
      const fallback = "Homework flow is not available yet. Please try again later.";
      const useBackend = message?.trim() && message !== "Not Found" && !message.startsWith("Request failed ");
      const err = new Error(useBackend ? message : fallback) as HomeworkApiError;
      if (code) err.code = code;
      err.status = 404;
      throw err;
    }
    const err = new Error(message) as HomeworkApiError;
    if (code) err.code = code;
    if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
    if (res.status === 409 && status) err.backendStatus = status;
    if (hint) err.hint = hint;
    if (details) err.details = details as HomeworkApiError["details"];
    throw err;
  }
  return safeParseJson<T>(res);
}

const BASE = "/api/homework";

export const homeworkApi = {
  /** Start homework session; returns warm-up task text. */
  async start(): Promise<HomeworkStartResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/start`, { method: "POST", headers, body: "{}", credentials });
    return handleResponse<HomeworkStartResponse>(res);
  },

  /** Abandon the current session so it is no longer active; user can start a new session. Returns 200, 400/409 (already completed/abandoned), or 404 (session not found) — all treated as success so the UI can redirect to step 0. */
  async abandonSession(sessionId: string): Promise<{ abandoned: boolean; message?: string }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/abandon`, {
      method: "POST",
      headers,
      body: "{}",
      credentials,
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({})) as { abandoned?: boolean; message?: string };
      return { abandoned: body.abandoned ?? true, message: body.message ?? "Session already completed or abandoned." };
    }
    if (res.status === 404) {
      return { abandoned: true, message: "Session not found or already cleared." };
    }
    if (res.status === 500 || res.status === 503) {
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      return {
        abandoned: true,
        message: body.message ?? body.error ?? "Server error; you can start a new session.",
      };
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      const msg = (body.message ?? body.error ?? "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("abandoned") ||
        msg.includes("completed") ||
        msg.includes("not found") ||
        msg.includes("no active session")
      ) {
        return { abandoned: true, message: body.message ?? body.error ?? "Session already abandoned or completed." };
      }
    }
    // Any other non-OK (e.g. 401, 403, 502): treat as success so the UI always clears and user can start a new session
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      return {
        abandoned: true,
        message: body.message ?? body.error ?? "Session cleared. You can start a new session.",
      };
    }
    return handleResponse<{ abandoned: boolean; message?: string }>(res);
  },

  /** List current user's completed sessions (for Reports History list). Returns [] if backend does not implement. */
  async getSessions(): Promise<{
    sessions: Array<{
      id: string;
      created_at?: string;
      status?: string;
      coach_grade?: number | null;
      recording_id?: string;
      recording_1_id?: string;
      report_preview?: { report_text_preview?: string };
    }>;
  }> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/sessions`, { method: "GET", headers, credentials });
    if (res.status === 404 || res.status === 501) return { sessions: [] };
    if (!res.ok) throw new Error((await parseErrorBody(res)).message);
    const data = await res.json().catch(() => ({}));
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    return { sessions };
  },

  /** Get current session status (for resuming). Returns session_id, optional status, recording IDs, and restored payload to derive step. */
  async getStatus(): Promise<HomeworkSessionStatus | null> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/status`, { method: "GET", headers, credentials });
    if (res.status === 404) return null;
    if (!res.ok) {
      const { message, code } = await parseErrorBody(res);
      const err = new Error(message) as HomeworkApiError;
      if (code) err.code = code;
      if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
      throw err;
    }
    return safeParseJson<HomeworkSessionStatus | null>(res);
  },

  /** Step 2 removed: no-op to avoid 404 from old/cached bundles. Do not call; flow goes 0 → 1 → 5. */
  async getTaskBlock(_sessionId: string): Promise<{ task_block: TaskBlockV2 }> {
    return { task_block: {} };
  },

  /** Get upload target for a recording. Backend returns upload_url (signed) + storage_path when signed; else bucket + storage_path for SDK upload. Or already_past_step + task_block when session already at step 2 (recording "1" only). */
  async getRecordingUploadUrl(
    sessionId: string,
    recording: "1" | "2",
    signal?: AbortSignal
  ): Promise<
    | { upload_url: string; storage_path: string }
    | { bucket: string; storage_path: string }
    | { already_past_step: true; status?: string; task_block: TaskBlockV2 }
  > {
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] getRecordingUploadUrl", { recording, sessionId: sessionId?.slice(0, 8) + "…" });
    }
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/recording-upload-url`, {
      method: "POST",
      headers,
      body: JSON.stringify({ recording }),
      signal,
      credentials,
    });
    const body = await safeParseJson<{
      bucket?: string | null;
      storage_path?: string | null;
      upload_url?: string;
      already_past_step?: boolean;
      already_submitted?: boolean;
      status?: string;
      task_block?: TaskBlockV2;
    }>(res);
    if (res.status === 409) {
      return { already_past_step: true, status: body.status, task_block: (body.task_block ?? {}) as TaskBlockV2 };
    }
    if (!res.ok) return handleResponse<never>(res) as Promise<never>;
    if (body.already_past_step === true && body.task_block) {
      return { already_past_step: true, status: body.status, task_block: body.task_block };
    }
    if (body.already_submitted === true) {
      // Backend "already past recording 1" (200 + storage_path: null): skip upload, advance to step 2
      return { already_past_step: true, status: body.status, task_block: (body.task_block ?? {}) as TaskBlockV2 };
    }
    if (body.upload_url && body.storage_path) {
      return { upload_url: body.upload_url, storage_path: body.storage_path };
    }
    if (body.bucket && body.storage_path) {
      return { bucket: body.bucket, storage_path: body.storage_path };
    }
    throw new Error("Invalid recording-upload-url response");
  },

  /** Upload blob: PUT to upload_url when present, else Supabase SDK with bucket + storage_path. Returns storage_path for the recording-1/2 POST. */
  async uploadBlob(
    result: { upload_url: string; storage_path: string } | { bucket: string; storage_path: string },
    blob: Blob,
    signal?: AbortSignal
  ): Promise<string> {
    const storage_path = result.storage_path;
    // Strip codec suffix (e.g. "audio/webm;codecs=opus" → "audio/webm") so the Content-Type
    // exactly matches what the storage backend signed or provisioned. S3 and GCS signed URLs
    // do a strict content-type match and reject requests with extra parameters.
    const baseContentType = (blob.type || "audio/webm").split(";")[0].trim() || "audio/webm";

    if ("upload_url" in result && result.upload_url) {
      console.info("[HomeworkFlow] uploadBlob PUT", { storage_path, contentType: baseContentType, blobSize: blob.size });
      const putRes = await fetch(result.upload_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": baseContentType },
        signal,
      });
      if (!putRes.ok) {
        const detail = await putRes.text().catch(() => "");
        console.error("[HomeworkFlow] uploadBlob PUT failed", { status: putRes.status, detail });
        throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
      }
      console.info("[HomeworkFlow] uploadBlob PUT success", { storage_path });
      return storage_path;
    }
    if (!("bucket" in result) || !result.bucket) throw new Error("Invalid recording-upload-url response");
    const { bucket } = result;
    console.info("[HomeworkFlow] uploadBlob Supabase", { bucket, storage_path, contentType: baseContentType, blobSize: blob.size });
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storage_path, blob, {
      contentType: baseContentType,
      upsert: true,
    });
    if (uploadError) {
      console.error("[HomeworkFlow] uploadBlob Supabase failed", uploadError);
      throw new Error(uploadError.message);
    }
    console.info("[HomeworkFlow] uploadBlob Supabase success", { storage_path });
    return storage_path;
  },

  /** Upload recording_1 (warm-up): get upload target → upload blob (PUT to upload_url or SDK bucket+storage_path) → POST recording-1 with JSON { storage_path, duration_seconds }. Returns alreadyAtStep2 + task_block when backend responds 200 with already_past_step (session already at step 2). */
  async uploadRecording1(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal
  ): Promise<
    | HomeworkRecording1Response
    | { alreadyAtStep2: true; task_block: TaskBlockV2; status?: string }
  > {
    console.info("[HomeworkFlow] uploadRecording1 start", { sessionId: sessionId.slice(0, 8) + "…", blobSize: blob.size, blobType: blob.type, durationSeconds });
    const uploadUrlResult = await this.getRecordingUploadUrl(sessionId, "1", signal);
    if ("already_past_step" in uploadUrlResult && uploadUrlResult.already_past_step && uploadUrlResult.task_block) {
      console.info("[HomeworkFlow] uploadRecording1 already_past_step — skipping blob upload");
      return {
        alreadyAtStep2: true,
        task_block: uploadUrlResult.task_block,
        status: uploadUrlResult.status,
      };
    }
    const uploadTarget = uploadUrlResult as
      | { upload_url: string; storage_path: string }
      | { bucket: string; storage_path: string };
    const storage_path = await this.uploadBlob(uploadTarget, blob, signal);
    console.info("[HomeworkFlow] uploadRecording1 POSTing recording-1", { storage_path, durationSeconds });
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/recording-1`, {
      method: "POST",
      headers,
      body: JSON.stringify({ storage_path, duration_seconds: durationSeconds }),
      signal,
      credentials,
    });
    console.info("[HomeworkFlow] uploadRecording1 recording-1 response", { status: res.status });
    return handleResponse<HomeworkRecording1Response>(res);
  },

  /** Submit metric question answers (3); returns final task for recording_2. Backend may be slow (LLM); 70s timeout. */
  async submitMetricAnswers(
    sessionId: string,
    body: { metric_answer_1: string; metric_answer_2: string; metric_answer_3: string }
  ): Promise<HomeworkMetricAnswersResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70_000);
    try {
      const res = await fetch(`${BASE}/session/${sessionId}/metric-answers`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials,
        signal: controller.signal,
      });
      return await handleResponse<HomeworkMetricAnswersResponse>(res);
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Upload recording_2: get upload target → upload blob (PUT to upload_url or SDK bucket+storage_path) → POST recording-2 with JSON { storage_path, duration_seconds }. */
  async uploadRecording2(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal
  ): Promise<HomeworkRecording2Response> {
    const uploadUrlResult = await this.getRecordingUploadUrl(sessionId, "2", signal);
    const uploadTarget = uploadUrlResult as
      | { upload_url: string; storage_path: string }
      | { bucket: string; storage_path: string };
    const storage_path = await this.uploadBlob(uploadTarget, blob, signal);
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/recording-2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ storage_path, duration_seconds: durationSeconds }),
      signal,
      credentials,
    });
    return handleResponse<HomeworkRecording2Response>(res);
  },

  /** Get post-recording questions (may be empty). */
  async getQuestions(sessionId: string): Promise<HomeworkQuestionsResponse> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/questions`, { headers, credentials });
    return handleResponse<HomeworkQuestionsResponse>(res);
  },

  /** Submit post answers and get report. Pass answers: [] if no questions. */
  async submitPostAnswers(
    sessionId: string,
    answers: Array<{ question_id: string; answer_text: string }>
  ): Promise<HomeworkPostAnswersResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/post-answers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ answers }),
      credentials,
    });
    return handleResponse<HomeworkPostAnswersResponse>(res);
  },

  /** Get report for completed session (step 5): report_text, scores, final_recording with fresh audio_url. */
  async getReport(sessionId: string): Promise<HomeworkReportResponse> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/report`, { method: "GET", headers, credentials });
    return handleResponse<HomeworkReportResponse>(res);
  },

  /** Get fresh signed playback URL for a recording (e.g. when report audio_url expired). */
  async getRecordingPlaybackUrl(recordingId: string): Promise<{ audio_url: string }> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`/api/recordings/${recordingId}/playback-url`, { method: "GET", headers, credentials });
    return handleResponse<{ audio_url: string }>(res);
  },

  /**
   * Submit self-rating (1–10). Returns backend response; if session_completed is false, call again after job is done.
   */
  async submitSelfRating(sessionId: string, rating: number): Promise<SelfRatingResponse> {
    const r = Math.round(rating);
    if (r < 1 || r > 10) return { status: "ok", session_completed: false };
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/self-rating`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rating: r }),
      credentials,
    });
    if (!res.ok) {
      const { message } = await parseErrorBody(res).catch(() => ({ message: res.statusText }));
      throw new Error(message || `Self-rating failed (${res.status})`);
    }
    const body = await safeParseJson<SelfRatingResponse>(res);
    return { ...body, status: "ok", session_completed: body?.session_completed === true, student_rating_1_10: r };
  },

  /**
   * Record that the user skipped self-rating. Returns backend response; if session_completed is false, call again after job is done.
   */
  async submitSelfRatingSkipped(sessionId: string): Promise<SelfRatingResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/self-rating`, {
      method: "POST",
      headers,
      body: JSON.stringify({ skipped: true }),
      credentials,
    });
    if (!res.ok) {
      const { message } = await parseErrorBody(res).catch(() => ({ message: res.statusText }));
      throw new Error(message || `Could not save skip (${res.status})`);
    }
    const body = await safeParseJson<SelfRatingResponse>(res);
    return { ...body, status: "ok", session_completed: body?.session_completed === true, skipped: true };
  },
};

/** Response from POST .../self-rating. If session_completed is false, backend is still processing; call self-rating again after job completes. */
export interface SelfRatingResponse {
  status?: string;
  session_completed: boolean;
  student_rating_1_10?: number;
  skipped?: true;
}
