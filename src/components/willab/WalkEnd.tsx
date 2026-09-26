"use client";

import { useEffect, type ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

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
}: {
  text: string | null;
  onGone: () => void;
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
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4"
    >
      <span className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">
        {text}
      </span>
    </div>
  );
}

export function WalkEndCard({
  nextStep,
  onClose,
}: {
  nextStep: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.endCardTitle}
      onClick={onClose}
    >
      <div
        data-walk-end
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-background px-5 pb-6 pt-6 shadow-xl sm:rounded-3xl"
      >
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-foreground">
          {COPY.endCardTitle}
        </h2>
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
}: {
  endCard: boolean;
  renderNextStep?: () => ReactNode;
  onCloseEndCard: () => void;
  toast: string | null;
  onToastGone: () => void;
}) {
  return (
    <>
      {endCard ? (
        <WalkEndCard nextStep={renderNextStep?.() ?? null} onClose={onCloseEndCard} />
      ) : null}
      <SheetToast text={toast} onGone={onToastGone} />
    </>
  );
}
