"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "willab:pwa-install-dismissed:v1";
/** Engagement fallback — show the banner even if the user hasn't reached
 *  /results yet, so we never miss the install moment for power users. */
const ENGAGEMENT_TRIGGER_MS = 3 * 60 * 1000;

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
 * Custom PWA install banner — captures `beforeinstallprompt` immediately so
 * the native event isn't lost, but only renders the banner once one of two
 * triggers fires:
 *   1. The user reaches /results (the natural "you've seen the value" moment)
 *   2. 3 minutes of engagement have elapsed (fallback)
 *
 * Dismissals are persisted in localStorage so we don't nag returning users.
 * The component renders nothing on desktop, when already installed, or when
 * the user has previously dismissed.
 */
export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const shouldEverPrompt = useMemo(
    () => isMobileDevice() && !isStandaloneMode(),
    []
  );

  // Register the service worker independently of the banner. Even if the
  // banner never shows, registration is harmless.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* no-op — install UX still works without SW */
      });
    });
  }, []);

  // Capture the native event the moment the browser fires it. We DO NOT
  // show the banner here — the event is stashed and waits for a trigger.
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

  // Engagement-fallback timer: show the banner after N minutes of use,
  // regardless of which page the user is on.
  useEffect(() => {
    if (!shouldEverPrompt || typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, ENGAGEMENT_TRIGGER_MS);
    return () => window.clearTimeout(timer);
  }, [shouldEverPrompt]);

  // Pathname trigger: show when the user reaches /results (the moment they
  // see the value of the app). Fires for /results and /results/[sessionId].
  useEffect(() => {
    if (!shouldEverPrompt || typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    if (pathname?.startsWith("/results")) {
      setVisible(true);
    }
  }, [pathname, shouldEverPrompt]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        dismiss();
      } else {
        setVisible(false);
      }
      return;
    }

    // iOS Safari has no beforeinstallprompt — fall back to instructions.
    if (isIosSafari()) {
      window.alert('To install: tap Share, then "Add to Home Screen".');
      dismiss();
      return;
    }

    // Other browsers without the event — close quietly.
    setVisible(false);
  };

  if (!visible || !shouldEverPrompt) return null;

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
