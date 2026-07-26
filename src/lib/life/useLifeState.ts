"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLifeState } from "@/services/api/life";
import type { LifeState } from "./types";

/* -------------------------------------------------------------------------- */
/*  useLifeState — the single read of the gate, shared across the app          */
/*                                                                            */
/*  Both the product hamburger and every panel view need the same `/state`     */
/*  payload, and neither may fetch it twice per page load. The promise is      */
/*  cached at module scope so the second caller joins the first call.          */
/*                                                                            */
/*  A rejected fetch resolves to null, not to an error state. For almost every */
/*  user this endpoint 404s, and that is the normal answer, not a fault: the   */
/*  panel simply is not there. Nothing is logged, nothing is toasted, and no   */
/*  caller renders a placeholder for it (N1).                                  */
/* -------------------------------------------------------------------------- */

let cache: Promise<LifeState | null> | null = null;

type Listener = (state: LifeState | null) => void;
const listeners = new Set<Listener>();

/**
 * Watch the gate.
 *
 * The app header reads this once per page load, but the gate CHANGES mid-
 * session: finishing setup turns seven menu entries on. Without a
 * subscription the header would keep showing the single Principles entry until
 * the next full reload, which reads as the setup not having worked.
 */
export function subscribeLifeState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadLifeState(force = false): Promise<LifeState | null> {
  if (force || !cache) {
    const pending = fetchLifeState().catch(() => null);
    cache = pending;
    void pending.then((state) => {
      // Only the newest read may notify: a stale in-flight request resolving
      // after a refresh must not push the pre-refresh gate back out.
      if (cache !== pending) return;
      listeners.forEach((listener) => listener(state));
    });
  }
  return cache;
}

/** Drop the cache after consent or setup completes, so the next read sees the
 *  new gate state rather than the one from before the write. */
export function invalidateLifeState(): void {
  cache = null;
}

export interface UseLifeState {
  state: LifeState | null;
  loading: boolean;
  refresh: () => Promise<LifeState | null>;
}

export function useLifeState(): UseLifeState {
  const [state, setState] = useState<LifeState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    invalidateLifeState();
    const next = await loadLifeState(true);
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadLifeState().then((s) => {
      if (cancelled) return;
      setState(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, loading, refresh };
}
