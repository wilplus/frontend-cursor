"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  willab feature flag — willab is now the DEFAULT product (D1 = REPLACE)      */
/*                                                                            */
/*  willab renders by default at `/chat` (and via the `/` → `/chat` redirect,  */
/*  the whole app). The legacy funnel stays reachable only as a transition      */
/*  escape hatch until the clearing phase removes it: set env                  */
/*  `NEXT_PUBLIC_WILLAB_BETA=0`, or the `localStorage` override `"0"`.         */
/*                                                                            */
/*  Env is SSR-consistent (the branch renders server-side with no hydration    */
/*  mismatch); the override is applied POST-mount only so it can't desync       */
/*  SSR ↔ client hydration.                                                    */
/* -------------------------------------------------------------------------- */

const ENV_ON = process.env.NEXT_PUBLIC_WILLAB_BETA !== "0";
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
