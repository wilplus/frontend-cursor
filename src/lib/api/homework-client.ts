/**
 * Homework flow API client — calls BFF /api/homework/* (proxied to backend /v2/homework/*).
 * Backend may not implement these endpoints yet; 404/501 will surface as errors.
 */
import type {
  HomeworkStartResponse,
  HomeworkRecording1Response,
  HomeworkMetricAnswersResponse,
  HomeworkRecording2Response,
  HomeworkQuestionsResponse,
  HomeworkPostAnswersResponse,
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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message: string;
    try {
      const err = await res.json();
      message = (err as { error?: string }).error || res.statusText;
    } catch {
      message = res.statusText || `Request failed ${res.status}`;
    }
    if (res.status === 404) {
      throw new Error("Homework flow is not available yet. Please try again later.");
    }
    throw new Error(message);
  }
  return res.json();
}

const BASE = "/api/homework";

export const homeworkApi = {
  /** Start homework session; returns warm-up task text. */
  async start(): Promise<HomeworkStartResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/start`, { method: "POST", headers, body: "{}", credentials });
    return handleResponse<HomeworkStartResponse>(res);
  },

  /** Upload recording_1 (warm-up). Multipart: audio, duration_seconds. */
  async uploadRecording1(
    sessionId: string,
    formData: FormData,
    signal?: AbortSignal
  ): Promise<HomeworkRecording1Response> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/recording-1`, {
      method: "POST",
      headers,
      body: formData,
      signal,
      credentials,
    });
    return handleResponse<HomeworkRecording1Response>(res);
  },

  /** Submit metric question answers; returns final task text. */
  async submitMetricAnswers(
    sessionId: string,
    body: { metric_answer_1: string; metric_answer_2: string }
  ): Promise<HomeworkMetricAnswersResponse> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/metric-answers`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<HomeworkMetricAnswersResponse>(res);
  },

  /** Upload recording_2. Multipart: audio, duration_seconds. */
  async uploadRecording2(
    sessionId: string,
    formData: FormData,
    signal?: AbortSignal
  ): Promise<HomeworkRecording2Response> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/${sessionId}/recording-2`, {
      method: "POST",
      headers,
      body: formData,
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
