"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import type { ParagraphHistory } from "@/services/api/bookmarkHistory";
import type { RootPhraseSpan } from "@/services/api/partLock";
import {
  changed,
  openingChip,
  preselect,
  replaceNoteTake,
  takeChips,
  type TakeChip,
} from "@/lib/willab/helperWordsOverlay";
import {
  canTap,
  nextSelection,
  phraseTokens,
  selectionLength,
  selectionSpan,
  selectionText,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  THE HELPER WORDS OVERLAY (founder lock 2026-09-30, B4, D4, D5, Q2, Q3).   */
/*                                                                            */
/*  Its own screen, opened from the orange headline on the page and from      */
/*  "Edit" on the saved screen. Top: the current words                        */
/*  with Delete. Under it one chip per Take that has a version of this        */
/*  paragraph, newest first, the current one marked "now". Choosing a chip    */
/*  shows that Take's text as tappable words; there is no playback here.      */
/*  Tapping updates the top card live and marks it "new"; the button lights   */
/*  only when the selection differs from the saved words. Delete asks once:   */
/*  the card clears and the button reads "Delete helper words"; a tap on any  */
/*  word, or the close button, keeps the words (Q2).                          */
/*                                                                            */
/*  One Take, one phrase (Q3): switching chips starts a fresh selection.      */
/*  Words from the current Take are saved as a span of the paragraph; words   */
/*  from an earlier Take go to the Slide, since they need not be in the text  */
/*  (D5). Both save and lock in one tap; a delete clears the words and the    */
/*  lock. Every write is the speaker's own act (L1).                          */
/* -------------------------------------------------------------------------- */

const EYEBROW =
  "text-[11px] uppercase tracking-[0.13em] text-muted-foreground";
const PILL =
  "flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";

function tokenTone(picked: boolean, reachable: boolean): string {
  if (picked) return "bg-primary/10 text-primary";
  return reachable ? "text-foreground" : "text-muted-foreground/60";
}

export default function HelperWordsSheet({
  headline,
  currentText,
  history,
  onUseCurrent,
  onUseFromTake,
  onDelete,
  onDone = null,
  nav = null,
  onClose,
}: {
  /** The saved helper words, joined " · ", or null. */
  headline: string | null;
  /** The paragraph as it is now. */
  currentText: string;
  history: ParagraphHistory | null;
  /** Save words of the current Take (a span of the paragraph) and lock. */
  onUseCurrent: (span: RootPhraseSpan) => Promise<boolean>;
  /** Save words of an earlier Take (on the Slide) and lock. Absent → the
   *  earlier Takes' words show but cannot be used. */
  onUseFromTake?: ((phrase: string, takeIndex: number) => Promise<boolean>) | null;
  /** Clear the words and the lock. Absent → no Delete. */
  onDelete?: (() => Promise<boolean>) | null;
  /** The sheet finished — words saved or deleted — and the host moves on.
   *  Absent → the sheet closes. */
  onDone?: (() => void) | null;
  nav?: ReactNode;
  onClose: () => void;
}) {
  const chips = useMemo(() => takeChips(history, currentText, COPY.historyTake), [history, currentText]);
  // B10: open where the saved words are, pre-selected -- the current Take,
  // or the earlier Take they were taken from when the current one did not
  // say them (D5).
  const opening = useMemo(() => openingChip(chips, headline), [chips, headline]);
  const [chipAt, setChipAt] = useState(opening.index);
  const chip: TakeChip = chips[chipAt] ?? chips[0];
  const tokens = useMemo(() => phraseTokens(chip.text), [chip.text]);
  const [run, setRun] = useState<PhraseSelection | null>(opening.run);
  // The history can land after the sheet opened (a read slower than the
  // bounded wait). Until the speaker touches anything, the sheet follows it
  // to where the saved words are; after that, nothing moves under her.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    setChipAt(opening.index);
    setRun(opening.run);
  }, [opening]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const chosen = selectionText(chip.text, tokens, run);
  const differs = changed(chosen, headline);
  const moveOn = onDone ?? onClose;

  function chooseChip(index: number) {
    const next = chips[index];
    if (!next) return;
    touched.current = true;
    setChipAt(index);
    // One Take, one phrase (Q3): a fresh selection on the new chip, the
    // saved words pre-selected only on the current one (B10).
    setRun(next.now ? preselect(phraseTokens(next.text), headline) : null);
    setConfirmDelete(false);
  }

  async function use() {
    if (!chosen || !differs || busy) return;
    setBusy(true);
    setFailed(false);
    let ok = false;
    if (chip.now) {
      const span = selectionSpan(chip.text, tokens, run);
      ok = span ? await onUseCurrent(span) : false;
    } else if (onUseFromTake && chip.takeIndex) {
      ok = await onUseFromTake(chosen, chip.takeIndex);
    }
    setBusy(false);
    if (ok) moveOn();
    else setFailed(true);
  }

  async function remove() {
    if (!onDelete || busy) return;
    touched.current = true;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    const ok = await onDelete();
    setBusy(false);
    if (ok) moveOn();
    else setFailed(true);
  }

  const cardWords = confirmDelete ? "" : differs ? chosen : headline;
  const note = replaceNoteTake(history, headline, chip);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.historyHelperWords}
      data-testid="helper-words-sheet"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="flex h-[97dvh] max-h-[97dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {nav ? <div className="shrink-0 pt-3">{nav}</div> : null}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {COPY.historyHelperWords}
          </h2>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2">
          {/* THE WORDS CARD: the only thing that changes as she taps. */}
          <div
            data-testid="helper-words-card"
            data-new={differs && !confirmDelete ? "true" : undefined}
            className="flex flex-col gap-1 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className={EYEBROW}>
                {COPY.historyHelperWords}
                {differs && !confirmDelete ? ` · ${COPY.chipNew}` : ""}
              </span>
              {headline && onDelete && !differs && !confirmDelete ? (
                <button
                  type="button"
                  data-testid="helper-words-delete"
                  onClick={() => void remove()}
                  className="text-[13px] font-semibold text-primary transition-opacity hover:opacity-70"
                >
                  {COPY.helperWordsDelete}
                </button>
              ) : null}
            </div>
            <p className="min-h-[1.5em] text-[20px] font-bold leading-snug text-primary">
              {cardWords}
            </p>
          </div>
          {/* THE TAKE CHIPS, newest first, the current one "now". */}
          <p className={EYEBROW}>
            {COPY.tapWordsFromAnyTake} · {COPY.emphasisCount(selectionLength(run))}
          </p>
          <div className="flex flex-wrap gap-2" data-testid="take-chips">
            {chips.map((c, index) => (
              <button
                key={`${c.label}-${index}`}
                type="button"
                aria-pressed={index === chipAt}
                onClick={() => chooseChip(index)}
                className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors ${
                  index === chipAt
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.now ? `${c.label} · ${COPY.chipNow}` : c.label}
              </button>
            ))}
          </div>
          {/* THAT TAKE'S TEXT, tappable. No playback here (B4). */}
          <div className="rounded-2xl border border-border px-3 py-4">
            <div className="flex flex-wrap gap-0.5" data-testid="picker-tokens">
              {tokens.map((token, index) => {
                const picked = run !== null && index >= run.from && index <= run.to;
                const reachable = canTap(run, index);
                return (
                  <button
                    key={`${token.start}-${token.text}`}
                    type="button"
                    aria-pressed={picked}
                    disabled={!reachable}
                    onClick={() => {
                      touched.current = true;
                      setConfirmDelete(false);
                      setRun(nextSelection(run, index));
                    }}
                    className={`inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[15px] leading-tight transition-colors ${tokenTone(picked, reachable)}`}
                  >
                    {token.text}
                  </button>
                );
              })}
            </div>
          </div>
          {note !== null ? (
            <p data-testid="helper-words-replace-note" className="text-[13px] leading-snug text-muted-foreground">
              {COPY.helperWordsReplaceNote(note)}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="rounded-xl border border-border p-3 text-[13px] text-destructive">
              {COPY.failRoot}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 px-5 pb-6 pt-2">
          {confirmDelete ? (
            <button
              type="button"
              data-testid="helper-words-delete-confirm"
              disabled={busy}
              onClick={() => void remove()}
              className={PILL}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {COPY.helperWordsDeleteConfirm}
            </button>
          ) : (
            <button
              type="button"
              data-testid="helper-words-use"
              disabled={!differs || busy || (!chip.now && !onUseFromTake)}
              onClick={() => void use()}
              className={PILL}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {COPY.pillEmphasise}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
