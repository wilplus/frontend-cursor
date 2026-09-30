"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMomentsQueue } from "@/services/api/coachWalk";
import type { QueueSpeaker } from "@/lib/willab/coachWalk";

const REFRESH_MS = 30_000;

/** The coach's queue of moments, polled like the review queue. `enabled`
 *  is the render gate (is_coach and the walk switch); the backend gates the
 *  read itself. */
export function useMomentsQueue(enabled: boolean): {
  speakers: QueueSpeaker[];
  loading: boolean;
  refresh: () => void;
} {
  const [speakers, setSpeakers] = useState<QueueSpeaker[]>([]);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const result = await fetchMomentsQueue();
    if (cancelRef.current) return;
    setSpeakers(result.ok ? result.speakers : []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    cancelRef.current = false;
    if (!enabled) {
      setSpeakers([]);
      setLoading(false);
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelRef.current = true;
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  return { speakers, loading, refresh: () => void refresh() };
}
