import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ChatHistoryEntry } from "@/services/api/chatQuery";

/* -------------------------------------------------------------------------- */
/*  willabHelpers — pure functions shared by the willab surfaces              */
/*                                                                            */
/*  Extracted from the components so they're unit-testable without rendering   */
/*  (and reusable across surfaces). No React, no DOM, no network.            */
/* -------------------------------------------------------------------------- */

/** Bot history window (turns) the Lounge passes to /v2/chat/query (§3/§7). */
export const LOUNGE_HISTORY_TURNS = 20;

/**
 * Map the persisted Lounge thread into the bot's history shape: only
 * conversational user/bot turns (text/joke), most recent `LOUNGE_HISTORY_TURNS`,
 * with `bot` → `assistant`. System/status/insight rows are not conversation.
 */
export function loungeToHistory(msgs: LoungeMessage[]): ChatHistoryEntry[] {
  return msgs
    .filter(
      (m) =>
        (m.role === "user" || m.role === "bot") &&
        (m.kind === "text" || m.kind === "joke")
    )
    .slice(-LOUNGE_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.body,
    }));
}

/**
 * U3 (bubble-split): split a bot message body into the paragraphs to render as
 * separate chat bubbles. Splits on blank lines (2+ newlines) ONLY — a single
 * soft newline stays inside a bubble (preserved by `whitespace-pre-wrap`), so
 * the librarian "sends" a few short bubbles instead of one wall of text.
 * Returns [] for an empty / whitespace-only body (render nothing) and a single
 * element when there's no blank-line break.
 */
export function splitBotMessage(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Seconds → `m:ss`. Clamps negatives to 0 and floors fractional seconds. */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * Does a Lounge message read as "show me my strong sides"? True on an explicit
 * mention (strong side(s) / strengths / strong points — incl. the common
 * "strenghts" typo and Polish "mocne strony"), or an anaphoric follow-up ("all
 * of them", "the rest", "show me more") when the conversation was already about
 * strong sides (`context` = the bot's previous turn). Lets the Lounge answer
 * with the Strong sides button instead of reciting the coach notes as text.
 */
export function isStrongSidesAsk(text: string, context = ""): boolean {
  const t = text.toLowerCase();
  if (
    /\bstrong\s*sides?\b/.test(t) ||
    /\bstrengths?\b/.test(t) ||
    /\bstrenghts?\b/.test(t) || // common typo (h/t swapped)
    /\bstrong points?\b/.test(t) ||
    /\bmocn\w*\s+stron\w*/.test(t) // PL: "mocne strony" / "mocnych stron"
  ) {
    return true;
  }
  const refersBack =
    /\b(all of them|them all|the rest|the others?|see them|show (me )?them|see more|show more|more of them)\b/.test(
      t
    );
  return refersBack && /\bstrong\s*sides?\b/.test(context.toLowerCase());
}

/** True when the user is asking to upload / submit a file they already have,
 *  rather than record live. Drives the footer's record button → upload picker
 *  swap. Deliberately broad (upload / attach / import / a file/recording/audio),
 *  incl. a PL "wgraj/prześlij plik" nod. */
export function isUploadAsk(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(upload|attach|import)\b/.test(t) ||
    /\b(send|submit|use|add)\b[^.?!]*\b(file|recording|audio|mp3|m4a|wav|clip)\b/.test(
      t
    ) ||
    /\b(existing|already|pre-?recorded|previous)\b[^.?!]*\b(recording|file|audio)\b/.test(
      t
    ) ||
    /\b(wgraj|prze[sś]lij|za[lł]aduj)\b/.test(t) // PL: upload
  );
}

/** One analysis = exactly 3 takes (founder 2026-07-11). Map an absolute take
 *  index onto its position within the current 3-take batch, so the UI shows
 *  "Take 1 of 3", never "Take 24 of 3". The BE resets take_index per fresh arc
 *  (batch); this also guards legacy unbounded arcs recorded before that. */
export const BATCH_TAKES = 3;

export function batchTake(takeIndex: number): number {
  if (!Number.isFinite(takeIndex) || takeIndex < 1) return 1;
  return ((Math.floor(takeIndex) - 1) % BATCH_TAKES) + 1;
}

/** Parse a comma-separated vocabulary field into clean terms (§4). */
export function parseVocabulary(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
