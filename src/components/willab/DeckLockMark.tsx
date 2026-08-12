"use client";

import { Check, Lock, LockOpen } from "lucide-react";
import type { ChunkStatus } from "@/lib/willab/deckChunks";

/* -------------------------------------------------------------------------- */
/*  DeckLockMark — the one icon every chunk carries (founder 2026-08-11,       */
/*  Lovable spec §2). Always rendered, always clickable, inline immediately    */
/*  after the chunk text. It is the state machine's entry point: the HOST      */
/*  routes the click (waiting → REVIEW modal, everything else → EDITOR).       */
/*                                                                            */
/*  THREE STATES (founder 2026-08-11) — and since the text itself is no        */
/*  longer painted in any of them, this mark is the ONLY thing that carries    */
/*  a chunk's state:                                                           */
/*    clean    — open lock, faint pill. Quiet: nothing to do here.             */
/*    waiting  — open lock on the pending-amber pill, BREATHING. The only      */
/*               animated state, because it is the only one asking for the     */
/*               student's attention.                                          */
/*    locked   — closed lock, ink fill, white glyph, success tick badge. The   */
/*               final state, reached by accepting the feedback or by locking  */
/*               in by hand; the old separate "accepted" step was a window     */
/*               between those two that the student never needed to see.       */
/*                                                                            */
/*  AC-9: the mark encodes only what the STUDENT has done (nothing waiting /   */
/*  waiting / locked) — never a band, a score, or a machine read.              */
/* -------------------------------------------------------------------------- */

/** Aria copy per state — the founder's own kicker vocabulary (Lovable §3),
 *  so the screen-reader story matches the modal the click opens. */
const ARIA: Record<ChunkStatus, string> = {
  clean: "No feedback pending — edit this chunk",
  waiting: "Feedback waiting — review the suggested change",
  locked: "Locked in — open the locked chunk",
};

/** The coach card's own label, reused so the mark introduces NO new copy. */
const COACH_LABEL = "Coach note:";

const PILL: Record<ChunkStatus, string> = {
  clean: "bg-foreground/[0.04] text-foreground/[0.28]",
  waiting: "bg-pending/[0.22] text-foreground/80 motion-safe:animate-lock-breathe",
  locked: "bg-foreground text-background",
};

export default function DeckLockMark({
  status,
  onClick,
  disabled = false,
  hasCoach = false,
}: {
  status: ChunkStatus;
  onClick: () => void;
  disabled?: boolean;
  /** The coach left a note and/or a video on THESE words. An existence flag
   *  the payload already carries for free (`has_explanation`) — never a
   *  count, a band or a read on the speaker (AC-9). */
  hasCoach?: boolean;
}) {
  const Icon = status === "locked" ? Lock : LockOpen;
  return (
    <button
      type="button"
      // Existing signed-off copy only: the state line plus the coach card's
      // own label (founder 2026-08-11, "Change the copy to simply say:
      // 'Coach note:'"). No new user-facing string is invented here.
      aria-label={hasCoach ? `${ARIA[status]} — ${COACH_LABEL}` : ARIA[status]}
      data-status={status}
      data-coach={hasCoach ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`relative ml-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-[0.05em] transition-transform hover:scale-[1.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 ${PILL[status]}`}
    >
      <Icon
        className="h-3.5 w-3.5"
        strokeWidth={2.25}
        fill={status === "locked" ? "currentColor" : "none"}
        aria-hidden
      />
      {status === "locked" ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-success text-white"
          aria-hidden
        >
          <Check className="h-2 w-2" strokeWidth={3.5} />
        </span>
      ) : null}
      {/* THE COACH'S MESSAGE IS ON THESE WORDS (founder 2026-08-11: "if there
          was a video feedack even on a locked screen you can still see that
          feedback").
          It was already reachable — every mark opens the modal and the coach
          card lives on both faces — but only by opening chunks one at a time
          to find out which one had it. On a LOCKED chunk that is the whole
          problem: the lock is the final state, so nothing else would ever
          make the student open it again, and the coach's message sat behind a
          door with no handle.
          A DOT, not a video glyph: the flag behind it (`has_explanation`) is
          "a note and/or a video", and a film icon over a text-only note would
          promise something that is not there.
          AC-9 clean — it says SOMETHING IS HERE, never how much or how good.
          Top-right so it never collides with the locked tick below it, and
          ringed in the page background so it reads on both the ink-filled
          locked pill and the faint clean one. */}
      {hasCoach ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-pending ring-2 ring-background"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
