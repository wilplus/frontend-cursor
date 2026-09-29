"use client";

import { useEffect, useState } from "react";
import {
  currentRingState,
  featureIsOn,
  loadRingState,
  subscribeRingState,
  type RingFeature,
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

/** Whether a ringed feature is on for THIS person (false while loading). */
export function useFeatureOn(feature: RingFeature): boolean {
  const state = useRingState();
  return featureIsOn(state, feature);
}

/**
 * The two switches together: the build carries the code (a `NEXT_PUBLIC_*`
 * building switch) AND the ring reaches this person. Both, or off.
 */
export function useBuiltAndOn(built: boolean, feature: RingFeature): boolean {
  const on = useFeatureOn(feature);
  return built && on;
}
