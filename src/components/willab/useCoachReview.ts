"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCoachReviewSession,
  type CoachReviewSession,
} from "@/services/api/coachReview";

/* -------------------------------------------------------------------------- */
/*  useCoachReview — fetch + cache the per-session review payload (§F.2)       */
/*                                                                            */
/*  One fetch when sessionId changes. Soft-fails to null on any error so the   */
/*  overlay can render its own error state. `refresh()` re-fetches without      */
/*  remounting — useful after a successful save to confirm BE state.           */
/* -------------------------------------------------------------------------- */

export type CoachReviewStatus = "loading" | "ready" | "error";

export interface UseCoachReviewResult {
  status: CoachReviewStatus;
  session: CoachReviewSession | null;
  refresh: () => Promise<void>;
}

export function useCoachReview(sessionId: string | null): UseCoachReviewResult {
  const [session, setSession] = useState<CoachReviewSession | null>(null);
  const [status, setStatus] = useState<CoachReviewStatus>("loading");

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const next = await fetchCoachReviewSession(sessionId);
    if (next) {
      setSession(next);
      setStatus("ready");
    } else {
      setSession(null);
      setStatus("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setStatus("loading");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    void fetchCoachReviewSession(sessionId).then((next) => {
      if (cancelled) return;
      if (next) {
        setSession(next);
        setStatus("ready");
      } else {
        setSession(null);
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { status, session, refresh };
}
