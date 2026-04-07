/**
 * Homework flow API client — calls BFF /api/homework/* (proxied to backend /v2/homework/*).
 * Backend may not implement these endpoints yet; 404/501 will surface as errors.
 */
import type {
  HomeworkStartResponse,
  HomeworkSessionStatus,
  HomeworkRecording1Response,
  HomeworkTaskAnswersResponse,
  HomeworkRecording2Response,
  HomeworkReportResponse,
  QuestionBlockV2,
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
  error?: string;
  backendStatus?: string;
  reason?: string;
  hint?: string;
  recording_1_processing_error_code?: string;
  details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
};

/**
 * Successful target from POST recording-upload-url (before uploading the blob).
 * When signed_url_available is true, do not PUT raw blob bytes to upload_url — use uploadToSignedUrl (if upload_token + bucket) or FormData PUT.
 */
export type HomeworkRecordingUploadTarget = {
  storage_path: string;
  bucket?: string | null;
  upload_url?: string | null;
  signed_url_available?: boolean;
  upload_token?: string | null;
};

async function parseErrorBody(res: Response): Promise<{ message: string; error?: string; code?: string; status?: string; reason?: string; hint?: string; recording_1_processing_error_code?: string; details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number } }> {
  try {
    const body = (await res.json()) as {
      error?: string;
      message?: string;
      code?: string;
      status?: string;
      reason?: string;
      hint?: string;
      recording_1_processing_error_code?: string;
      details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
    };
    let message =
      body.error || body.message || res.statusText || `Request failed ${res.status}`;
    const code = body.code;
    const status = body.status;
    const reason = body.reason;
    const hint = body.hint;
    const error = body.error;
    const recording_1_processing_error_code = body.recording_1_processing_error_code;
    if (res.status === 422 && code === "RECORDING_DURATION_OUT_OF_RANGE" && body.details) {
      const d = body.details;
      const minMin = d.min_seconds != null ? Math.ceil(d.min_seconds / 60) : 1;
      const maxMin = d.max_seconds != null ? Math.floor(d.max_seconds / 60) : 5;
      message = `Recording must be between ${minMin} and ${maxMin} minutes. You recorded ${d.duration_seconds != null ? `${Math.round(d.duration_seconds)}s` : "too short"}. Please try again.`;
    }
    if (hint && res.status === 409) message = `${message} ${hint}`;
    return { message, error, code, status, reason, hint, recording_1_processing_error_code, details: body.details };
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
    const { message, error, code, status, reason, hint, recording_1_processing_error_code, details } = await parseErrorBody(res);
    if (res.status === 409 && typeof window !== "undefined") {
      console.warn("[HomeworkFlow] 409 from API", { message, code, status });
    }
    if (res.status === 404) {
      const fallback = "Homework flow is not available yet. Please try again later.";
      const useBackend = message?.trim() && message !== "Not Found" && !message.startsWith("Request failed ");
      const err = new Error(useBackend ? message : fallback) as HomeworkApiError;
      if (code) err.code = code;
      err.status = 404;
      if (error) err.error = error;
      if (recording_1_processing_error_code) {
        err.recording_1_processing_error_code = recording_1_processing_error_code;
      }
      throw err;
    }
    const err = new Error(message) as HomeworkApiError;
    err.status = res.status;
    if (error) err.error = error;
    if (code) err.code = code;
    if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
    if (res.status === 409 && status) err.backendStatus = status;
    if (reason) err.reason = reason;
    if (hint) err.hint = hint;
    if (recording_1_processing_error_code) {
      err.recording_1_processing_error_code = recording_1_processing_error_code;
    }
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

  /** Leave the completed report screen and return the backend-owned step-0 state. */
  async leaveReport(sessionId: string): Promise<HomeworkSessionStatus> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/leave-report`, {
      method: "POST",
      headers,
      body: "{}",
      credentials,
    });
    return handleResponse<HomeworkSessionStatus>(res);
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
      completed_at?: string;
      status?: string;
      coach_grade?: number | null;
      recording_id?: string;
      report_id?: string;
      report_delivered?: boolean | null;
      student_completion_email_sent_at?: string | null;
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
      const { message, code, reason } = await parseErrorBody(res);
      const err = new Error(message) as HomeworkApiError;
      if (code) err.code = code;
      if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
      if (reason) err.reason = reason;
      throw err;
    }
    return safeParseJson<HomeworkSessionStatus | null>(res);
  },

  /** Legacy compatibility helper for the step-2 question block. Prefer GET status when possible. */
  async getQuestionBlock(sessionId: string): Promise<{ task_block: QuestionBlockV2 }> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/question-block`, { method: "GET", headers, credentials });
    return handleResponse<{ task_block: QuestionBlockV2 }>(res);
  },

  /** Get upload target for a recording. May include signed_url_available + upload_token for Supabase uploadToSignedUrl, or upload_url for PUT (FormData when signed). Or bucket + storage_path for SDK upload. Or already_past_step + task_block. */
  async getRecordingUploadUrl(
    sessionId: string,
    recording: "1" | "2",
    signal?: AbortSignal
  ): Promise<
    | HomeworkRecordingUploadTarget
    | { already_past_step: true; status?: string; task_block: QuestionBlockV2 }
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
      signed_url_available?: boolean;
      upload_token?: string | null;
      already_past_step?: boolean;
      already_submitted?: boolean;
      status?: string;
      task_block?: QuestionBlockV2;
    }>(res);
    if (res.status === 409) {
      return { already_past_step: true, status: body.status, task_block: (body.task_block ?? {}) as QuestionBlockV2 };
    }
    if (!res.ok) return handleResponse<never>(res) as Promise<never>;
    if (body.already_past_step === true && body.task_block) {
      return { already_past_step: true, status: body.status, task_block: body.task_block };
    }
    if (body.already_submitted === true) {
      // Backend "already past recording 1" (200 + storage_path: null): skip upload, advance to step 2
      return { already_past_step: true, status: body.status, task_block: (body.task_block ?? {}) as QuestionBlockV2 };
    }
    if (!body.storage_path || typeof body.storage_path !== "string" || !body.storage_path.trim()) {
      throw new Error("Invalid recording-upload-url response: missing storage_path");
    }
    const upload_token =
      typeof body.upload_token === "string" && body.upload_token.trim() ? body.upload_token.trim() : undefined;
    return {
      storage_path: body.storage_path.trim(),
      bucket: body.bucket ?? undefined,
      upload_url: body.upload_url?.trim() || undefined,
      signed_url_available: body.signed_url_available === true,
      upload_token,
    };
  },

  /** Upload blob per recording-upload-url contract: signed token → uploadToSignedUrl; signed URL → FormData PUT; legacy → raw PUT; else SDK upload. */
  async uploadBlob(target: HomeworkRecordingUploadTarget, blob: Blob, signal?: AbortSignal): Promise<string> {
    const storage_path = target.storage_path;
    // Strip codec suffix (e.g. "audio/webm;codecs=opus" → "audio/webm") so the Content-Type
    // exactly matches what the storage backend signed or provisioned. S3 and GCS signed URLs
    // do a strict content-type match and reject requests with extra parameters.
    const baseContentType = (blob.type || "audio/webm").split(";")[0].trim() || "audio/webm";
    const signed = target.signed_url_available === true;

    if (signed && target.upload_token && target.bucket) {
      console.info("[HomeworkFlow] uploadBlob uploadToSignedUrl", {
        storage_path,
        bucket: target.bucket,
        contentType: baseContentType,
        blobSize: blob.size,
      });
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.storage_path, target.upload_token, blob, {
          contentType: baseContentType,
        });
      if (uploadError) {
        console.error("[HomeworkFlow] uploadBlob uploadToSignedUrl failed", uploadError);
        throw new Error(uploadError.message);
      }
      console.info("[HomeworkFlow] uploadBlob uploadToSignedUrl success", { storage_path });
      return storage_path;
    }

    if (signed && target.upload_url) {
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");
      console.info("[HomeworkFlow] uploadBlob signed FormData PUT", { storage_path, blobSize: blob.size });
      const putRes = await fetch(target.upload_url, {
        method: "PUT",
        body: fd,
        signal,
      });
      if (!putRes.ok) {
        const detail = await putRes.text().catch(() => "");
        console.error("[HomeworkFlow] uploadBlob FormData PUT failed", { status: putRes.status, detail });
        throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
      }
      console.info("[HomeworkFlow] uploadBlob FormData PUT success", { storage_path });
      return storage_path;
    }

    if (target.upload_url) {
      console.info("[HomeworkFlow] uploadBlob raw PUT", { storage_path, contentType: baseContentType, blobSize: blob.size });
      const putRes = await fetch(target.upload_url, {
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

    if (target.bucket) {
      const bucket = target.bucket;
      console.info("[HomeworkFlow] uploadBlob Supabase SDK upload", { bucket, storage_path, contentType: baseContentType, blobSize: blob.size });
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
    }

    throw new Error("Invalid recording-upload-url response: no upload_url, bucket, or signed token");
  },

  /** Upload recording_1 (warm-up): get upload target → upload blob (PUT to upload_url or SDK bucket+storage_path) → POST recording-1 with JSON { storage_path, duration_seconds }. Returns alreadyAtStep2 + task_block when backend responds 200 with already_past_step. */
  async uploadRecording1(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal,
    transcriptText?: string,
    centerHoldRatio?: number,
    centerHoldMs?: number,
    totalActiveMs?: number
  ): Promise<
    | HomeworkRecording1Response
    | { alreadyAtStep2: true; task_block: QuestionBlockV2; status?: string }
  > {
    console.info("[HomeworkFlow] uploadRecording1 start", { sessionId: sessionId.slice(0, 8) + "…", blobSize: blob.size, blobType: blob.type, durationSeconds, hasTranscript: !!transcriptText });
    const uploadUrlResult = await this.getRecordingUploadUrl(sessionId, "1", signal);
    if ("already_past_step" in uploadUrlResult && uploadUrlResult.already_past_step && uploadUrlResult.task_block) {
      console.info("[HomeworkFlow] uploadRecording1 already_past_step — skipping blob upload");
      return {
        alreadyAtStep2: true,
        task_block: uploadUrlResult.task_block,
        status: uploadUrlResult.status,
      };
    }
    const uploadTarget = uploadUrlResult as HomeworkRecordingUploadTarget;
    const storage_path = await this.uploadBlob(uploadTarget, blob, signal);
    console.info("[HomeworkFlow] uploadRecording1 POSTing recording-1", { storage_path, durationSeconds, hasTranscript: !!transcriptText });
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const postBody: Record<string, unknown> = { storage_path, duration_seconds: durationSeconds };
    if (transcriptText) postBody.transcript_text = transcriptText;
    if (typeof centerHoldRatio === "number" && Number.isFinite(centerHoldRatio)) {
      postBody.center_hold_ratio = Math.max(0, Math.min(1, centerHoldRatio));
    }
    if (typeof centerHoldMs === "number" && Number.isFinite(centerHoldMs)) {
      postBody.center_hold_ms = Math.max(0, Math.round(centerHoldMs));
    }
    if (typeof totalActiveMs === "number" && Number.isFinite(totalActiveMs)) {
      postBody.total_active_ms = Math.max(0, Math.round(totalActiveMs));
    }
    const res = await fetch(`${BASE}/session/${sessionId}/recording-1`, {
      method: "POST",
      headers,
      body: JSON.stringify(postBody),
      signal,
      credentials,
    });
    console.info("[HomeworkFlow] uploadRecording1 recording-1 response", { status: res.status });
    return handleResponse<HomeworkRecording1Response>(res);
  },

  /** Submit the three step-2 answers; returns the final task for recording_2. Backend may be slow (LLM); 70s timeout. */
  async submitTaskAnswers(
    sessionId: string,
    body: { metric_answer_1: string; metric_answer_2: string; metric_answer_3: string }
  ): Promise<HomeworkTaskAnswersResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70_000);
    try {
      const res = await fetch(`${BASE}/session/${sessionId}/task-answers`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials,
        signal: controller.signal,
      });
      return await handleResponse<HomeworkTaskAnswersResponse>(res);
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Upload recording_2: get upload target → upload blob (PUT to upload_url or SDK bucket+storage_path) → POST recording-2 with JSON { storage_path, duration_seconds, center_hold_ratio? }. */
  async uploadRecording2(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal,
    centerHoldRatio?: number,
    centerHoldMs?: number,
    totalActiveMs?: number
  ): Promise<HomeworkRecording2Response> {
    const uploadUrlResult = await this.getRecordingUploadUrl(sessionId, "2", signal);
    if ("already_past_step" in uploadUrlResult && uploadUrlResult.already_past_step) {
      throw new Error("Recording 2 upload URL unavailable: session already past this step");
    }
    const uploadTarget = uploadUrlResult as HomeworkRecordingUploadTarget;
    const storage_path = await this.uploadBlob(uploadTarget, blob, signal);
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const postBody: Record<string, unknown> = { storage_path, duration_seconds: durationSeconds };
    if (typeof centerHoldRatio === "number" && Number.isFinite(centerHoldRatio)) {
      postBody.center_hold_ratio = Math.max(0, Math.min(1, centerHoldRatio));
    }
    if (typeof centerHoldMs === "number" && Number.isFinite(centerHoldMs)) {
      postBody.center_hold_ms = Math.max(0, Math.round(centerHoldMs));
    }
    if (typeof totalActiveMs === "number" && Number.isFinite(totalActiveMs)) {
      postBody.total_active_ms = Math.max(0, Math.round(totalActiveMs));
    }
    const res = await fetch(`${BASE}/session/${sessionId}/recording-2`, {
      method: "POST",
      headers,
      body: JSON.stringify(postBody),
      signal,
      credentials,
    });
    return handleResponse<HomeworkRecording2Response>(res);
  },

  /** Get report for completed session (step 5): report_text, scores, final_recording with fresh audio_url. */
  async getReport(sessionId: string): Promise<HomeworkReportResponse> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/report`, {
      method: "GET",
      headers,
      credentials,
      cache: "no-store",
    });
    return handleResponse<HomeworkReportResponse>(res);
  },

  /** Get fresh signed playback URL for a recording (e.g. when report audio_url expired). */
  async getRecordingPlaybackUrl(recordingId: string): Promise<{ audio_url: string }> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`/api/recordings/${recordingId}/playback-url`, { method: "GET", headers, credentials });
    return handleResponse<{ audio_url: string }>(res);
  },

  /**
   * Submit self-rating (1–5). Returns backend response; if session_completed is false, call again after job is done.
   */
  async submitSelfRating(sessionId: string, rating: number): Promise<SelfRatingResponse> {
    const r = Math.round(rating);
    if (r < 1 || r > 5) return { status: "ok", session_completed: false };
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/self-rating`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rating: r }),
      credentials,
    });
    const body = await handleResponse<SelfRatingResponse>(res);
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
    const body = await handleResponse<SelfRatingResponse>(res);
    return { ...body, status: "ok", session_completed: body?.session_completed === true, skipped: true };
  },
};

/** Response from POST .../self-rating. If session_completed is false, backend is still processing; call self-rating again after job completes. */
export interface SelfRatingResponse {
  status?: string;
  session_completed: boolean;
  /** Stored in the legacy backend field name, but current scale is 1-5. */
  student_rating_1_10?: number;
  skipped?: true;
  /** When backend transitions to final_task_ready, the final task prompt for recording 2. */
  final_task?: string | null;
}

/** Error payload from POST .../self-rating when recording processing fails. */
export interface SelfRatingProcessingFailedPayload {
  code: "RECORDING_PROCESSING_FAILED";
  error?: string;
  recording_1_processing_error_code?: string;
}
