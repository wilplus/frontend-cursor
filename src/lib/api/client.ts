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
  ApiError,
} from "./types";

/** Get auth headers (Bearer token) and credentials for API requests. Sends token so BFF can use it when cookies fail. */
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

export async function getUserAdminContext(
  userId: string
): Promise<UserAdminContext> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/user/${userId}/context`, { headers, credentials });
  return handleResponse<UserAdminContext>(res);
}

export async function updateUserAdminEmail(
  userId: string,
  user_email: string
): Promise<UserAdminContext> {
  const { headers, credentials } = await getAuthFetchOptions();
  const res = await fetch(`/api/admin/user/${userId}/context`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    credentials,
    body: JSON.stringify({ user_email: user_email.trim() || null }),
  });
  return handleResponse<UserAdminContext>(res);
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
