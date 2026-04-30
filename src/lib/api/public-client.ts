import type { ApiError, UUID } from "./types";

export interface GuestUploadResponse {
  status: "ok";
  guest_session_id: UUID;
}

export interface GuestUploadError extends ApiError {
  status: number;
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export class GuestUploadFailure extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function uploadGuestRecording(
  blob: Blob,
  durationSeconds: number | null
): Promise<GuestUploadResponse> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new GuestUploadFailure(
      "FILE_TOO_LARGE",
      "Recording is over the 5 MB limit.",
      413
    );
  }

  const form = new FormData();
  const filename = blobFilename(blob);
  form.append("audio_file", blob, filename);
  if (durationSeconds != null && Number.isFinite(durationSeconds)) {
    form.append("duration_seconds", String(durationSeconds));
  }

  let resp: Response;
  try {
    resp = await fetch("/api/public/shaky-voice/upload", {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new GuestUploadFailure(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network error",
      0
    );
  }

  let json: unknown = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }

  if (!resp.ok) {
    const code =
      (json as ApiError | null)?.code ??
      (resp.status === 413 ? "FILE_TOO_LARGE" : `HTTP_${resp.status}`);
    const message =
      (json as ApiError | null)?.error ??
      (resp.status === 429
        ? "Rate limited"
        : resp.statusText || "Upload failed");
    throw new GuestUploadFailure(code, message, resp.status);
  }

  const body = json as GuestUploadResponse | null;
  if (!body || body.status !== "ok" || !body.guest_session_id) {
    throw new GuestUploadFailure(
      "INVALID_RESPONSE",
      "Backend returned an unexpected response.",
      resp.status
    );
  }

  return body;
}

function blobFilename(blob: Blob): string {
  const type = blob.type || "";
  if (type.includes("webm")) return "recording.webm";
  if (type.includes("ogg")) return "recording.ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "recording.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "recording.mp3";
  if (type.includes("wav")) return "recording.wav";
  if (type.includes("flac")) return "recording.flac";
  return "recording.webm";
}
