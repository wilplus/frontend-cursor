"use client";

import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import type { CoachMessage } from "@/services/api/idealText";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";

/** STEP 0 OF THE FEEDBACK SHEET: YOUR COACH (founder 2026-09-29, Q1; Final
 *  Screens L8).
 *
 *  The coach's overall message for the Take, and their video when they
 *  recorded one, before the moments and exercises. The one black button goes
 *  on to the first moment waiting (or simply closes when none is). Same sheet
 *  frame and the same height as the Feedback steps, so it reads as the first
 *  screen of the same overlay rather than a second window.
 *
 *  It exists only on the Ideal Text: never in Recording Mode, Presentation
 *  Mode or export, which do not mount the deck. */
export default function CoachMessageSheet({
  message,
  onContinue,
  onClose,
}: {
  message: CoachMessage;
  onContinue: () => void;
  onClose: () => void;
}) {
  const copy = CHUNK_SHEET_COPY;
  const take = message.takeIndex !== null ? `Take ${message.takeIndex}` : null;
  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.titleCoach}
      data-coach-message-step
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="flex h-[97dvh] max-h-[97dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-foreground/20" />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-2">
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {copy.titleCoach}
          </h2>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-3">
          {message.videoUrl ? (
            <video
              src={message.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-foreground/90"
            />
          ) : null}
          {message.text ? (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              {take ? (
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {take}
                </p>
              ) : null}
              <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
                {message.text}
              </p>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            onClick={onContinue}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.pillContinue}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The deck's mount point: nothing unless step 0 is open and there is a
 *  message. Its own component so the deck gains no branch. */
export function CoachStepLayer({
  step,
  message,
}: {
  step: { open: boolean; proceed: () => void; close: () => void };
  message: CoachMessage | null;
}) {
  if (!step.open || !message) return null;
  return (
    <CoachMessageSheet
      message={message}
      onContinue={step.proceed}
      onClose={step.close}
    />
  );
}
