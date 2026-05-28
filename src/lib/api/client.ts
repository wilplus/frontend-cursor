import { getAuthFetchOptions } from "@/lib/api/auth-fetch";
import type {
  SessionStatusResponse,
  SessionStartRequest,
  SessionStartResponse,
  SubmitPreAnswersRequest,
  SubmitPreAnswersResponse,
  UploadRecordingResponse,
  SubmitPostAnswersRequest,
  SubmitPostAnswersResponse,
  GetRecordingResponse,
  GetSignedAudioUrlResponse,
  ListRecordingsResponse,
  UserProfileResponse,
  AdminFeedbackRequest,
  AdminFeedbackResponse,
  UserAdminContext,
  AdminRecordingsListResponse,
  SharingConsentResponse,
  ApiError,
} from "./types";


async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let error: ApiError;
    try {
      error = await res.json();
    } catch {
      // If response isn't JSON, create a generic error
      error = {
        code: `HTTP_${res.status}`,
        error: res.statusText || `Request failed with status ${res.status}`,
      };
    }
    
    // Only redirect to login if it's a Supabase auth issue (UNAUTHORIZED code)
    // Don't redirect on Flask backend 401s (those are backend config issues)
    if (res.status === 401 && error.code === "UNAUTHORIZED" && typeof window !== "undefined") {
      // This is a real auth issue - session expired
      // Let middleware handle the redirect, don't do it here
      // Just throw the error and let the component handle it
    }
    
    // Provide user-friendly error messages for 502 (backend unavailable)
    if (res.status === 502 || error.code === "BACKEND_UNAVAILABLE") {
      throw new Error(
        "Backend server is not responding. Please check if your Flask backend is running and accessible."
      );
    }
    
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSessionStatus(): Promise<SessionStatusResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch("/api/session/status", { headers, credentials });
  return handleResponse<SessionStatusResponse>(res);
}

export async function startSession(
  request: SessionStartRequest = {}
): Promise<SessionStartResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const body: SessionStartRequest = request;
    const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
    const res = await fetch("/api/session/start", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials,
    });

    clearTimeout(timeoutId);
    return handleResponse<SessionStartResponse>(res);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. The backend may be slow or unresponsive.");
    }
    throw err;
  }
}

export async function abandonSession(sessionId: string): Promise<void> {
  const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
  const res = await fetch("/api/session/abandon", {
    method: "POST",
    headers,
    body: JSON.stringify({ session_id: sessionId }),
    credentials,
  });
  if (!res.ok) {
    const error: ApiError = await res.json();
    throw new Error(error.error || `HTTP ${res.status}`);
  }
}

export async function submitPreAnswers(
  data: SubmitPreAnswersRequest
): Promise<SubmitPreAnswersResponse> {
  const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
  const res = await fetch("/api/pre-answers", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    credentials,
  });
  return handleResponse<SubmitPreAnswersResponse>(res);
}

export async function uploadRecording(
  formData: FormData,
  abortController?: AbortController
): Promise<UploadRecordingResponse> {
  try {
    const { headers, credentials } = await getAuthFetchOptions();
    const res = await fetch("/api/recording/upload", {
      method: "POST",
      headers,
      body: formData,
      signal: abortController?.signal,
      credentials,
    });
    
    // Log response for debugging
    if (!res.ok) {
      const errorText = await res.clone().text();
      console.error("Upload failed with status:", res.status);
      console.error("Error response:", errorText);
    }
    
    return handleResponse<UploadRecordingResponse>(res);
  } catch (err) {
    console.error("Upload fetch error:", err);
    throw err;
  }
}

export async function submitPostAnswers(
  data: SubmitPostAnswersRequest
): Promise<SubmitPostAnswersResponse> {
  const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
  const res = await fetch("/api/post-answers", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    credentials,
  });
  return handleResponse<SubmitPostAnswersResponse>(res);
}

export async function fetchRecording(
  id: string
): Promise<GetRecordingResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/recordings/${id}`, { headers, credentials });
  return handleResponse<GetRecordingResponse>(res);
}

export async function fetchSignedAudioUrl(
  id: string
): Promise<GetSignedAudioUrlResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/recordings/${id}/audio-url`, { headers, credentials });
  return handleResponse<GetSignedAudioUrlResponse>(res);
}

export async function fetchUserRecordings(
  limit: number = 10,
  offset: number = 0
): Promise<ListRecordingsResponse> {
  const url = `/api/user/recordings?limit=${limit}&offset=${offset}`;
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(url, { headers, credentials });
  return handleResponse<ListRecordingsResponse>(res);
}

export async function fetchUserProfile(): Promise<UserProfileResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch("/api/user/profile", { headers, credentials });
  return handleResponse<UserProfileResponse>(res);
}

/**
 * Snippet-sharing consent — one-time global question asked after the
 * user rates their first snippet. See ChatInterview's consent splice.
 */
export async function getSharingConsent(): Promise<SharingConsentResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch("/api/user/sharing-consent", { headers, credentials });
  return handleResponse<SharingConsentResponse>(res);
}

export async function setSharingConsent(
  opt_in: boolean
): Promise<SharingConsentResponse> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch("/api/user/sharing-consent", {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    credentials,
    body: JSON.stringify({ opt_in }),
  });
  return handleResponse<SharingConsentResponse>(res);
}

// Admin Feedback API Functions
export async function submitAdminFeedback(
  data: AdminFeedbackRequest
): Promise<AdminFeedbackResponse> {
  const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
  const res = await fetch("/api/admin/feedback", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    credentials,
  });
  return handleResponse<AdminFeedbackResponse>(res);
}

