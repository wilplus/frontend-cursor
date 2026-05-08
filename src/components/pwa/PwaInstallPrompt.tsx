"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "willab:pwa-install-dismissed:v1";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const inDisplayMode = window.matchMedia("(display-mode: standalone)").matches;
  const iOSStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as { standalone?: boolean }).standalone);
  return inDisplayMode || iOSStandalone;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
  return isIOS && isSafari;
}

/**
 * Custom PWA install banner — strictly route-gated.
 *
 * Visible iff ALL of:
 *   • Mobile device, not already installed (shouldEverPrompt)
 *   • Current pathname starts with "/results"
 *   • The browser has fired `beforeinstallprompt` and we've captured it
 *   • The user hasn't previously dismissed the banner (DISMISS_KEY)
 *
 * No engagement timer, no other trigger paths. If the user navigates away
 * from /results without interacting with the banner, it disappears
 * automatically (visibility is derived per render, not latched in state).
 */
export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const shouldEverPrompt = useMemo(
    () => isMobileDevice() && !isStandaloneMode(),
    []
  );

  // Hydrate the dismissed flag from localStorage on mount so we never re-prompt
  // a returning user who previously closed the banner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      /* swallow — Safari private mode etc. */
    }
  }, []);

  // Register the service worker independently of the banner. Harmless if the
  // banner never shows; install UX still works without SW for browsers that
  // expose `beforeinstallprompt`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* no-op */
      });
    });
  }, []);

  // Capture the native event the moment the browser fires it. We don't show
  // the banner here — visibility is derived from pathname + dismissed +
  // deferredPrompt presence at render time.
  useEffect(() => {
    if (!shouldEverPrompt || typeof window === "undefined") return;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [shouldEverPrompt]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* swallow */
      }
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        dismiss();
      } else {
        // Don't persist dismissal on user-cancel — hide for this view only.
        setDismissed(true);
      }
      return;
    }

    // Defensive: with the strict gate below the banner can't render unless
    // deferredPrompt is non-null. Kept for safety in case the gate ever
    // weakens — iOS Safari has no beforeinstallprompt event.
    if (isIosSafari()) {
      window.alert('To install: tap Share, then "Add to Home Screen".');
      dismiss();
      return;
    }
    setDismissed(true);
  };

  const onResults = pathname?.startsWith("/results") ?? false;
  const visible =
    shouldEverPrompt && onResults && !dismissed && deferredPrompt !== null;

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Willab"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <p className="text-sm font-medium text-foreground">
        Add Willab to your home screen for the best experience.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
        <Button type="button" size="sm" onClick={() => void handleInstall()}>
          Install
        </Button>
      </div>
    </div>
  );
}
