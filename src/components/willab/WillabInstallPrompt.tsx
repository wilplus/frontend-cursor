"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, PlusSquare, Share } from "lucide-react";
import { usePwaInstall, type InstallPath } from "@/hooks/usePwaInstall";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  WillabInstallPrompt — F2: "Add to home screen" as a thread offer.          */
/*                                                                            */
/*  The install affordance is now a durable Lounge offer (see loungeOffers):    */
/*    - useInstallOffer() exposes the platform primitives + dismiss state, so    */
/*      the Lounge can decide whether to surface an install offer bubble.        */
/*    - InstallOfferActions renders the footer action pair while that offer is   */
/*      open (replacing the record button) — native fires the one-tap prompt,    */
/*      iOS/iPadOS shows the manual Share → Add to Home Screen steps (Apple has  */
/*      no install API), an in-app webview offers a copy-link to open in Safari. */
/* -------------------------------------------------------------------------- */

// Shared key so one dismissal / install suppresses the offer everywhere — we
// never nag across surfaces or sessions.
const DISMISS_KEY = "willab:pwa-install-dismissed:v1";

export interface InstallOffer {
  installPath: InstallPath;
  ready: boolean;
  /** May we surface an install offer at all? (installable platform, not yet
   *  dismissed, detection settled). */
  canOffer: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
  /** Never offer again (install accepted / user confirms they've added it). */
  persistDismiss: () => void;
  /** Hide for now; may offer again next session. */
  softDismiss: () => void;
}

export function useInstallOffer(): InstallOffer {
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

  const persistDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* swallow */
      }
    }
    setDismissed(true);
  }, []);
  const softDismiss = useCallback(() => setDismissed(true), []);

  return {
    installPath: pwa.installPath,
    ready: pwa.ready,
    canOffer: pwa.ready && !dismissed && pwa.installPath !== "none",
    promptInstall: pwa.promptInstall,
    persistDismiss,
    softDismiss,
  };
}

/** The footer action pair for an open install offer. `onResolve` closes the
 *  offer (returns the record button); the bubble stays in the thread. */
export function InstallOfferActions({
  offer,
  onResolve,
}: {
  offer: InstallOffer;
  onResolve: () => void;
}) {
  const isIpad = offer.installPath === "ipad-safari";
  const isIos = offer.installPath === "ios-safari" || isIpad;

  if (offer.installPath === "native") {
    return (
      <SymmetricPair
        closeLabel="Not now"
        onClose={() => {
          offer.softDismiss();
          onResolve();
        }}
        actionLabel="Add to home screen"
        onAction={() => {
          void offer.promptInstall().then((outcome) => {
            // Persist only on accept; a cancel may ask again next session.
            if (outcome === "accepted") offer.persistDismiss();
            else offer.softDismiss();
            onResolve();
          });
        }}
      />
    );
  }

  if (isIos) {
    // No install API on iOS/iPadOS — guide the manual Share path, then confirm.
    return (
      <div className="flex flex-col gap-3">
        <IosSteps isIpad={isIpad} />
        <SymmetricPair
          closeLabel="Not now"
          onClose={() => {
            offer.softDismiss();
            onResolve();
          }}
          actionLabel="Got it"
          onAction={() => {
            offer.persistDismiss();
            onResolve();
          }}
        />
      </div>
    );
  }

  // open-in-safari (in-app webview / Chrome-on-iOS): can't add to home here.
  return <OpenInSafariActions offer={offer} onResolve={onResolve} />;
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
function OpenInSafariActions({
  offer,
  onResolve,
}: {
  offer: InstallOffer;
  onResolve: () => void;
}) {
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
      onClose={() => {
        offer.softDismiss();
        onResolve();
      }}
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
