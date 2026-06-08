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

/** Parse a comma-separated vocabulary field into clean terms (§4). */
export function parseVocabulary(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
