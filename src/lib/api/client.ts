import type {
  SessionStatusResponse,
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
  const res = await fetch("/api/session/status");
  return handleResponse<SessionStatusResponse>(res);
}

export async function startSession(
  questionnaire?: import("./types").PreRecordingQuestionnaireInput
): Promise<SessionStartResponse> {
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const body: import("./types").SessionStartRequest = questionnaire
      ? { questionnaire }
      : {};
    
    const res = await fetch("/api/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
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
  const res = await fetch("/api/session/abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) {
    const error: ApiError = await res.json();
    throw new Error(error.error || `HTTP ${res.status}`);
  }
}

export async function submitPreAnswers(
  data: SubmitPreAnswersRequest
): Promise<SubmitPreAnswersResponse> {
  const res = await fetch("/api/pre-answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<SubmitPreAnswersResponse>(res);
}

export async function uploadRecording(
  formData: FormData,
  abortController?: AbortController
): Promise<UploadRecordingResponse> {
  try {
    const res = await fetch("/api/recording/upload", {
      method: "POST",
      body: formData,
      signal: abortController?.signal,
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
  const res = await fetch("/api/post-answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<SubmitPostAnswersResponse>(res);
}

export async function fetchRecording(
  id: string
): Promise<GetRecordingResponse> {
  const res = await fetch(`/api/recordings/${id}`);
  return handleResponse<GetRecordingResponse>(res);
}

export async function fetchSignedAudioUrl(
  id: string
): Promise<GetSignedAudioUrlResponse> {
  const res = await fetch(`/api/recordings/${id}/audio-url`);
  return handleResponse<GetSignedAudioUrlResponse>(res);
}

export async function fetchUserRecordings(
  limit: number = 10,
  offset: number = 0
): Promise<ListRecordingsResponse> {
  const url = `/api/user/recordings?limit=${limit}&offset=${offset}`;
  console.log(`[fetchUserRecordings] Fetching: ${url}`);
  
  const res = await fetch(url);
  
  console.log(`[fetchUserRecordings] Response status: ${res.status} ${res.statusText}`);
  console.log(`[fetchUserRecordings] Response headers:`, Object.fromEntries(res.headers.entries()));
  
  // Clone the response to read it without consuming it
  const clonedRes = res.clone();
  const text = await clonedRes.text();
  console.log(`[fetchUserRecordings] Raw response body:`, text);
  
  // Now parse the original response
  return handleResponse<ListRecordingsResponse>(res);
}

export async function fetchUserProfile(): Promise<UserProfileResponse> {
  const res = await fetch("/api/user/profile");
  return handleResponse<UserProfileResponse>(res);
}

// Admin Feedback API Functions
export async function submitAdminFeedback(
  data: AdminFeedbackRequest
): Promise<AdminFeedbackResponse> {
  const res = await fetch("/api/admin/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include", // Important: include cookies for session
  });
  return handleResponse<AdminFeedbackResponse>(res);
}

export async function getUserAdminContext(
  userId: string
): Promise<UserAdminContext> {
  const res = await fetch(`/api/admin/user/${userId}/context`);
  return handleResponse<UserAdminContext>(res);
}

export async function fetchAdminRecordings(
  limit: number = 20,
  offset: number = 0,
  needsFeedback?: boolean
): Promise<AdminRecordingsListResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (needsFeedback !== undefined) {
    params.append("needs_feedback", needsFeedback.toString());
  }
  const res = await fetch(`/api/admin/recordings?${params}`);
  return handleResponse<AdminRecordingsListResponse>(res);
}