/* -------------------------------------------------------------------------- */
/*  Legacy admin-context helpers — backward-compat shim over the Phase 12/13  */
/*  /v2/admin/user/<id>/context endpoint.                                     */
/*                                                                            */
/*  Backend changed this endpoint to return the multi-session                  */
/*  AdminUserContextPayload shape ({user, sessions[]}) and renamed the         */
/*  editable text field:                                                       */
/*    general_notes        →  user.private_admin_notes                        */
/*  The PATCH method is gone; PUT is the new mutator. These shims keep        */
/*  existing callers (admin/user/[id]/page.tsx, AdminRecordingsList,          */
/*  the Notes card on admin/users/[id]/page.tsx) working without               */
/*  requiring every site to migrate at once. New callers should               */
/*  prefer adminApi.getUserContext / .updateUserContext directly to access    */
/*  the full payload (sessions, behavioral profile, queued override, etc).   */
/*                                                                            */
/*  `custom_llm_instructions` was removed from the BE PATCH branch in        */
/*  b004659 and is no longer surfaced through this shim. The legacy           */
/*  `custom_instructions` field on UserAdminContext is gone too.              */
/* -------------------------------------------------------------------------- */

interface NewContextResponse {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    private_admin_notes: string | null;
    queued_override_question: string | null;
    coach_override_profile: string | null;
    [key: string]: unknown;
  };
  sessions?: unknown[];
}

function toLegacyContext(payload: NewContextResponse): UserAdminContext {
  const u = payload.user ?? ({} as NewContextResponse["user"]);
  return {
    general_notes: u.private_admin_notes ?? null,
    // Legacy shape carried these fields; the new endpoint doesn't —
    // sane defaults so consumers' truthy guards (e.g.
    // {context.max_words && (...)}) cleanly hide unsupported sections.
    max_words: 0,
    specific_questions: [],
    updated_at: null,
    user_email: u.email ?? null,
  };
}

export async function getUserAdminContext(
  userId: string
): Promise<UserAdminContext> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/user/${userId}/context`, { headers, credentials });
  const payload = await handleResponse<NewContextResponse>(res);
  return toLegacyContext(payload);
}

/**
 * No-op shim — the Phase 12/13 endpoint dropped user_email from PUT
 * payloads. Email lives on the auth user row, not the admin context
 * surface. Returns the current context unchanged so callers don't
 * crash, and logs a warning so the regression is visible if anyone
 * actually relies on this writing.
 */
export async function updateUserAdminEmail(
  userId: string,
  _userEmail: string
): Promise<UserAdminContext> {
  console.warn(
    `[updateUserAdminEmail] no-op shim — backend dropped user_email from /v2/admin/user/${userId}/context PUTs. Update auth email via the auth admin surface instead.`
  );
  return getUserAdminContext(userId);
}

/**
 * Patch any subset of legacy admin context fields. Translates to the
 * new endpoint's field names and PUT method. Empty strings are sent
 * as null so the backend can clear the value.
 *
 * `custom_instructions` was removed from the input type after b004659
 * dropped the corresponding BE PATCH branch. Callers that previously
 * wrote here are gone (admin Tab 3's "Global LLM Instructions" card
 * was deleted in ed9ed70).
 */
export async function updateUserAdminContext(
  userId: string,
  patch: {
    general_notes?: string | null;
    max_words?: number | null;
  }
): Promise<UserAdminContext> {
  const normalize = (v: string | null | undefined) =>
    v === undefined ? undefined : v && v.trim() ? v : null;
  const body: Record<string, unknown> = {};
  // Legacy → new field-name translation. Backend ignores any unknown
  // keys so we can safely drop max_words (no longer supported).
  if (patch.general_notes !== undefined)
    body.private_admin_notes = normalize(patch.general_notes);
  if (patch.max_words !== undefined) {
    console.warn(
      "[updateUserAdminContext] max_words is no longer supported on the Phase 12/13 endpoint — dropping."
    );
  }

  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/user/${userId}/context`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    credentials,
    body: JSON.stringify(body),
  });
  const payload = await handleResponse<NewContextResponse>(res);
  return toLegacyContext(payload);
}

export async function getAuthUserEmail(userId: string): Promise<{ email: string | null }> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/user/${userId}/auth-email`, { headers, credentials });
  if (!res.ok && res.status !== 503) {
    throw new Error(res.statusText || "Failed to get user email");
  }
  const data = (await res.json()) as { email?: string | null };
  return { email: data.email ?? null };
}

export async function fetchAdminRecordings(
  limit: number = 20,
  offset: number = 0,
  needsFeedback?: boolean,
  search?: string
): Promise<AdminRecordingsListResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (needsFeedback !== undefined) {
    params.append("needs_feedback", needsFeedback.toString());
  }
  const trimmed = search?.trim();
  if (trimmed) {
    params.append("q", trimmed);
  }
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/recordings?${params}`, { headers, credentials });
  return handleResponse<AdminRecordingsListResponse>(res);
}

/** User custom prompts (3 configurable questions). */
export interface UserMetricQuestions {
  metric_question_1: string;
  metric_question_2: string;
  metric_question_3: string;
}

export async function getUserMetricQuestions(): Promise<UserMetricQuestions> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch("/api/user/metric-questions", { headers, credentials });
  const data = await handleResponse<{ metric_question_1?: string; metric_question_2?: string; metric_question_3?: string }>(res);
  return {
    metric_question_1: data.metric_question_1 ?? "",
    metric_question_2: data.metric_question_2 ?? "",
    metric_question_3: data.metric_question_3 ?? "",
  };
}

export async function patchUserMetricQuestions(body: UserMetricQuestions): Promise<void> {
  const { headers, credentials } = await getAuthFetchOptions({ "Content-Type": "application/json" });
  const res = await fetch("/api/user/metric-questions", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
    credentials,
  });
  await handleResponse<unknown>(res);
}
