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
      /* THE BUILD ID IS THE REGISTRATION (founder 2026-09-18).
       *
       * Registered as a bare "/sw.js", the browser only reinstalls when the
       * FILE's bytes change — so `CACHE_NAME` had to be bumped by hand, and a
       * deploy that forgot left phones on the previous shell with nothing to
       * point at. `activate` empties every cache that is not the current name,
       * so that name is the only flush there is.
       *
       * A per-build query makes the URL itself the version: a URL the browser
       * has not seen is a new worker, it installs, `skipWaiting` takes it live
       * and `clients.claim` moves the open page onto it. The worker reads the
       * same value back off its own location for the cache name, so the two
       * cannot drift — there is one version, and it is this string.
       *
       * Absent id → plain "/sw.js", exactly today's behaviour. Never
       * "?v=undefined", which is a hand-bumped constant wearing a query. */
      const build = process.env.NEXT_PUBLIC_BUILD_ID;
      const url = build ? `/sw.js?v=${encodeURIComponent(build)}` : "/sw.js";
      navigator.serviceWorker.register(url).catch(() => {
        /* no-op — install/offline degrade gracefully without the SW */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
