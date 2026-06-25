"use client";

import { useEffect, useState } from "react";
import { ArrowDown, PlusSquare, Share } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  WillabInstallPrompt — F2: "Add to home screen" as an in-thread bubble at    */
/*  the post-send moment in the Lounge (the final beat of the first-run flow).  */
/*                                                                            */
/*  Renders inline in the footer CTA stack (not a floating popup) as a bot      */
/*  bubble + the shared SymmetricPair — the same grey-outline / orange shape as  */
/*  the overlay Back | Next nav and the F1/F7 beats.                            */
/*                                                                            */
/*  Shows when `show` is true (the user just sent → review_pending) AND the     */
/*  hook resolves a real install affordance for this platform (installPath !=   */
/*  "none") AND the user hasn't dismissed it. The single surface for install    */
/*  across the app.                                                             */
/*                                                                            */
/*  Branches on `installPath` (platform matrix lives in the hook):              */
/*    native        → orange button fires the one-tap native prompt             */
/*    ios/ipad-safari→ guided manual Share → Add to Home Screen steps           */
/*    open-in-safari → "open in Safari" message + copy-link action              */
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

  // Persist-dismiss: never show again (install accepted, or the user confirms
  // they've added it). Soft-dismiss: hide for now, may offer again next session.
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
  function softDismiss() {
    setDismissed(true);
  }

  async function onInstall() {
    const outcome = await pwa.promptInstall();
    // Persist only on accept; a cancel hides for this view but may ask again.
    if (outcome === "accepted") persistDismiss();
    else softDismiss();
  }

  const { installPath } = pwa;
  const visible = show && pwa.ready && !dismissed && installPath !== "none";

  if (!visible) return null;

  const isIpad = installPath === "ipad-safari";
  const isIosCard = installPath === "ios-safari" || isIpad;

  return (
    <div
      role="group"
      aria-label="Add WillpowerLab to your home screen"
      className="flex flex-col gap-3"
    >
      <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-[15px] leading-relaxed text-foreground">
        {installPath === "open-in-safari"
          ? "Open this page in Safari to add WillpowerLab to your home screen, so your coach's insights are always one tap away."
          : "Keep WillpowerLab one tap away. Add it to your home screen so your coach's insights are always with you."}
      </div>

      {/* iOS / iPadOS Safari can't be invoked programmatically — show the manual
          Share → Add to Home Screen steps, then a confirm / dismiss pair. */}
      {isIosCard ? <IosSteps isIpad={isIpad} /> : null}

      {installPath === "native" ? (
        <SymmetricPair
          closeLabel="Not now"
          onClose={softDismiss}
          actionLabel="Add to home screen"
          onAction={() => void onInstall()}
        />
      ) : isIosCard ? (
        <SymmetricPair
          closeLabel="Not now"
          onClose={softDismiss}
          actionLabel="Got it"
          onAction={persistDismiss}
        />
      ) : (
        <OpenInSafariPair onDismiss={softDismiss} />
      )}
    </div>
  );
}

/* iOS / iPadOS Safari: no install API exists, so guide the manual Share path. */
function IosSteps({ isIpad }: { isIpad: boolean }) {
  return (
    <div className="rounded-xl bg-muted p-3">
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

/* In-app webview (Instagram/FB/…) or Chrome-on-iOS: cannot add to home here.
   The orange action copies the URL so the user can paste it into Safari. */
function OpenInSafariPair({ onDismiss }: { onDismiss: () => void }) {
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
    <SymmetricPair
      closeLabel="Not now"
      onClose={onDismiss}
      actionLabel={copied ? "Link copied" : "Copy link"}
      onAction={copyLink}
    />
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
