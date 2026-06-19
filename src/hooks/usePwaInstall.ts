"use client";

import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  usePwaInstall — PWA install mechanics (capture + detect + prompt)          */
/*                                                                            */
/*  Encapsulates the `beforeinstallprompt` capture, platform detection, and    */
/*  the native prompt trigger, so a surface only has to decide WHEN to show an  */
/*  install affordance. UI-free. A surface switches on `installPath`, which     */
/*  collapses the platform matrix into one decision:                            */
/*    native        Chromium captured beforeinstallprompt → one-tap prompt      */
/*    ios-safari     iPhone real Safari → manual Share → Add to Home Screen      */
/*    ipad-safari    iPad real Safari (iPadOS 13+ reports as "Macintosh")        */
/*    open-in-safari iOS family but NOT real Safari (CriOS/FxiOS/in-app webview) */
/*                   → can't add to home; tell the user to open in Safari        */
/*    none           standalone (already installed) / desktop / unknown          */
/*                                                                            */
/*  iOS cannot be automated: there is NO web API to trigger Add-to-Home-Screen   */
/*  on Safari. The only lever off `native` is a clearer instruction.            */
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

/** iPadOS 13+ masquerades as desktop Safari ("Macintosh" UA). The touch-point
 *  count is the tell — Macs report 0. Pure so the matrix stays unit-testable. */
export function detectIpadOS(ua: string, maxTouchPoints: number): boolean {
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/** UA tokens for embedded webviews (Instagram/Facebook/LinkedIn/etc.). These
 *  cannot add to the home screen, so on iOS they get "open in Safari", never
 *  the (non-working) Share instruction. Pure. */
export function detectInAppBrowser(ua: string): boolean {
  return /(FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Twitter|TikTok|musical_ly|Snapchat|Pinterest)/i.test(
    ua
  );
}

export type InstallPath =
  | "native"
  | "ios-safari"
  | "ipad-safari"
  | "open-in-safari"
  | "none";

/** Single source of truth for which install affordance (if any) a surface
 *  shows. Pure — the hook feeds it detected env so it stays unit-testable
 *  against the full platform matrix without a DOM. */
export function resolveInstallPath(p: {
  ready: boolean;
  isStandalone: boolean;
  canPromptNative: boolean;
  iosFamily: boolean;
  isIpad: boolean;
  isRealSafari: boolean;
}): InstallPath {
  if (!p.ready || p.isStandalone) return "none";
  if (p.canPromptNative) return "native";
  if (p.iosFamily) {
    if (p.isRealSafari) return p.isIpad ? "ipad-safari" : "ios-safari";
    return "open-in-safari";
  }
  return "none";
}

export interface PwaInstall {
  /** True once post-mount detection has run (use to gate render vs SSR). */
  ready: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  isIosSafari: boolean;
  /** A native install prompt is available (Chromium captured the event). */
  canPromptNative: boolean;
  /** The platform-appropriate install affordance to render (the only field a
   *  surface needs to switch on). */
  installPath: InstallPath;
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
    iosFamily: false,
    isIpad: false,
    isRealSafari: false,
  });

  // Post-mount detection (avoids a hydration mismatch with the SSR'd markup).
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const uaLower = ua.toLowerCase();
    const maxTouch =
      typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
    const isIpad = detectIpadOS(ua, maxTouch);
    const iosFamily = /iphone|ipad|ipod/.test(uaLower) || isIpad;
    const isRealSafari =
      iosFamily &&
      /safari/.test(uaLower) &&
      !/crios|fxios|edgios|opios/.test(uaLower) &&
      !detectInAppBrowser(ua);
    setEnv({
      ready: true,
      isMobile: detectMobile() || isIpad,
      isStandalone: detectStandalone(),
      isIosSafari: detectIosSafari(),
      iosFamily,
      isIpad,
      isRealSafari,
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

  const installPath = resolveInstallPath({
    ready: env.ready,
    isStandalone: env.isStandalone,
    canPromptNative: deferred !== null,
    iosFamily: env.iosFamily,
    isIpad: env.isIpad,
    isRealSafari: env.isRealSafari,
  });

  return {
    ready: env.ready,
    isMobile: env.isMobile,
    isStandalone: env.isStandalone,
    isIosSafari: env.isIosSafari,
    canPromptNative: deferred !== null,
    installPath,
    promptInstall,
  };
}
