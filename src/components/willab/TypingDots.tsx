"use client";

/* -------------------------------------------------------------------------- */
/*  The "typing" animation (Lounge U4): three dots bouncing out of phase.      */
/*  One animation for the chat and the walk, so a wait reads the same          */
/*  everywhere: in the Lounge as a bot-side bubble, in the walk's AI bubble   */
/*  as the dots alone where the player goes (founder 2026-10-15: "the typing  */
/*  animation that we have in the lounge … without the white background").   */
/* -------------------------------------------------------------------------- */

/** The gap between sequentially revealed bubbles (ms of "typing"), U3. */
export const CHUNK_DELAY_MS = 350;

/** The three dots alone, no bubble around them. */
export function TypingGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" data-typing-glyph="" className={`flex items-center gap-1${className ? ` ${className}` : ""}`}>
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </span>
  );
}

/** U4 — animated "librarian is typing" indicator: the dots in a bot-side
 *  bubble. Replaces the static "…" so the wait reads as a live, responsive
 *  chat — and pairs with the U3 bubble-split (typing → a few short bubbles
 *  land). */
export default function TypingDots({ label = "Librarian is typing" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} data-typing-dots="" className="mr-auto flex items-center rounded-2xl bg-muted px-3.5 py-3">
      <TypingGlyph />
    </div>
  );
}
