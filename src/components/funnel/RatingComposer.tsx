"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingComposerProps {
  /**
   * Fires the moment a user clicks one of the 1-10 buttons. Receives
   * the digit as a string so it can be forwarded to the backend's
   * tolerant `rating_text` parser without further massaging.
   */
  onSubmit: (input: string) => void;
  /** Disables the button row + spinner-fies the active button while
   *  the request is in flight. */
  submitting: boolean;
  /**
   * "Evaluating…" hint shown when the backend has returned 425
   * ATTEMPT_NOT_READY at least once and we're sitting in the retry
   * ladder. Distinct from `submitting`: tells the user "I heard
   * your tap, the system is just catching up", not "your tap is
   * still being sent".
   */
  evaluating: boolean;
  /**
   * Inline error bubble copy — typically the spec's
   * "I didn't catch a number — could you try again with just 1–10?"
   * on RATING_UNPARSEABLE. Rendered as a chat-bubble-styled note
   * BELOW the button row so the user can re-tap without losing
   * place in the conversation.
   */
  error: string | null;
}

/**
 * Self-rating composer — row of 1-10 buttons.
 *
 * Replaces the old voice-only rating intake (handleRatingSend +
 * Whisper transcript → tolerant text parser) with a manual tap
 * that sends a clean digit straight to the backend. Voice extraction
 * was too brittle (worked for "8/10", failed for plain "8") and the
 * backend's Phase-19 robustness fixes are still better off with a
 * digit input than guessing from transcripts when one is available.
 *
 * 10 buttons in a single flex row — small but tappable on mobile
 * (min-w-7 = 28px). Wrap-friendly via flex-wrap if the parent
 * container ever shrinks below ~320 px.
 */
export default function RatingComposer({
  onSubmit,
  submitting,
  evaluating,
  error,
}: RatingComposerProps) {
  const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <div
        className="flex flex-wrap items-center justify-center gap-1.5"
        role="radiogroup"
        aria-label="Rate this answer 1 to 10"
      >
        {ratings.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked="false"
            aria-label={`Rate ${n} out of 10`}
            disabled={submitting}
            onClick={() => onSubmit(String(n))}
            className={cn(
              "flex h-10 min-w-9 items-center justify-center rounded-full border border-border bg-card px-2 text-sm font-semibold text-foreground tabular-nums transition-all",
              "hover:border-primary hover:bg-primary/10 hover:text-primary",
              "active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-card disabled:hover:text-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Status footer — at most one of these renders at a time. */}
      {submitting && (
        <p
          className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Saving…
        </p>
      )}

      {evaluating && !submitting && !error && (
        <p
          className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          evaluating…
        </p>
      )}

      {error && (
        <div
          className="rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
