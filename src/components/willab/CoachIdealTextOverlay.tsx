"use client";

import OverlayCloseButton from "./OverlayCloseButton";
import CoachIdealTextPanel from "./CoachIdealTextPanel";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  CoachIdealTextOverlay — the coach's Ideal Text review, full screen.        */
/*                                                                            */
/*  Until 2026-09-16 this was the coach branch of BestPresentationOverlay     */
/*  (audit Q-T4: Best Presentation is retired, L1). Byte-for-byte the same    */
/*  header and panel; the panel fetches the coach lane itself and falls back  */
/*  to the deck ref that lane echoes, so no deck ref is threaded in here.     */
/* -------------------------------------------------------------------------- */

export default function CoachIdealTextOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  // R7 — the shared stack-aware back-dismiss (an inline popstate listener would
  // bypass the overlay stack and cascade-close everything underneath).
  useBackDismiss(onClose);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          Ideal text · coach review
        </span>
        <OverlayCloseButton onClick={onClose} />
      </div>
      <CoachIdealTextPanel arcId={arcId} presentationRef={null} />
    </div>
  );
}
