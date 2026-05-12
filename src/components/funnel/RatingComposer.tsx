"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

interface RatingComposerProps {
  /** Called with the raw input (digit, decimal, or free text). Parent
   *  decides whether to send as `rating` (numeric) or `rating_text`. */
  onSubmit: (input: string) => void;
  /** Disables the input + spinner-fies the button while the request
   *  is in flight. */
  submitting: boolean;
  /** Inline error message displayed below the input — typically the
   *  "I didn't catch a number" copy on RATING_UNPARSEABLE. */
  error: string | null;
}

/**
 * In-chat composer for the post-answer self-rating prompt.
 *
 * Lives where the mic would be on a normal turn. Accepts either a
 * numeric ("8", "8.5") or a sentence containing a number ("I'd say
 * 8") — the parent decides how to forward it to the backend
 * (`rating` vs `rating_text`) based on shape.
 *
 * Enter submits; Shift+Enter (impossible with input but kept logical)
 * does not. The empty-input case is no-op — we don't pre-validate
 * the number range here, the backend's RATING_UNPARSEABLE error path
 * is the authoritative parser.
 */
export default function RatingComposer({
  onSubmit,
  submitting,
  error,
}: RatingComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Let the form's onSubmit run — explicit so disabled-state checks
      // happen there once instead of in two places.
      return;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-1.5"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1 shadow-sm">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Rate this answer 1 to 10"
          placeholder="1–10 or a sentence with a number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
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
      </div>
      {error && (
        <p className="px-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
