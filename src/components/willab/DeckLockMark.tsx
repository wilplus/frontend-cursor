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

const PILL: Record<ChunkStatus, string> = {
  clean: "bg-foreground/[0.04] text-foreground/[0.28]",
  waiting: "bg-pending/[0.22] text-foreground/80 motion-safe:animate-lock-breathe",
  locked: "bg-foreground text-background",
};

export default function DeckLockMark({
  status,
  onClick,
  disabled = false,
}: {
  status: ChunkStatus;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = status === "locked" ? Lock : LockOpen;
  return (
    <button
      type="button"
      aria-label={ARIA[status]}
      data-status={status}
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
    </button>
  );
}
