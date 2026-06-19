"use client";

import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/*  ServiceWorkerRegistrar — side-effect only; renders nothing.                */
/*                                                                            */
/*  Registers the hand-written /sw.js once, app-wide. This is the PWA's        */
/*  baseline: it's what makes the app installable (Chromium fires              */
/*  `beforeinstallprompt` only with a registered SW + manifest) and what       */
/*  powers offline. Lives here, in the always-mounted layout, so it survives   */
/*  independent of any install-popup UI (it used to be a side effect of the    */
/*  now-removed /results-gated PwaInstallPrompt).                              */
/* -------------------------------------------------------------------------- */

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* no-op — install/offline degrade gracefully without the SW */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
