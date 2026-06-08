"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/* -------------------------------------------------------------------------- */
/*  WillabInstallPrompt — U10 pt2: "Add to home screen" at the post-send       */
/*  moment in the Lounge — the final beat of the first-run flow.               */
/*                                                                            */
/*  Shows when `show` is true (the user just sent → review_pending) AND the     */
/*  app is installable + on mobile + not already installed + not dismissed.     */
/*  Chromium → the native prompt; iOS Safari (no beforeinstallprompt) → a       */
/*  manual Share → Add to Home Screen sheet. The hook captures the one-shot     */
/*  event as early as the (always-mounted) Lounge mounts, so it isn't missed.   */
/* -------------------------------------------------------------------------- */

// Shared with the global PwaInstallPrompt (/results) so one dismissal / install
// suppresses the prompt everywhere — we never nag across surfaces.
const DISMISS_KEY = "willab:pwa-install-dismissed:v1";

export default function WillabInstallPrompt({ show }: { show: boolean }) {
  const pwa = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* swallow — Safari private mode etc. */
    }
  }, []);

  function persistDismiss() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* swallow */
      }
    }
    setDismissed(true);
  }

  async function onInstall() {
    const outcome = await pwa.promptInstall();
    // Persist only on accept; a cancel hides for this view but may ask again.
    if (outcome === "accepted") persistDismiss();
    else setDismissed(true);
  }

  const installable = pwa.canPromptNative || pwa.isIosSafari;
  const visible =
    show &&
    pwa.ready &&
    pwa.isMobile &&
    !pwa.isStandalone &&
    !dismissed &&
    installable;

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Add WillpowerLab to your home screen"
      className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-foreground">
            Keep WillpowerLab one tap away
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            Add it to your home screen so your coach&apos;s insights are always
            with you.
          </p>
        </div>
        <button
          type="button"
          onClick={persistDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pwa.canPromptNative ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void onInstall()}
            className="rounded-full"
          >
            Add to home screen
          </Button>
        </div>
      ) : (
        // iOS Safari fallback — no native prompt exists, so show the manual path.
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[13px] text-foreground">
          Tap
          <Share className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          then <span className="font-medium">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
