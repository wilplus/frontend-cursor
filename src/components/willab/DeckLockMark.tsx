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
/*               final state, and since 2026-08-15 it means ONE thing: the     */
/*               student locked these words in. It used to be reached by       */
/*               ACCEPTING too, which made the tick flash green for a few      */
/*               milliseconds on every accept before settling back to grey —   */
/*               the final state shown on the way to the in-between one. An    */
/*               accepted-not-locked chunk now reads `clean` here and says so  */
/*               in words inside the modal, where there is room to explain.    */
/*                                                                            */
/*  THE LOCKED PILL CAN BREATHE (founder 2026-08-12, `hasStyle`). The style    */
/*  lane came back the same day — a locked chunk may now carry a bold/colour   */
/*  proposal, surfaced ONLY inside its modal because the page never re-marks   */
/*  locked text. That put the lane exactly where the coach note was before     */
/*  the dot: a door with no handle. Every mark is clickable, but nothing ever  */
/*  told you which locked chunk was worth re-opening.                          */
/*                                                                            */
/*  NO NEW GLYPH AND NO FOURTH STATE, which is why this is a modifier and not  */
/*  a status. The lock stays CLOSED and the tick stays ON — the chunk really   */
/*  is locked and really is decided, and drawing it any other way would lie    */
/*  about that to advertise an optional extra. It gains the amber ring the     */
/*  waiting state already owns plus that state's breathing, so the page reads  */
/*  "locked, and a finishing touch is inside" out of vocabulary the student    */
/*  has already learnt. Falls back to a plain locked pill under                */
/*  prefers-reduced-motion — the ring alone still carries it.                  */
/*                                                                            */
/*  AC-9: the mark encodes only what the STUDENT has done (nothing waiting /   */
/*  waiting / locked) plus whether SOMETHING IS INSIDE — never a band, a       */
/*  score, a count or a machine read.                                          */
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

/** The style card's own kicker, reused for the same reason — the modal this
 *  mark opens already labels that section "Style". */
const STYLE_LABEL = "Style";

const PILL: Record<ChunkStatus, string> = {
  clean: "bg-foreground/[0.04] text-foreground/[0.28]",
  waiting: "bg-pending/[0.22] text-foreground/80 motion-safe:animate-lock-breathe",
  locked: "bg-foreground text-background",
};

/** The locked pill's style modifier — the waiting state's own amber, as a
 *  ring so the ink fill and the tick underneath stay exactly as they are. */
const STYLE_PILL = "ring-2 ring-pending motion-safe:animate-lock-breathe";

export default function DeckLockMark({
  status,
  onClick,
  disabled = false,
  hasCoach = false,
  hasStyle = false,
}: {
  status: ChunkStatus;
  onClick: () => void;
  disabled?: boolean;
  /** The coach left a note and/or a video on THESE words. An existence flag
   *  the payload already carries for free (`has_explanation`) — never a
   *  count, a band or a read on the speaker (AC-9). */
  hasCoach?: boolean;
  /** A style-lane proposal is waiting inside this chunk's modal. Read ONLY
   *  on a locked chunk: on a waiting one the pill already breathes for the
   *  content feedback, which outranks it (the BE suppresses style on any
   *  paragraph with a rewrite queued), and on a clean one there is no lock
   *  for a post-lock lane to have fired on. */
  hasStyle?: boolean;
}) {
  const Icon = status === "locked" ? Lock : LockOpen;
  const styled = hasStyle && status === "locked";
  return (
    <button
      type="button"
      // Existing signed-off copy only: the state line plus the two cards'
      // own labels (founder 2026-08-11, "Change the copy to simply say:
      // 'Coach note:'"; the modal's style kicker). No new user-facing
      // string is invented here.
      aria-label={[ARIA[status], hasCoach ? COACH_LABEL : null,
                   styled ? STYLE_LABEL : null]
        .filter(Boolean)
        .join(" — ")}
      data-status={status}
      data-coach={hasCoach ? "true" : undefined}
      data-style={styled ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`relative ml-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-[0.05em] transition-transform hover:scale-[1.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 ${PILL[status]}${styled ? ` ${STYLE_PILL}` : ""}`}
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
