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
  /**
   * Provenance of the question text. BE-3 attaches this on every
   * next-question response:
   *   - "directives_queue" — popped from the user's coaching arc
   *     (admin's 5-step DirectivesQueuePanel input)
   *   - "admin_override"   — legacy single-question override path
   *   - "llm_generated"    — dynamic LLM next-question (the default)
   *
   * User-facing chat does NOT render this — admin steering stays
   * invisible to the end user. ChatInterview calls
   * `logQuestionAttribution` on every fetch so dev / production
   * console searches can find admin-influenced turns.
   */
  source?: "directives_queue" | "admin_override" | "llm_generated";
  /**
   * Only present when source === "directives_queue". Carries the
   * row's position (1..5) and intent_tag (free-text label the LLM
   * suggester emitted, e.g. "warm-up", "probe").
   */
  directive?: { position: number; intent_tag: string };
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
  /**
   * Backend-controlled gate for the contextual self-rating ("vibe
   * check") splice. The frontend used to fire the rating prompt on
   * every contextual chat's first turn — too noisy. Now only spliced
   * when this flag is `true`. Backend decides when to ask
   * (e.g., once-per-snippet, only at session-end, etc.) per
   * Phase-19 frequency rules. Undefined / false → silently skip.
   */
  requires_self_score?: boolean;
  /**
   * Whisper's detected language for this turn — surfaced to the user
   * as a pill near the mic so they can confirm the system heard them
   * in the right language. Critical UX after the "AI replies in
   * English when user speaks Polish" feedback: the pill makes the
   * mismatch immediately visible. Backend SHOULD include this on
   * every upload-answer response; frontend renders nothing when the
   * field is absent/null (graceful fallback during backend rollout).
   *
   * Expected values: ISO 639-1 codes ("pl", "en", "es", …) OR English
   * names ("Polish", "English"). The pill humanises both forms.
   */
  detected_language?: string | null;
  /**
   * NLP-detected: the user asked the AI to keep this particular
   * recording private (e.g. "don't share this one"). Backend extracts
   * the intent from the answer transcript and locks the snippet
   * server-side. Frontend just pushes a confirmation bubble inline
   * and keeps the conversation moving.
   * Undefined / false → normal flow, no bubble inserted.
   */
  snippet_opted_out?: boolean | null;
  /**
   * Session-1 satisfaction gate (BE commits 3968868 + 082ea33).
   *
   * Replaces today's pure-duration 30s threshold with the
   * brainstorm's three-condition check:
   *   (a) ≥1 answer where question_tone='charisma'
   *   (b) ≥1 answer where question_tone='stress'
   *   (c) ≥60s of accepted audio
   *
   * `session_1_complete` flips true on the upload that satisfies
   * all three. FE uses it as the "session 1 done" trigger on the
   * cold-start path (no sourceSnippetId). Contextual / retention-
   * loop chats ignore the gate and keep their own caps.
   *
   * `completion_state` carries the live progress so FE can render
   * per-criterion progress ("1/1 charisma ✓, 0/1 stress, 35s/60s")
   * under the mic without firing a separate /completion-state GET
   * after every upload.
   *
   * Both fields are optional during rollout — when absent, FE
   * falls back to the legacy 30s duration threshold so older BE
   * deploys keep working.
   */
  session_1_complete?: boolean;
  completion_state?: {
    ready: boolean;
    criteria: {
      has_charisma: boolean;
      has_stress: boolean;
      duration_ok: boolean;
    };
    current: {
      charisma_count: number;
      stress_count: number;
      total_duration_ms: number;
    };
  };
}

