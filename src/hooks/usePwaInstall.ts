"use client";

import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  usePwaInstall — PWA install mechanics (capture + detect + prompt)          */
/*                                                                            */
/*  Encapsulates the `beforeinstallprompt` capture, platform detection, and    */
/*  the native prompt trigger, so a surface only has to decide WHEN to show an  */
/*  install affordance. UI-free. iOS Safari fires no beforeinstallprompt, so    */
/*  `canPromptNative` stays false there — surfaces show a manual                */
/*  Add-to-Home-Screen sheet instead (gate on `isIosSafari`).                   */
/*                                                                            */
/*  `ready` gates SSR / first-client render: detection runs post-mount so the   */
/*  server and the hydrating client agree ("nothing yet"), avoiding a hydration */
/*  mismatch. Capture the event as early as the consuming surface mounts so a    */
/*  late mount doesn't miss the one-shot event.                                 */
/* -------------------------------------------------------------------------- */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as { standalone?: boolean }).standalone);
  return displayMode || iosStandalone;
}
function detectIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
  return isIOS && isSafari;
}

export interface PwaInstall {
  /** True once post-mount detection has run (use to gate render vs SSR). */
  ready: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  isIosSafari: boolean;
  /** A native install prompt is available (Chromium captured the event). */
  canPromptNative: boolean;
  /** Fire the native prompt; resolves to the user's choice, or null if N/A. */
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
}

export function usePwaInstall(): PwaInstall {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [env, setEnv] = useState({
    ready: false,
    isMobile: false,
    isStandalone: false,
    isIosSafari: false,
  });

  // Post-mount detection (avoids a hydration mismatch with the SSR'd markup).
  useEffect(() => {
    setEnv({
      ready: true,
      isMobile: detectMobile(),
      isStandalone: detectStandalone(),
      isIosSafari: detectIosSafari(),
    });
  }, []);

  // Capture the one-shot native event; preventDefault suppresses the browser's
  // default mini-infobar so the surface owns the timing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null); // consumed — the event can't be re-prompted
    return choice.outcome;
  }, [deferred]);

  return {
    ready: env.ready,
    isMobile: env.isMobile,
    isStandalone: env.isStandalone,
    isIosSafari: env.isIosSafari,
    canPromptNative: deferred !== null,
    promptInstall,
  };
}
