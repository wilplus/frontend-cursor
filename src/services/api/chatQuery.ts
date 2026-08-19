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
  /**
   * #2 — server-owned persistence. When true the BACKEND writes this turn
   * (user + bot) into the signed-in lounge thread; the FE then shows the bot
   * turn optimistically WITHOUT persisting it itself (one writer, no dupes).
   * Pass the optimistic USER message's client_id + client_created_at so the
   * BE writes the user turn idempotently (the server dedups on user_id +
   * client_id). Omit (anonymous) → BE does not persist; the FE keeps its local
   * thread.
   */
  persist?: boolean;
  clientId?: string | null;
  clientCreatedAt?: string | null;
  /** Explicit state for deterministic new-deck routing. This is UX context,
   * never authorization; recording endpoints still enforce project ownership. */
  presentationContext?: {
    has_current_project: boolean;
    completed_takes: number;
    has_pdf: boolean;
  };
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
  /**
   * Per-turn record-intent signal — true when the BE wants the composer mic
   * revealed for this turn. Hidden (false) by default. Per-turn, never cache.
   * Co-arrives with suggested_action="record_again" on record-redirect turns.
   */
  show_record_ui?: boolean;
  /**
   * S1 (wave-3 B-1) — the BE classifies the user's ask into ONE quick action
   * so the FE renders the single matching button under the reply.
   * null / absent → no button. Per-turn signal — caller should NOT cache.
   */
  suggested_action?: "trainings" | "record_again" | null;
  /** Project-boundary replies sometimes require a deliberate pair of choices. */
  suggested_actions?: string[];
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
    if (args.presentationContext) {
      form.append(
        "presentation_context",
        JSON.stringify(args.presentationContext)
      );
    }
    if (args.sessionId) form.append("session_id", args.sessionId);
    form.append("audio_file", args.audioBlob, "casual.webm");
    form.append("transcript_source", "web_speech");
    if (args.durationSec != null) {
      form.append("audio_duration_sec", String(args.durationSec));
    }
    if (args.persist) {
      form.append("persist", "true");
      if (args.clientId) form.append("client_id", args.clientId);
      if (args.clientCreatedAt) {
        form.append("client_created_at", args.clientCreatedAt);
      }
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
        presentation_context: args.presentationContext,
        // #2 — server-owned persistence (signed-in only). The BE dedups the
        // user turn on client_id; absent → BE does not persist this turn.
        persist: args.persist ? true : undefined,
        client_id: args.persist ? args.clientId ?? undefined : undefined,
        client_created_at: args.persist
          ? args.clientCreatedAt ?? undefined
          : undefined,
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
