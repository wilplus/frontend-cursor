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

/** Founder-approved presentation retirements. Stored rows remain available for
 * audit/recovery; only exact server-authored metadata discriminators are
 * omitted from the visible Lounge thread. Keep these checks strict so malformed
 * or unrelated historic messages are never hidden by accident. */
export function isRetiredLoungeMessage(
  message: Pick<LoungeMessage, "role" | "kind" | "metadata">
): boolean {
  return (
    message.role === "bot" &&
    ((message.kind === "cadence" && message.metadata?.beat === 0) ||
      (message.kind === "text" && message.metadata?.note === "human_check"))
  );
}

/**
 * Map the persisted Lounge thread into the bot's history shape: only
 * conversational user/bot turns (text/joke), most recent `LOUNGE_HISTORY_TURNS`,
 * with `bot` → `assistant`. System/status/insight rows are not conversation.
 */
export function loungeToHistory(msgs: LoungeMessage[]): ChatHistoryEntry[] {
  return msgs
    .filter(
      (m) =>
        !isRetiredLoungeMessage(m) &&
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

/** Coerce a target length into positive integer seconds, or null. Accepts a
 *  number OR a numeric string (the setup / readout / resume sources may echo
 *  either); NaN / non-finite / ≤ 0 → null (the "no limit" case). */
export function coerceTargetSeconds(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Zero-padded clock. `m:ss` normally (`3:07`, `0:09`); `h:mm:ss` when
 *  `withHours` (`1:00:00`). Minutes are unpadded in the `m:ss` form, padded in
 *  the `h:mm:ss` form. Clamps negatives to 0. */
function fmtHms(sec: number, withHours: boolean): string {
  const s = Math.max(0, Math.floor(sec));
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (withHours) {
    return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** R5 — the Apple-style recording clock. Counts DOWN from the setup target,
 *  reads `0:00` at the target, then counts UP as a NEGATIVE overrun (`-0:36`,
 *  `overrun: true` so the caller reddens it). No/invalid target → counts up the
 *  raw elapsed, never overrun. Uses `h:mm:ss` once the target (or the elapsed
 *  in the no-limit case) reaches an hour. `elapsed` is your live tick seconds;
 *  `targetSec` is coerced (number | numeric-string | null). */
export function formatRecordingClock(
  elapsed: number,
  targetSec: unknown
): { label: string; overrun: boolean } {
  const e = Math.max(0, elapsed);
  const T = coerceTargetSeconds(targetSec);
  const overrun = T != null && e > T;
  const magnitude =
    T == null
      ? Math.floor(e) // no limit → raw stopwatch
      : overrun
        ? Math.floor(e - T) // -(e − T)
        : Math.ceil(T - e); // T − e, hits 0 exactly at e === T
  const withHours = (T != null && T >= 3600) || magnitude >= 3600;
  return { label: `${overrun ? "-" : ""}${fmtHms(magnitude, withHours)}`, overrun };
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

/** F1 — the offset between the two clocks a take is measured on.
 *
 *  Slide taps are timed from a UI timestamp; Whisper's word times come from the
 *  audio file. MediaRecorder does not start capturing the instant `start()`
 *  returns, so audio time runs BEHIND UI time and the first words after a tap
 *  bucket to the previous slide. This is the number of ms to subtract from
 *  every tap to move it into audio time:
 *
 *      offset = t_recorderFirstAudio - t_zeroUsedForTapTimes
 *
 *  Returns `undefined` when there is nothing trustworthy to send (an uploaded
 *  file rather than a live take, or a recorder that never reported a start),
 *  which leaves the backend on exactly its previous behaviour.
 *
 *  Out-of-range values are also dropped, and this is a deliberate departure
 *  worth knowing about: the backend rejects them with a 422 so a unit mistake
 *  fails loudly instead of corrupting transcripts. But a 422 on this endpoint
 *  fails the whole upload, which costs the user their recording over a
 *  diagnostic field. Both timestamps here come from one monotonic clock, so a
 *  wild value means something pathological rather than a unit error; we warn
 *  (visible in testing, which is where the loud failure was wanted) and send
 *  nothing (safe in production). */
export function measureSlideClockOffset(
  audioStartedAt: number | null,
  tapZero: number
): number | undefined {
  if (audioStartedAt == null) return undefined;
  // tapZero is 0 when no live recording was timed, e.g. a footer file upload.
  if (!Number.isFinite(tapZero) || tapZero <= 0) return undefined;
  const offset = Math.round(audioStartedAt - tapZero);
  if (!Number.isFinite(offset)) return undefined;
  if (offset > 30_000 || offset < -5_000) {
    // eslint-disable-next-line no-console
    console.warn(
      `[F1] implausible slide clock offset (${offset}ms), not sending it`
    );
    return undefined;
  }
  return offset;
}
