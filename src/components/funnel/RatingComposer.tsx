"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

interface RatingComposerProps {
  /** Called with the raw input — typically a digit ("8") but the
   *  backend's tolerant parser also accepts sentences ("I'd say 8"). */
  onSubmit: (input: string) => void;
  /** Drives the spinner + disables input while the request is
   *  in flight (POST + retry ladder). */
  submitting: boolean;
  /**
   * Subtle "evaluating…" copy shown next to the spinner when the
   * backend has returned 425 ATTEMPT_NOT_READY at least once and
   * we're sitting in the retry ladder. Distinct from the initial
   * submit because it tells the user "I heard you, the system is
   * just catching up" instead of "your input is being sent".
   */
  evaluating: boolean;
  /**
   * Inline error bubble copy — typically the spec's
   * "I didn't catch a number — could you try again with just 1–10?"
   * on RATING_UNPARSEABLE. Rendered as a chat-bubble-styled note
   * BELOW the input so the user can re-type without losing focus.
   */
  error: string | null;
}

/**
 * In-chat composer for the post-answer self-rating prompt.
 *
 * Replaces the mic for the duration of the rating phase. Accepts a
 * digit ("8"), a decimal ("8.5"), or a free-form sentence
 * containing a number ("I'd say around an 8") — parent decides
 * whether to send the input as `rating` (numeric) or `rating_text`
 * (free-form) based on shape. Empty input is no-op (Send button
 * stays disabled).
 */
export default function RatingComposer({
  onSubmit,
  submitting,
  evaluating,
  error,
}: RatingComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1 shadow-sm"
      >
        <input
          type="text"
          inputMode="numeric"
          aria-label="Rate this answer 1 to 10"
          placeholder="1–10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitting}
          autoFocus
          className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          aria-label="Submit rating"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>

      {/* "evaluating…" subtle hint while we're sitting in the 425
          retry ladder. Hidden once we leave that state (success,
          unparseable, or soft-fail). */}
      {evaluating && !error && (
        <p
          className="flex items-center gap-1.5 px-3 text-[11px] text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          evaluating…
        </p>
      )}

      {/* Inline error bubble — chat-bubble-styled so it reads as
          part of the conversation rather than a system error. */}
      {error && (
        <div
          className="rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
