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

export interface GuestClaimResponse {
  status: "ok";
  session_id: UUID;
  analysis_status: "queued" | "already_claimed";
}

/**
 * Bind the just-uploaded guest session to the freshly authenticated user and
 * enqueue the analysis pipeline. The backend reads the cookie set on upload;
 * we still pass guest_session_id explicitly so the call also works in flows
 * where the cookie wasn't preserved (e.g. SPA same-tab signup).
 *
 * Idempotent: calling twice returns 200 with analysis_status=already_claimed.
 */
export async function claimGuestSession(
  guestSessionId: string,
  accessToken: string
): Promise<GuestClaimResponse> {
  const resp = await fetch("/api/public/shaky-voice/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ guest_session_id: guestSessionId }),
  });

  let json: unknown = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }

  if (!resp.ok) {
    const code = (json as ApiError | null)?.code ?? `HTTP_${resp.status}`;
    const message =
      (json as ApiError | null)?.error ?? resp.statusText ?? "Claim failed";
    throw new GuestUploadFailure(code, message, resp.status);
  }

  return json as GuestClaimResponse;
}

/* -------------------------------------------------------------------------- */
/* Interview (multi-turn) endpoints                                           */
/* -------------------------------------------------------------------------- */

export interface InterviewQuestion {
  question: string;
  tone: "charisma" | "stress";
  turn_number: number;
}

export async function fetchNextQuestion(
  turnNumber: number,
  previousTurns?: { question: string; transcript?: string }[]
): Promise<InterviewQuestion> {
  let resp: Response;
  try {
    resp = await fetch("/api/public/interview/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turn_number: turnNumber,
        previous_turns: previousTurns?.length ? previousTurns : undefined,
      }),
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
    const code = (json as ApiError | null)?.code ?? `HTTP_${resp.status}`;
    const message =
      (json as ApiError | null)?.error ?? "Failed to get question";
    throw new GuestUploadFailure(code, message, resp.status);
  }

  return json as InterviewQuestion;
}

export interface InterviewUploadResponse {
  status: "ok";
  guest_session_id: string;
  snippet_id: string | null;
  duration_seconds: number | null;
  total_session_duration_seconds: number;
  metrics: Record<string, unknown> | null;
  /** Whisper transcript of the user's answer — used for EBCP branching logic. */
  transcript?: string | null;
}

export async function uploadInterviewAnswer(
  blob: Blob,
  opts: {
    guestSessionId?: string | null;
    turnNumber: number;
    questionTone: string;
    questionText?: string | null;
    durationSeconds: number | null;
  }
): Promise<InterviewUploadResponse> {
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
  form.append("turn_number", String(opts.turnNumber));
  form.append("question_tone", opts.questionTone);
  if (opts.questionText) {
    form.append("question_text", opts.questionText);
  }
  if (opts.guestSessionId) {
    form.append("guest_session_id", opts.guestSessionId);
  }
  if (opts.durationSeconds != null && Number.isFinite(opts.durationSeconds)) {
    form.append("duration_seconds", String(opts.durationSeconds));
  }

  let resp: Response;
  try {
    resp = await fetch("/api/public/interview/upload-answer", {
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
      (json as ApiError | null)?.code ?? `HTTP_${resp.status}`;
    const message =
      (json as ApiError | null)?.error ?? "Upload failed";
    throw new GuestUploadFailure(code, message, resp.status);
  }

  const body = json as InterviewUploadResponse | null;
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
