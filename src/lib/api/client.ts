import { getAuthFetchOptions } from "@/lib/api/auth-fetch";
import type {
  GetRecordingResponse,
  GetSignedAudioUrlResponse,
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
