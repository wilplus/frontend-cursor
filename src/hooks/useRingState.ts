"use client";

import { useEffect, useState } from "react";
import {
  currentRingState,
  loadRingState,
  subscribeRingState,
  type RingState,
} from "@/services/api/rings";

/**
 * The person's ring state, shared across every component on the page (one
 * read per load; see services/api/rings.ts). `null` while the first read is
 * in flight — treat it as "not on yet", never as "off for good".
 */
export function useRingState(): RingState | null {
  const [state, setState] = useState<RingState | null>(() => currentRingState());
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeRingState((next) => {
      if (!cancelled) setState(next);
    });
    void loadRingState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  return state;
}
