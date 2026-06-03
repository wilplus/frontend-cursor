"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  willab commercial-beta feature flag                                        */
/*                                                                            */
/*  Build-time env (`NEXT_PUBLIC_WILLAB_BETA=1`) is the source of truth — it's  */
/*  SSR-consistent, so the flag-on branch can render server-side without a     */
/*  hydration mismatch. A `localStorage` override lets a tester flip it        */
/*  without a redeploy; it's applied POST-mount only (never in the first       */
/*  render) so it can't desync SSR ↔ client hydration.                        */
/*                                                                            */
/*  While the flag is OFF, the legacy `/chat` funnel renders unchanged — the   */
/*  willab beta is built entirely behind this flag (keeps `main` shippable).  */
/* -------------------------------------------------------------------------- */

const ENV_ON = process.env.NEXT_PUBLIC_WILLAB_BETA === "1";
export const WILLAB_BETA_OVERRIDE_KEY = "willab.beta_override";

/** Env-only read for non-React contexts (the localStorage override is
 *  React-gated to stay hydration-safe — use the hook in components). */
export function isWillabBetaEnv(): boolean {
  return ENV_ON;
}

/**
 * SSR-safe flag for components: returns the env value on the first render
 * (matches the server), then applies the `localStorage` override post-mount.
 * Override values: `"1"` → force on, `"0"` → force off, absent → env.
 */
export function useWillabBetaFlag(): boolean {
  const [on, setOn] = useState(ENV_ON);
  useEffect(() => {
    try {
      const o = window.localStorage.getItem(WILLAB_BETA_OVERRIDE_KEY);
      if (o === "1") setOn(true);
      else if (o === "0") setOn(false);
    } catch {
      /* private mode — fall back to env */
    }
  }, []);
  return on;
}
