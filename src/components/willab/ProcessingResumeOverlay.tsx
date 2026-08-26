"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import OverlayCloseButton from "./OverlayCloseButton";
import ProcessingWait, { type ProcessingProgress } from "./ProcessingWait";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  ProcessingResumeOverlay — a VIEW of the Lounge-owned durable job.         */
/*                                                                            */
/*  Deliberately presentation-only: it owns no upload, SSE, polling, retry or  */
/*  document-settle effect. The always-mounted Lounge keeps the one lifecycle */
/*  observer alive while this full-screen view opens and closes above it.      */
/* -------------------------------------------------------------------------- */

export default function ProcessingResumeOverlay({
  progress,
  cycleStartedAt,
  onClose,
}: {
  progress: ProcessingProgress | null;
  cycleStartedAt: number;
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
      aria-label="Processing your take"
      onKeyDown={keepFocusInside}
    >
      <header className="flex h-12 shrink-0 items-center justify-end px-4">
        <OverlayCloseButton onClick={onClose} ariaLabel="Close processing" />
      </header>
      <div
        className={`scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col items-center overflow-y-auto px-4 pt-6 ${SCREEN_BOTTOM_GAP}`}
      >
        <ProcessingWait progress={progress} cycleStartedAt={cycleStartedAt} />
      </div>
    </div>
  );
}
