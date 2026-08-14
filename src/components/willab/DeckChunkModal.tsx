"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Sparkles, Undo2, X } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { whyLine } from "@/lib/willab/trackedChangeWhy";
import { historyForChunk, type DeckChunk } from "@/lib/willab/deckChunks";
import DeckCoachFeedback from "@/components/willab/DeckCoachFeedback";
import type {
  DecisionHistoryEntry,
  DocumentSuggestion,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  DeckChunkModal — the two faces behind a chunk's lock (founder 2026-08-11,  */
/*  Lovable spec §3). One modal, because Accept MORPHS REVIEW into EDITOR in   */
/*  place: the student is never dropped back to the page mid-decision.         */
/*                                                                            */
/*    REVIEW (waiting + a pending proposal): what you said → suggested →       */
/*      rationale → Accept / Keep mine.                                       */
/*    EDITOR (accepted / locked / clean): the always-editable, marker-aware    */
/*      field → Lock in / Discard.                                            */
/*                                                                            */
/*  The HOST owns every network call — this component only renders state and   */
/*  awaits the callbacks, so the three decide lanes, the user-edit PUT and     */
/*  the part-lock PUT stay exactly where they already live and the deck        */
/*  cannot fork the contract. Copy is the founder's spec vocabulary            */
/*  verbatim; the rationale line is the signed-off whyLine() copy — the        */
/*  modal never renders BE free text (LIVE LOOP).                              */
/* -------------------------------------------------------------------------- */

// displayKind lives in its own pure .ts module so the founder's display
// taxonomy is unit-testable (vitest cannot transform .tsx imports here);
// re-exported so existing importers keep their path.
import { displayKind } from "./displayKind";
export { displayKind };

export type LockOutcome = "ok" | "blocked" | "failed";

interface DeckChunkModalProps {
  chunk: DeckChunk;
  /** The pending proposal to review, when the chunk is waiting. Null routes
   *  straight to the EDITOR face. */
  suggestion: DocumentSuggestion | null;
  /** Decide approve. Resolves true when saved; the host refetches and the
   *  updated chunk text flows back down. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  /** Decide disregard ("Keep mine"). Resolves true when saved. */
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit the draft (when changed) and lock the part. */
  onLockIn: (text: string) => Promise<LockOutcome>;
  onClose: () => void;
  /** THE STYLE LANE (slice 2) — a pending post-lock bold for this chunk,
   *  surfaced ONLY here. Null = none. */
  styleSuggestion?: DocumentSuggestion | null;
  /** Apply the style proposal (rides outside the ≤3 budget). */
  onApplyStyle?: (s: DocumentSuggestion) => Promise<boolean>;
  /** PROPOSAL HISTORY (slice 2) — the arc's decided proposals; the modal
   *  lists the ones whose words belong to this chunk. */
  history?: readonly DecisionHistoryEntry[] | null;
  /** THE COACH'S OWN FEEDBACK (slice 4) — the snippet the coach left a note
   *  or a video on for THIS chunk's words, or null. Shown on both faces,
   *  locked chunks included (founder: "even on a locked screen you can
   *  still see that feedback"). */
  coachSnippetId?: string | null;
  /** The arc the coach's message is fetched from, on demand. */
  arcId?: string | null;
}

export default function DeckChunkModal({
  chunk,
  suggestion,
  onAccept,
  onKeepMine,
  onLockIn,
  onClose,
  styleSuggestion = null,
  onApplyStyle,
  history = null,
  coachSnippetId = null,
  arcId = null,
}: DeckChunkModalProps) {
  // Accept morphs the face; everything else derives from the chunk.
  // KEYED ON THE WORK, NOT THE STATE. `chunk.status` folds "approved, not
  // locked" into "locked", so reading it here meant a chunk with a real
  // pending proposal could still open the editor. The proposal itself is the
  // only thing that decides whether there is a review to run — and on a
  // re-opened locked chunk (R1 gen-4) that is exactly the case that matters.
  const [face, setFace] = useState<"review" | "editor">(
    chunk.pendingIds.length > 0 && suggestion ? "review" : "editor",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The always-editable draft. Re-synced from the served text whenever the
  // part's words change UNDER the modal (an accept reassembles the document)
  // — but never over something the student has typed.
  const [draft, setDraft] = useState(chunk.part.text);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setDraft(chunk.part.text);
  }, [chunk.part.text]);

  // The chunk's maturity — lock-in cycles survived (slice 2). A process
  // count in the kicker, exactly the founder's spec vocabulary.
  const iteration = chunk.part.iteration ?? 0;
  const iterTail =
    iteration > 0
      ? ` · ${iteration} iteration${iteration === 1 ? "" : "s"}`
      : "";
  const kicker =
    face === "review" && suggestion
      ? `${displayKind(suggestion)}${iterTail}`
      : // THE PAGE merged "accepted" into "locked" — one final state, one
        // icon (founder 2026-08-11). In HERE the difference is still real,
        // because this is where the lock action lives, so the modal reads
        // the part's own server-owned flag rather than the page's status.
        chunk.part.locked
        ? `Locked in${iterTail}`
        : chunk.status === "locked"
          ? "Accepted · not locked in yet"
          : "No feedback pending";
  const chunkHistory = historyForChunk(history, chunk.part.text);
  const title =
    face === "review"
      ? "Suggested change"
      : chunk.part.locked
        ? "Locked chunk"
        : "Edit this chunk";

  async function accept() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onAccept(suggestion);
    setBusy(false);
    if (!ok) {
      setError("Couldn't save that decision. Try again.");
      return;
    }
    // The student is never dropped back to the page mid-decision: the modal
    // re-renders as the editor over the freshly accepted words.
    dirtyRef.current = false;
    setFace("editor");
  }

  async function keepMine() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onKeepMine(suggestion);
    setBusy(false);
    if (!ok) {
      setError("Couldn't save that decision. Try again.");
      return;
    }
    // Keep mine: the words are untouched and the proposal moves into
    // history. The modal closes (Lovable §3.1); the lock stays one tap away
    // for a student who wants to commit their own wording.
    onClose();
  }

  async function lockIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await onLockIn(draft.trim());
    setBusy(false);
    if (outcome === "ok") {
      onClose();
      return;
    }
    setError(
      outcome === "blocked"
        ? "Decide every suggestion on this chunk first."
        : "Couldn't lock this in. Try again.",
    );
  }

  const rationale = suggestion ? whyLine(suggestion) : null;

  // A LOCKED CHUNK WITH NOTHING TO DECIDE SHOWS NO DECISION BUTTONS.
  //
  // Founder 2026-08-12: "if smth is locked in, then why there is a big button
  // to lock it in? and the discard button? and if I click discard nothing
  // happens" — the other half of the locked-iteration ruling ("keep it there;
  // hide the buttons but show the text"). Both buttons were no-ops here:
  // "Lock in" re-locks words that are already locked, and "Discard" is
  // `onClose`, which on an untouched chunk discards nothing — exactly the
  // "nothing happens" he saw.
  //
  // The row comes BACK the instant the words differ from the served text,
  // because a locked chunk stays editable by design and an edit the student
  // cannot lock in is an edit they cannot save. Compared against the text
  // rather than the dirty ref on purpose: typing a change and typing it back
  // leaves nothing to save either, and a ref would not re-render anyway.
  //
  // Not gated on `chunk.status`: a re-opened locked chunk (pending work beats
  // the lock) is already on the REVIEW face, which owns its own buttons.
  const settled = chunk.part.locked === true && draft === chunk.part.text;

  // SWIPE TO FULL (founder 2026-08-11: "Make the modal a bit taller and
  // expandable on swipe to the top").
  //
  // Two detents, not a free-dragging sheet. A continuously draggable height
  // has to own momentum, rubber-banding and a release-velocity rule, and all
  // three fight the scroller directly beneath it — this modal's whole job is
  // to hold a paragraph you scroll through. Two detents need one threshold
  // and cannot desync from the content.
  //
  // Swipe DOWN collapses; it never closes. Dismissing a review by the same
  // gesture that resizes it would throw away an undecided suggestion on a
  // slip of the thumb, and the close button and the backdrop are both already
  // there for a deliberate exit.
  const [expanded, setExpanded] = useState(false);
  const grabRef = useRef<number | null>(null);

  function onGrabStart(e: React.TouchEvent) {
    grabRef.current = e.touches[0]?.clientY ?? null;
  }

  function onGrabMove(e: React.TouchEvent) {
    const from = grabRef.current;
    const y = e.touches[0]?.clientY;
    if (from == null || y == null) return;
    const dy = from - y;
    // ~a third of a thumb travel. Below this the gesture is a tap wobble, and
    // resizing under a stationary thumb reads as the sheet twitching.
    if (Math.abs(dy) < 28) return;
    setExpanded(dy > 0);
    // Consume the gesture, so one long swipe cannot toggle repeatedly on the
    // way up.
    grabRef.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        // TWO DETENTS (founder 2026-08-11: "Make the modal a bit taller and
        // expandable on swipe to the top"), and they are deliberately not the
        // same KIND of constraint:
        //
        //   default  — `max-h`, a CEILING. The content decides the height, so
        //              a two-line chunk is not stretched into a sheet of
        //              empty space it never asked for.
        //   expanded — `h`, an actual HEIGHT. This one only happens because
        //              the student swiped up or pressed the grabber, and
        //              honouring that with a ceiling they may never reach
        //              makes the gesture a no-op on exactly the short chunks
        //              where the room was free. (The e2e caught this: with a
        //              short chunk both detents measured 390px on a 900px
        //              viewport — the class changed and the sheet did not.)
        //
        // `dvh` rather than `vh` — on a phone `100vh` is the browser's
        // idealised viewport, which sits behind the URL bar, so a `vh`-sized
        // sheet puts its own footer under the chrome. That is the one thing
        // full-height must not do: the decision buttons live down there.
        className={`flex w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl transition-all duration-300 ease-out sm:rounded-3xl ${
          expanded
            ? "h-[97dvh] max-h-[97dvh] sm:h-[94vh] sm:max-h-[94vh]"
            : "max-h-[92dvh] sm:max-h-[86vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* THE GRABBER. A real button, not a decorative bar: the founder
            asked for swipe, and swipe alone would leave the second detent
            unreachable by keyboard, by switch control, and on a desktop
            trackpad — so the drag and the tap/Enter do the same thing. It
            carries the touch handlers because the header below it holds the
            close button, and a drag that starts on that button should close,
            not resize. */}
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          className="flex shrink-0 touch-none items-center justify-center pb-1 pt-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span
            className="h-1 w-9 rounded-full bg-foreground/20"
            aria-hidden
          />
        </button>

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {kicker}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold text-foreground">
              {title}
            </h2>
          </div>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>

        <div className="scrollbar-none flex flex-col gap-3 overflow-y-auto px-5 py-3">
          {face === "review" && suggestion ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  What you said
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                  {suggestion.quote || chunk.part.text}
                </p>
              </div>
              <div className="rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Suggested
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                  {suggestion.kind === "bold"
                    ? suggestion.quote || chunk.part.text
                    : (suggestion.proposedText ?? "")}
                </p>
              </div>
              {rationale ? (
                <p className="px-1 text-[13px] leading-snug text-muted-foreground">
                  {rationale}
                </p>
              ) : null}
              {coachSnippetId ? (
                <DeckCoachFeedback arcId={arcId} snippetId={coachSnippetId} />
              ) : null}
            </>
          ) : (
            <>
              {/* THE CHUNK'S WORDS — a marker-AWARE field, never a raw one.
                  This was a plain textarea, which printed the document's
                  marker grammar at the reader: apply an emphasis, reopen the
                  chunk, and the box said "**changed everything**". FE-1 is
                  absolute — no character of that grammar ever reaches a
                  reader — and this modal is the only way into the text now,
                  so the leak sat on the one surface that cannot have it.
                  MarkedEditor renders the SAME styled spans the deck does and
                  serializes back byte-for-byte (a legacy ==x== the student
                  never touched comes back as ==x==), so opening a chunk and
                  closing it cannot rewrite the document — which is L1: their
                  take, verbatim. No toolbar: see the prop's note. */}
              <MarkedEditor
                value={draft}
                onChange={(next) => {
                  dirtyRef.current = true;
                  setDraft(next);
                }}
                toolbar={false}
                textSizeClass="text-[15px] leading-relaxed"
                frameClass="border border-pending/40 bg-pending/[0.06] focus:border-pending"
              />

              {/* THE COACH (slice 4) — on the locked face too: a locked
                  chunk has no proposal left, and the coach's message is
                  still about these words. */}
              {coachSnippetId ? (
                <DeckCoachFeedback arcId={arcId} snippetId={coachSnippetId} />
              ) : null}

              {/* THE STYLE LANE (slice 2): the post-lock emphasis proposal,
                  surfaced ONLY here — the page never re-marks locked text.
                  Rides OUTSIDE the ≤3 budget. */}
              {styleSuggestion && onApplyStyle ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Style
                  </p>
                  <p className="text-[14px] leading-relaxed text-foreground">
                    Bolden{" "}
                    <span className="font-semibold">
                      &ldquo;{styleSuggestion.quote}&rdquo;
                    </span>
                  </p>
                  {whyLine(styleSuggestion) ? (
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {whyLine(styleSuggestion)}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      setError(null);
                      const ok = await onApplyStyle(styleSuggestion);
                      setBusy(false);
                      if (!ok) {
                        setError("Couldn't apply that. Try again.");
                      }
                    }}
                    className="self-start rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Apply emphasis
                  </button>
                </div>
              ) : null}

              {/* PROPOSAL HISTORY (slice 2): what was suggested for these
                  words in earlier rounds — decided, kept readable. "Use this
                  wording" loads it into the draft; committing it is a fresh
                  lock-in, decided step by step like everything else. */}
              {chunkHistory.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Proposals from earlier iterations · {chunkHistory.length}
                  </p>
                  <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                    {chunkHistory.map((h, i) => (
                      <div
                        key={`${h.changeKey ?? i}`}
                        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
                      >
                        <p className="text-[13px] leading-relaxed text-foreground">
                          {h.proposedText ?? h.quote}
                        </p>
                        {h.why ? (
                          <p className="text-[12px] leading-snug text-muted-foreground">
                            {whyLine({
                              id: h.changeKey ?? String(i),
                              why: h.why,
                            })}
                          </p>
                        ) : null}
                        {h.proposedText ? (
                          <button
                            type="button"
                            onClick={() => {
                              dirtyRef.current = true;
                              setDraft(h.proposedText ?? "");
                            }}
                            className="self-start text-[12px] font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
                          >
                            Use this wording
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}
        </div>

        {face !== "review" && settled ? (
          // Nothing to decide — the header's close button and the backdrop
          // are the way out, and the words stay right there to be read.
          <div className="shrink-0 pb-5" />
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-2">
            {face === "review" && suggestion ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void keepMine()}
                  className="flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Keep mine
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || draft.trim().length === 0}
                  onClick={() => void lockIn()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden />
                  )}
                  Lock in
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" aria-hidden />
                  Discard
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
