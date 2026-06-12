/**
 * Chat-query client. Branches the wire format based on whether the
 * caller has an audio blob to ship alongside the question:
 *
 *  - audioBlob present → `multipart/form-data` POST. Backend BE-3
 *    pulls `audio_file` out for silent acoustic analysis. The user's
 *    `question` field is the Web Speech transcript — what they see in
 *    the input field IS what gets sent (prompt C4); the audio is for
 *    metrics only, never re-transcribed for display.
 *
 *  - audioBlob absent → plain `application/json` POST. This is the
 *    pre-existing wire shape the BFF has handled since the original
 *    Q&A endpoint shipped (prompt C1); typed-only sends MUST continue
 *    to use this path so today's chat traffic doesn't change format
 *    overnight.
 *
 * `transcript_source: "web_speech"` is included on the multipart leg
 * so the backend can distinguish "user already saw this string" vs
 * "Whisper transcribed it server-side and the user has no anchor for
 * it". The display contract (C4) is voided if backend ever swaps that
 * value silently.
 */

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface ChatQueryArgs {
  question: string;
  history?: ChatHistoryEntry[];
  audioBlob?: Blob | null;
  durationSec?: number | null;
  /**
   * Optional session id — when present the backend can scope KB
   * lookups (and acoustic-metric attribution) to this session. Kept
   * optional because anonymous-funnel callers don't have one.
   */
  sessionId?: string | null;
}

/**
 * Shape we expect back from /v2/chat/query. Fields are all optional
 * because (a) the backend's contract is to return SOMETHING usable on
 * any 2xx, with empty fields rather than a 4xx, and (b) FE Prompts
 * shipped in different orders may add fields out of band — keep this
 * shape forward-compatible by only typing what we actively read.
 */
export interface ChatQueryResponse {
  answer?: string;
  /** RULE F (server-side split) — the answer pre-split into render-ready bubbles.
   *  Authoritative over `answer`; render each 1:1. Absent → split `answer`. */
  bubbles?: string[];
  error?: string;
  show_upload_ui?: boolean;
  /**
   * Per-turn record-intent signal — true when the backend detects the
   * user wants to record audio *in the app* (vs uploading a file). The
   * mic already POSTs multipart audio to /v2/chat/query for the casual
   * voice analytics path; this flag just tells the frontend to make
   * the mic visually invited (pulse / accent) on this turn.
   *
   * Mutually exclusive with show_upload_ui in practice. Both falsy is
   * the neutral default (text composer only).
   *
   * Per-turn signal — caller should NOT cache across turns.
   */
  show_record_ui?: boolean;
  /**
   * S1 (wave-3 B-1) — the BE classifies the user's ask into ONE quick action
   * so the FE renders the single matching button (Strong sides / Recordings /
   * Record again) under the reply. null / absent → no button. Absent on every
   * turn until BE-2 ships `suggested_action`; the FE degrades to no button.
   * Per-turn signal — caller should NOT cache across turns.
   */
  suggested_action?: "strong_sides" | "recordings" | "record_again" | null;
  /** Optional stress-contrast block (BE-3). null / absent → omit
   *  the contrast card entirely per prompt C7. */
  contrast?: ChatQueryContrast | null;
}

export interface ChatQueryContrast {
  samples?: {
    official?: { wpm?: number | null; pitch_hz?: number | null } | null;
    casual?: { wpm?: number | null; pitch_hz?: number | null } | null;
  } | null;
  deltas?: ChatQueryContrastDelta[];
}

export interface ChatQueryContrastDelta {
  metric: string;
  delta: number;
  unit?: string | null;
  /** Positive = degrades-under-pressure per the prompt's sign convention
   *  (official > casual). Caller renders +/- accordingly. */
  direction?: "up" | "down" | "neutral";
}

const ENDPOINT = "/api/v2/chat/query";

/**
 * Thrown when the BFF returns a non-2xx. Carries the HTTP status so
 * callers can distinguish a real auth/network/server failure from a
 * 2xx-with-empty-answer (which is the librarian's "didn't catch
 * that" deflection branch and should render the persona fallback,
 * NOT a network-error message). Pre-fix this code was reading 401
 * bodies as "empty answer" and firing the persona fallback on auth
 * failures — exactly the bug the §3 anonymous-Lounge ask uncovered.
 */
export class ChatQueryRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code?: string, message?: string) {
    super(message ?? `chat-query failed: HTTP ${status}`);
    this.name = "ChatQueryRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function postChatQuery(
  args: ChatQueryArgs
): Promise<ChatQueryResponse> {
  let res: Response;
  if (args.audioBlob) {
    const form = new FormData();
    form.append("question", args.question);
    if (args.history) form.append("history", JSON.stringify(args.history));
    if (args.sessionId) form.append("session_id", args.sessionId);
    form.append("audio_file", args.audioBlob, "casual.webm");
    form.append("transcript_source", "web_speech");
    if (args.durationSec != null) {
      form.append("audio_duration_sec", String(args.durationSec));
    }
    res = await fetch(ENDPOINT, {
      method: "POST",
      body: form,
      credentials: "include",
    });
  } else {
    // No audio → existing JSON path, unchanged from today.
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: args.question,
        history: args.history,
        session_id: args.sessionId,
      }),
      credentials: "include",
    });
  }

  const data = (await res.json().catch(() => ({}))) as
    | (ChatQueryResponse & { code?: string })
    | Record<string, never>;

  // Anything non-2xx is a transport / auth / server failure — let the
  // caller's catch block decide how to surface it (typically a
  // "having trouble reaching the lab" message). 2xx with empty
  // `answer` is intentionally still a 2xx — that's the librarian's
  // own "didn't catch that" branch and renders the persona fallback.
  if (!res.ok) {
    throw new ChatQueryRequestError(
      res.status,
      data.code,
      typeof data.error === "string" ? data.error : undefined
    );
  }

  return data as ChatQueryResponse;
}
