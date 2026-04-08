"use client";

import { useEffect, useMemo, useState } from "react";
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
  const iOSStandalone = "standalone" in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone);
  return inDisplayMode || iOSStandalone;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
  return isIOS && isSafari;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const shouldEverPrompt = useMemo(() => isMobileDevice() && !isStandaloneMode(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Keep install UX even if SW registration fails.
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!shouldEverPrompt || typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 6000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.clearTimeout(timer);
    };
  }, [shouldEverPrompt]);

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

    if (isIosSafari()) {
      window.alert('To install: tap Share, then "Add to Home Screen".');
      dismiss();
      return;
    }

    window.alert("Install is not available in this browser right now.");
    setVisible(false);
  };

  if (!visible || !shouldEverPrompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <p className="text-sm font-medium text-foreground">Install willab on your phone?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Add the app to your home screen for faster access.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Not now
        </Button>
        <Button type="button" size="sm" onClick={() => void handleInstall()}>
          OK
        </Button>
      </div>
    </div>
  );
}

