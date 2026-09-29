"use client";

import { useEffect, type ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import type { BehindNotice } from "./saveBehind";

/* -------------------------------------------------------------------------- */
/*  The walk's two closing signals (founder 2026-09-26, Ideal Text redesign   */
/*  B, accepted screens L0).                                                  */
/*                                                                            */
/*  SheetToast — "Helper words saved" / "Answer saved" for a moment after a   */
/*  sheet finishes on its own. It used to close in silence, most sharply on   */
/*  No and Audio unclear, where nothing on the page changed at all.           */
/*                                                                            */
/*  WalkEndCard — after the last moment: the host's next step (the next take, */
/*  or the guided See next steps) and the way back to the text. The host's    */
/*  own control is drawn here rather than a copy of it, so the card can never */
/*  offer a different next step from the page's bottom button.               */
/* -------------------------------------------------------------------------- */

export function SheetToast({
  text,
  onGone,
  inline = false,
}: {
  text: string | null;
  onGone: () => void;
  /** Drawn in flow, just above the end card, rather than fixed over the
   *  page: fixed at bottom-24 it sat on the card's black pill. */
  inline?: boolean;
}) {
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(onGone, 1800);
    return () => clearTimeout(timer);
  }, [text, onGone]);
  if (!text) return null;
  return (
    <div
      role="status"
      data-sheet-toast
      className={
        inline
          ? "pointer-events-none flex justify-center px-4 pb-3"
          : "pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4"
      }
    >
      <span className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">
        {text}
      </span>
    </div>
  );
}

/** A save that failed after its sheet moved on (tap and go, founder
 *  2026-09-28). It stays up for eight seconds, just above the "saved" line,
 *  and Retry sends the same write again. */
export function SaveBehindNotice({
  notice,
  onGone,
}: {
  notice: BehindNotice | null;
  onGone: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onGone, 8000);
    return () => clearTimeout(timer);
  }, [notice, onGone]);
  if (!notice) return null;
  return (
    <div
      role="alert"
      data-save-behind
      className="fixed inset-x-0 bottom-36 z-[71] flex justify-center px-4"
    >
      <div className="flex w-full max-w-sm items-center justify-between gap-4 rounded-2xl bg-foreground px-4 py-3 text-[14px] text-background shadow-lg">
        <span>{notice.text}</span>
        {notice.retry ? (
          <button
            type="button"
            onClick={notice.retry}
            className="shrink-0 font-semibold text-primary"
          >
            {COPY.retryBehind}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WalkEndCard({
  nextStep,
  onClose,
  above = null,
}: {
  nextStep: ReactNode;
  onClose: () => void;
  /** The "saved" line of the last moment, drawn above the card so it never
   *  covers the card's own button. */
  above?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.endCardTitle}
      onClick={onClose}
    >
      <div className="flex w-full max-w-lg flex-col">
        {above}
        <div
          data-walk-end
          onClick={(event) => event.stopPropagation()}
          className="flex w-full flex-col gap-3 rounded-t-3xl bg-background px-5 pb-6 pt-6 shadow-xl sm:rounded-3xl"
        >
          <h2 className="text-[20px] font-bold tracking-[-0.01em] text-foreground">
            {COPY.endCardTitle}
          </h2>
          {/* The note line under the title (Final Screens L0). */}
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {COPY.endCardNote}
          </p>
          {nextStep}
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center text-[15px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {COPY.endCardBack}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Both closing signals, mounted by the deck as one element so the deck
 *  gains no branch (it sits at the complexity ratchet's ceiling). */
export function WalkEndLayer({
  endCard,
  renderNextStep,
  onCloseEndCard,
  toast,
  onToastGone,
  notice = null,
  onNoticeGone = () => {},
}: {
  endCard: boolean;
  renderNextStep?: () => ReactNode;
  onCloseEndCard: () => void;
  toast: string | null;
  onToastGone: () => void;
  notice?: BehindNotice | null;
  onNoticeGone?: () => void;
}) {
  // While the end card is up the toast rides above it (audit 2026-09-29:
  // fixed at bottom-24 it sat on the card's black pill).
  const toastNode = <SheetToast text={toast} onGone={onToastGone} inline={endCard} />;
  return (
    <>
      {endCard ? (
        <WalkEndCard
          nextStep={renderNextStep?.() ?? null}
          onClose={onCloseEndCard}
          above={toastNode}
        />
      ) : (
        toastNode
      )}
      <SaveBehindNotice notice={notice} onGone={onNoticeGone} />
    </>
  );
}
