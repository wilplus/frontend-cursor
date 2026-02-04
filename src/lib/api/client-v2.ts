/**
 * API client — calls Next.js BFF /api/* (proxied to backend /v2/*).
 */
import type {
  UniversalQuestion,
  UniversalAnswersInput,
  UniversalAnswersResponseV2,
  SessionStartResponseV2,
  SessionStatusResponseV2,
  ExerciseFeedbackRequestV2,
  SelectTaskRequestV2,
  IntentRequestV2,
  SubmitPostAnswersRequestV2,
  SubmitPostAnswersResponseV2,
  ApiErrorV2,
  AdminStudentsListResponseV2,
  AdminStudentProfileResponseV2,
  SpeakerProfileV2,
  StudentOverridesV2,
} from "@/lib/api/types-v2";

async function getAuthFetchOptions(
  extraHeaders: Record<string, string> = {}
): Promise<{ headers: Record<string, string>; credentials: RequestCredentials }> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore
    }
  }
  return { headers, credentials: "include" };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let error: ApiErrorV2;
    try {
      error = await res.json();
    } catch {
      error = {
        code: `HTTP_${res.status}`,
        error: res.statusText || `Request failed with status ${res.status}`,
      };
    }
    if (res.status === 502 || error.code === "BACKEND_UNAVAILABLE") {
      throw new Error(
        "Backend server is not responding. Please check if your Flask backend is running and accessible."
      );
    }
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const BASE = "/api";

export const v2Api = {
  async fetchUniversalQuestions(): Promise<UniversalQuestion[]> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/universal-questions`, { headers, credentials });
    return handleResponse<UniversalQuestion[]>(res);
  },

  async startSession(sessionId?: string): Promise<SessionStartResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/start`, {
      method: "POST",
      headers,
      body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
      credentials,
    });
    return handleResponse<SessionStartResponseV2>(res);
  },

  async getSessionStatus(): Promise<SessionStatusResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/session/status`, { headers, credentials });
    return handleResponse<SessionStatusResponseV2>(res);
  },

  async submitUniversalAnswers(
    sessionId: string,
    answers: UniversalAnswersInput
  ): Promise<UniversalAnswersResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/universal-answers`, {
      method: "POST",
      headers,
      body: JSON.stringify(answers),
      credentials,
    });
    return handleResponse<UniversalAnswersResponseV2>(res);
  },

  async submitExerciseFeedback(
    sessionId: string,
    body: ExerciseFeedbackRequestV2
  ): Promise<{ session_id: string }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/exercise-feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<{ session_id: string }>(res);
  },

  async selectTask(sessionId: string, body: SelectTaskRequestV2): Promise<{ session_id: string }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/select-task`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<{ session_id: string }>(res);
  },

  async submitIntent(sessionId: string, body: IntentRequestV2): Promise<{ session_id: string }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${sessionId}/intent`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<{ session_id: string }>(res);
  },

  async uploadRecording(
    formData: FormData,
    abortController?: AbortController
  ): Promise<import("@/lib/api/types-v2").UploadRecordingResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/recordings/upload`, {
      method: "POST",
      headers,
      body: formData,
      signal: abortController?.signal,
      credentials,
    });
    return handleResponse(res);
  },

  async submitPostAnswers(
    data: SubmitPostAnswersRequestV2
  ): Promise<SubmitPostAnswersResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/session/${data.session_id}/post-answers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recording_id: data.recording_id,
        answers: data.answers,
      }),
      credentials,
    });
    return handleResponse<SubmitPostAnswersResponseV2>(res);
  },

  // —— Admin ——
  async getAdminStudents(): Promise<AdminStudentsListResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/admin/students`, { headers, credentials });
    return handleResponse<AdminStudentsListResponseV2>(res);
  },

  async getAdminStudentProfile(userId: string): Promise<AdminStudentProfileResponseV2> {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch(`${BASE}/admin/students/${userId}`, { headers, credentials });
    return handleResponse<AdminStudentProfileResponseV2>(res);
  },

  async putAdminSpeakerProfile(userId: string, body: SpeakerProfileV2): Promise<{ ok: boolean }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/admin/students/${userId}/speaker-profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<{ ok: boolean }>(res);
  },

  async putAdminOverrides(userId: string, body: StudentOverridesV2): Promise<{ ok: boolean }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/admin/students/${userId}/overrides`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      credentials,
    });
    return handleResponse<{ ok: boolean }>(res);
  },

  async postAdminSendAssignment(userId: string): Promise<{ ok: boolean }> {
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch(`${BASE}/admin/students/${userId}/send-assignment`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      credentials,
    });
    return handleResponse<{ ok: boolean }>(res);
  },
};
