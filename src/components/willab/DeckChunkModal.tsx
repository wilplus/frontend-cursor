"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Undo2, X } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { whyLine } from "@/lib/willab/trackedChangeWhy";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  DeckChunkModal — the two faces behind a chunk's lock (founder 2026-08-11,  */
/*  Lovable spec §3). One modal, because Accept MORPHS REVIEW into EDITOR in   */
/*  place: the student is never dropped back to the page mid-decision.         */
/*                                                                            */
/*    REVIEW (waiting + a pending proposal): what you said → suggested →       */
/*      rationale → Accept / Keep mine.                                       */
/*    EDITOR (accepted / locked / clean): the always-editable textarea →       */
/*      Lock in / Discard.                                                    */
/*                                                                            */
/*  The HOST owns every network call — this component only renders state and   */
/*  awaits the callbacks, so the three decide lanes, the user-edit PUT and     */
/*  the part-lock PUT stay exactly where they already live and the deck        */
/*  cannot fork the contract. Copy is the founder's spec vocabulary            */
/*  verbatim; the rationale line is the signed-off whyLine() copy — the        */
/*  modal never renders BE free text (LIVE LOOP).                              */
/* -------------------------------------------------------------------------- */

/** Display kind over the served fields — the founder's ruling: display words
 *  only, no second taxonomy. Derived, never stored. */
export function displayKind(s: DocumentSuggestion): string {
  if (s.kind === "bold") return "Style";
  if (s.kind === "advice") return "Flow";
  const crossTake =
    s.why === "energy" ||
    s.why === "steadiness" ||
    s.why === "coverage" ||
    s.why === "overall";
  return crossTake ? "Flow" : "Clarity";
}

export type LockOutcome = "ok" | "blocked" | "failed";

export default function DeckChunkModal({
  chunk,
  suggestion,
  onAccept,
  onKeepMine,
  onLockIn,
  onClose,
}: {
  chunk: DeckChunk;
  /** The pending proposal to review, when the chunk is waiting. Null routes
   *  straight to the EDITOR face. */
  suggestion: DocumentSuggestion | null;
  /** Decide approve. Resolves true when saved; the host refetches and the
   *  updated chunk text flows back down. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  /** Decide disregard ("Keep mine"). Resolves true when saved. */
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit the textarea (when changed) and lock the part. */
  onLockIn: (text: string) => Promise<LockOutcome>;
  onClose: () => void;
}) {
  // Accept morphs the face; everything else derives from the chunk.
  const [face, setFace] = useState<"review" | "editor">(
    chunk.status === "waiting" && suggestion ? "review" : "editor"
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

  const kicker =
    face === "review" && suggestion
      ? displayKind(suggestion)
      : chunk.status === "locked"
        ? "Locked in"
        : chunk.status === "accepted"
          ? "Accepted · not locked in yet"
          : "No feedback pending";
  const title =
    face === "review"
      ? "Suggested change"
      : chunk.status === "locked"
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
        : "Couldn't lock this in. Try again."
    );
  }

  const rationale = suggestion ? whyLine(suggestion) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
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
            </>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="sr-only">The chunk&apos;s words</span>
              <textarea
                rows={5}
                value={draft}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setDraft(e.target.value);
                }}
                className="w-full resize-y rounded-2xl border border-pending/40 bg-pending/[0.06] px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none focus:border-pending"
              />
            </label>
          )}

          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}
        </div>

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
      </div>
    </div>
  );
}
