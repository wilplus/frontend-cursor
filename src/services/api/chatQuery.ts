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
  error?: string;
  show_upload_ui?: boolean;
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

export async function postChatQuery(
  args: ChatQueryArgs
): Promise<ChatQueryResponse> {
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
    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    return (await res.json().catch(() => ({}))) as ChatQueryResponse;
  }

  // No audio → existing JSON path, unchanged from today.
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: args.question,
      history: args.history,
      session_id: args.sessionId,
    }),
    credentials: "include",
  });
  return (await res.json().catch(() => ({}))) as ChatQueryResponse;
}
