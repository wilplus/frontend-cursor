"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, Copy, PlusSquare, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/* -------------------------------------------------------------------------- */
/*  WillabInstallPrompt — U10 pt2: "Add to home screen" at the post-send       */
/*  moment in the Lounge — the final beat of the first-run flow.               */
/*                                                                            */
/*  Shows when `show` is true (the user just sent → review_pending) AND the     */
/*  hook resolves a real install affordance for this platform (installPath !=   */
/*  "none") AND the user hasn't dismissed it. The single surface for install    */
/*  across the app (the old /results-gated PwaInstallPrompt was retired).       */
/*                                                                            */
/*  Branches on `installPath` (platform matrix lives in the hook):              */
/*    native        → one-tap native prompt (Android/Chromium)                  */
/*    ios/ipad-safari→ guided manual Share → Add to Home Screen card            */
/*    open-in-safari → "open in Safari" message (in-app webview / CriOS)        */
/* -------------------------------------------------------------------------- */

// Shared key so one dismissal / install suppresses the prompt everywhere — we
// never nag across surfaces or sessions.
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

  const { installPath } = pwa;
  const visible = show && pwa.ready && !dismissed && installPath !== "none";

  if (!visible) return null;

  const isIpad = installPath === "ipad-safari";
  const isIosCard = installPath === "ios-safari" || isIpad;

  return (
    <div
      role="dialog"
      aria-label="Add WillpowerLab to your home screen"
      className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      {/* iPad's Share lives top-right — point an arrow up toward it. */}
      {isIpad ? (
        <ArrowUpRight
          className="absolute -right-1 -top-3 h-6 w-6 animate-bounce text-primary"
          aria-hidden
        />
      ) : null}

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

      {installPath === "native" ? (
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
      ) : installPath === "open-in-safari" ? (
        <OpenInSafariCard />
      ) : isIosCard ? (
        <IosSteps isIpad={isIpad} />
      ) : null}
    </div>
  );
}

/* iOS / iPadOS Safari: no install API exists, so guide the manual Share path. */
function IosSteps({ isIpad }: { isIpad: boolean }) {
  return (
    <div className="mt-3 rounded-xl bg-muted p-3">
      <div className="mb-2 flex items-center gap-2">
        <BrandMark />
        <span className="text-[13px] font-medium text-foreground">
          Add WillpowerLab to your Home Screen
        </span>
      </div>
      <ol className="flex flex-col gap-2 text-[13px] text-foreground">
        <li className="flex items-center gap-2">
          <StepNumber n={1} />
          <span className="flex flex-wrap items-center gap-1">
            Tap
            <Share className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="font-medium">Share</span>
            <span className="text-muted-foreground">
              {isIpad ? "(top-right)" : "(in the bottom bar)"}
            </span>
          </span>
        </li>
        <li className="flex items-center gap-2">
          <StepNumber n={2} />
          <span className="flex flex-wrap items-center gap-1">
            Choose
            <PlusSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="font-medium">Add to Home Screen</span>
          </span>
        </li>
      </ol>
      {/* iPhone's Share is in the bottom toolbar — nudge downward. */}
      {!isIpad ? (
        <ArrowDown
          className="mx-auto mt-2 h-5 w-5 animate-bounce text-primary"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/* In-app webview (Instagram/FB/…) or Chrome-on-iOS: cannot add to home here. */
function OpenInSafariCard() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (typeof window === "undefined") return;
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => setCopied(true))
      .catch(() => {
        /* swallow — clipboard blocked; the instruction still stands */
      });
  }

  return (
    <div className="mt-3 rounded-xl bg-muted p-3">
      <p className="text-[13px] leading-relaxed text-foreground">
        Open this page in Safari to add it to your Home Screen.
      </p>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={copyLink}
          className="gap-1.5 rounded-full"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

/* The WillpowerLab mark (three dots on white) — mirrors /icon (src/app/icon.tsx)
 * without a network fetch. */
function BrandMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center gap-[3px] rounded-xl bg-white ring-1 ring-border">
      <span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#111]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#111]" />
    </span>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
      {n}
    </span>
  );
}
