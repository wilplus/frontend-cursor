"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import OverlayCloseButton from "./OverlayCloseButton";
import ProcessingWait, {
  PROCESSING_STAGES,
  type ProcessingProgress,
} from "./ProcessingWait";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  ProcessingResumeOverlay — a VIEW of the Lounge-owned durable job.         */
/*                                                                            */
/*  Deliberately presentation-only: it owns no upload, SSE, polling, retry or  */
/*  document-settle effect. The always-mounted Lounge keeps the one lifecycle */
/*  observer alive while this full-screen view opens and closes above it.      */
/*  It opens by itself when the Lab hands its wait over, and stays over the   */
/*  lens until the walk is on screen (useWaitScreen, founder 2026-10-21).      */
/* -------------------------------------------------------------------------- */

export default function ProcessingResumeOverlay({
  progress,
  phase = "analysis",
  cycleStartedAt,
  phaseStartedAt = null,
  onClose,
}: {
  progress: ProcessingProgress | null;
  /** The resumed job's phase, straight off its marker. This is the view most
   *  exposed to the mislabel it fixes: a resumed job often has no reported
   *  stage at all, and this screen used to answer that with "Processing your
   *  recording" whatever was actually running. */
  phase?: "analysis" | "document";
  cycleStartedAt: number;
  /** When the resumed job entered its CURRENT phase, off the same marker.
   *  The bar's document tail is measured from it. */
  phaseStartedAt?: number | null;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    dialogRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="Close processing"]')
      ?.focus();
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none"
      role="dialog"
      aria-modal="true"
      /* The dialog's name is held to the same standard as the label inside it:
         during the document phase no take is being processed, so it borrows
         the approved stage label rather than naming work that is not running. */
      aria-label={
        phase === "document"
          ? PROCESSING_STAGES[2]
          : "Processing your take"
      }
      onKeyDown={keepFocusInside}
    >
      <header className="flex h-12 shrink-0 items-center justify-end px-4">
        <OverlayCloseButton onClick={onClose} ariaLabel="Close processing" />
      </header>
      {/* THE LAB'S OWN FRAME, to the pixel (founder 2026-10-21: "make it
          stay"). The Lab hands its wait to this view in one commit, so the
          column and the wrapper are the Lab's (labColumnClass and its
          Processing): any difference would be the screen moving. */}
      <div
        className={`scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-6 ${SCREEN_BOTTOM_GAP}`}
      >
        <div className="flex flex-1 flex-col items-center justify-start pt-1 text-center sm:pt-3">
          <ProcessingWait
            progress={progress}
            phase={phase}
            cycleStartedAt={cycleStartedAt}
            phaseStartedAt={phaseStartedAt}
          />
        </div>
      </div>
    </div>
  );
}