export async function uploadInterviewAnswer(
  blob: Blob,
  opts: {
    guestSessionId?: string | null;
    turnNumber: number;
    questionTone: string;
    questionText?: string | null;
    durationSeconds: number | null;
    /**
     * Set when this chat was initiated by clicking a CTA on a
     * published snippet (/chat?sourceSnippet=<id>&intent=…).
     * Forwarded to the backend so it can score the user's turn-1
     * answer against the source snippet's admin coach insight and
     * record the outcome — the first piece of the coaching-effectiveness
     * learning loop. Only set on turn 1 of contextual chats; ignored
     * by the regular guest funnel.
     */
    sourceSnippetId?: string | null;
    /**
     * Authorization header value (e.g. `Bearer <jwt>`). The
     * upload-answer endpoint is public, but the coaching-outcome
     * branch needs a verified user_id to owner-scope the source
     * snippet lookup. When this is omitted the contextual eval is
     * silently skipped — guest uploads keep working untouched.
     */
    authToken?: string | null;
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
  if (opts.sourceSnippetId) {
    form.append("source_snippet_id", opts.sourceSnippetId);
  }

  // Forward an Authorization header when the caller has one — the
  // upload-answer endpoint is public, but the coaching-outcome eval
  // branch on the backend looks for a Bearer token to derive a
  // verified user_id when source_snippet_id is set. Guest uploads
  // (no token) keep working exactly as before.
  const headers: Record<string, string> = {};
  if (opts.authToken && opts.authToken.trim()) {
    headers.Authorization = opts.authToken.trim().startsWith("Bearer ")
      ? opts.authToken.trim()
      : `Bearer ${opts.authToken.trim()}`;
  }

  let resp: Response;
  try {
    resp = await fetch("/api/public/interview/upload-answer", {
      method: "POST",
      headers,
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

/* -------------------------------------------------------------------------- */
/* User file upload (pre-recorded audio / video)                              */
/* -------------------------------------------------------------------------- */

export const USER_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Whitelist of MIME types the chat-side file picker advertises. Backend
 * is the final authority — anything that slips through gets a 415
 * UNSUPPORTED_TYPE on POST. Includes audio (mp3/wav/m4a) and video
 * (mp4/mov) per the spec.
 */
export const USER_UPLOAD_ACCEPT = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "video/mp4",
  "video/quicktime",
].join(",");

export interface UserUploadResponse {
  status: "ok";
  upload_id: string;
  file_url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  session_id: string | null;
}

/**
 * Upload a pre-recorded media file (audio or video) on behalf of the
 * signed-in user. The chat surface calls this when the user toggles to
 * "upload" mode and picks a file from disk. Backend persists to R2 and
 * links the row to the supplied session_id when present (so the admin
 * Files tab can group uploads by session).
 *
 * `authToken` is required — uploads are user-owned, not guest. Pass
 * the bearer the same way the interview upload-answer flow does.
 */
export async function uploadUserFile(
  file: File,
  opts: {
    sessionId?: string | null;
    authToken: string;
  }
): Promise<UserUploadResponse> {
  if (file.size > USER_UPLOAD_MAX_BYTES) {
    throw new GuestUploadFailure(
      "FILE_TOO_LARGE",
      "File is over the 100 MB limit.",
      413
    );
  }

  const form = new FormData();
  form.append("file", file, file.name);
  if (opts.sessionId) {
    form.append("session_id", opts.sessionId);
  }
  form.append("filename", file.name);

  const headers: Record<string, string> = {};
  const trimmed = opts.authToken.trim();
  headers.Authorization = trimmed.startsWith("Bearer ")
    ? trimmed
    : `Bearer ${trimmed}`;

  let resp: Response;
  try {
    resp = await fetch("/api/v2/user/uploads", {
      method: "POST",
      headers,
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
      (resp.status === 415
        ? "Unsupported file type"
        : resp.statusText || "Upload failed");
    throw new GuestUploadFailure(code, message, resp.status);
  }

  const body = json as UserUploadResponse | null;
  if (!body || body.status !== "ok" || !body.upload_id) {
    throw new GuestUploadFailure(
      "INVALID_RESPONSE",
      "Backend returned an unexpected upload response.",
      resp.status
    );
  }
  return body;
}
