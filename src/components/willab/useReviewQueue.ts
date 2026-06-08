"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchReviewQueue,
  reconcileReviewQueue,
  type ReviewQueueRow,
} from "@/services/api/reviewQueue";

/* -------------------------------------------------------------------------- */
/*  useReviewQueue — the coach's incoming review queue (§F.1)                  */
/*                                                                            */
/*  Polls /api/v2/coach/queue every REFRESH_MS while mounted; also exposes a   */
/*  `refresh()` callback for explicit nudges (post-save, post-publish, real-   */
/*  time channel events). Soft-fails to [] on any error — the UI shows no      */
/*  bubbles rather than throwing.                                              */
/*                                                                            */
/*  Gate: only fires when `enabled` is true (typically `isCoach`). Non-coach   */
/*  users never hit the endpoint at all; the BFF auth gate would 403 them      */
/*  anyway, but skipping the round-trip keeps the network clean.              */
/* -------------------------------------------------------------------------- */

/** Poll cadence in ms. Slow on purpose — 30s — because the queue is
 *  long-lived. Real-time refresh nudges fire on publish events via the
 *  separate `usePublishLiveSubscription` channel the parent owns. */
const REFRESH_MS = 30_000;

export interface UseReviewQueueResult {
  rows: ReviewQueueRow[];
  loading: boolean;
  /** Force a re-fetch outside the polling cadence. Useful right after the
   *  coach saves a per-snippet draft or publishes a session — the state
   *  changes server-side and the poll wouldn't catch it for up to 30s
   *  otherwise. */
  refresh: () => void;
  /** C2 — optimistically flip a row to `done` IN PLACE, the instant a publish
   *  succeeds, so the Lounge bubble shows ✓ immediately instead of waiting on a
   *  refetch (the BE may not have propagated the state yet). The subsequent
   *  refresh() reconciles with server truth; a no-op if the id isn't present. */
  markDone: (sessionId: string) => void;
}

export function useReviewQueue(enabled: boolean): UseReviewQueueResult {
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef(false);
  // C2 — sessions the FE optimistically published. The BE drops published
  // sessions from /v2/coach/queue, so on refresh we re-merge these as `done`
  // (reconcileReviewQueue) rather than letting the ✓'d bubble vanish.
  const publishedRef = useRef<Map<string, ReviewQueueRow>>(new Map());

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const next = await fetchReviewQueue();
    if (cancelRef.current) return;
    setRows(
      reconcileReviewQueue(next, Array.from(publishedRef.current.values()))
    );
    setLoading(false);
  }, [enabled]);

  const markDone = useCallback((sessionId: string) => {
    setRows((prev) => {
      const row = prev.find((r) => r.sessionId === sessionId);
      // Remember the published row so a later refresh (served WITHOUT published
      // sessions) retains it as ✓ done in place instead of dropping it.
      if (row) publishedRef.current.set(sessionId, { ...row, state: "done" });
      return prev.map((r) =>
        r.sessionId === sessionId ? { ...r, state: "done" } : r
      );
    });
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelRef.current = true;
      clearInterval(id);
    };
  }, [enabled, refresh]);

  return { rows, loading, refresh, markDone };
}
