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
  TaskBlockV2,
} from "@/lib/api/types-homework";
import { debugIngest } from "@/lib/debugIngest";

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

/** Thrown when API returns 422 or other error; may have .code (e.g. NO_WARMUP_CONFIGURED, VALIDATION_ERROR). 409 may include .backendStatus from response body. */
export type HomeworkApiError = Error & {
  code?: string;
  backendStatus?: string;
  details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
};

async function parseErrorBody(res: Response): Promise<{ message: string; code?: string; status?: string; details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number } }> {
  try {
    const body = (await res.json()) as {
      error?: string;
      message?: string;
      code?: string;
      status?: string;
      details?: { duration_seconds?: number; min_seconds?: number; max_seconds?: number };
    };
    let message =
      body.error || body.message || res.statusText || `Request failed ${res.status}`;
    const code = body.code;
    const status = body.status;
    if (res.status === 422 && code === "RECORDING_DURATION_OUT_OF_RANGE" && body.details) {
      const d = body.details;
      const minMin = d.min_seconds != null ? Math.ceil(d.min_seconds / 60) : 1;
      const maxMin = d.max_seconds != null ? Math.floor(d.max_seconds / 60) : 5;
      message = `Recording must be between ${minMin} and ${maxMin} minutes. You recorded ${d.duration_seconds != null ? `${Math.round(d.duration_seconds)}s` : "too short"}. Please try again.`;
    }
    return { message, code, status, details: body.details };
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
    const { message, code, status, details } = await parseErrorBody(res);
    if (res.status === 409 && typeof window !== "undefined") {
      console.warn("[HomeworkFlow] 409 from API", { message, code, status });
    }
    if (res.status === 404) {
      throw new Error("Homework flow is not available yet. Please try again later.");
    }
    const err = new Error(message) as HomeworkApiError;
    if (code) err.code = code;
    if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
    if (res.status === 409 && status) err.backendStatus = status;
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

  /** Abandon the current session so it is no longer active; user can start a new session. Returns 200 or 409 (already completed/abandoned). */
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
    return handleResponse<{ abandoned: boolean; message?: string }>(res);
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
    // 409 = conflict (e.g. wrong step). Treat as session state so UI refetches status and syncs step.
    if (res.status === 409 && !err.code) err.code = "INVALID_SESSION_STATE";
      throw err;
    }
    return safeParseJson<HomeworkSessionStatus | null>(res);
  },

  /** Get task-block for step 2 (e.g. when resuming). Returns task_block with 3 metric questions. */
  async getTaskBlock(sessionId: string): Promise<{ task_block: TaskBlockV2 }> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/task-block`, { headers, credentials });
    return handleResponse<{ task_block: TaskBlockV2 }>(res);
  },

  /** Get Supabase Storage upload target for a recording. Backend returns { bucket, storage_path }. */
  async getRecordingUploadUrl(
    sessionId: string,
    recording: "1" | "2",
    signal?: AbortSignal
  ): Promise<{ bucket: string; storage_path: string }> {
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
    return handleResponse<{ bucket: string; storage_path: string }>(res);
  },

  /** Upload recording_1 (warm-up): get upload URL → upload blob to Supabase Storage → POST recording-1 with JSON { storage_path, duration_seconds }. */
  async uploadRecording1(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal
  ): Promise<HomeworkRecording1Response> {
    const { bucket, storage_path } = await this.getRecordingUploadUrl(sessionId, "1", signal);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const contentType = blob.type || "audio/webm";
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storage_path, blob, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/recording-1`, {
      method: "POST",
      headers,
      body: JSON.stringify({ storage_path, duration_seconds: durationSeconds }),
      signal,
      credentials,
    });
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

  /** Upload recording_2: get upload URL → upload blob to Supabase Storage → POST recording-2 with JSON { storage_path, duration_seconds }. */
  async uploadRecording2(
    sessionId: string,
    blob: Blob,
    durationSeconds: number,
    signal?: AbortSignal
  ): Promise<HomeworkRecording2Response> {
    const { bucket, storage_path } = await this.getRecordingUploadUrl(sessionId, "2", signal);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const contentType = blob.type || "audio/webm";
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storage_path, blob, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    // #region agent log
    debugIngest("http://127.0.0.1:7243/ingest/a80925dc-2945-4903-8e64-721670fa17b4", { location: "homework-client.ts:uploadRecording2", message: "sending recording-2", data: { duration_seconds_sent: durationSeconds, storage_path_len: storage_path?.length }, timestamp: Date.now(), hypothesisId: "H2" });
    // #endregion
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
};
