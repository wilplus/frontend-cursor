"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMomentsQueue } from "@/services/api/coachWalk";
import { speakersWaiting, type QueueSpeaker } from "@/lib/willab/coachWalk";

const REFRESH_MS = 30_000;

/* The last count the bubble showed, kept on this device (founder 2026-10-18:
   the bubble read "Nobody is waiting for you." for a moment on every entry
   while the first read was in flight, then flipped to the real count; it
   has to be right away). A count of people to see, never a value (AC-9);
   every read overwrites it. */
const WAITING_KEY = "willab.coach.waiting";

function rememberedWaiting(): number | null {
  try {
    const raw = window.localStorage.getItem(WAITING_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function rememberWaiting(n: number): void {
  try {
    window.localStorage.setItem(WAITING_KEY, String(n));
  } catch {
    /* private mode or storage off: the next entry waits for the read */
  }
}

/** The coach's queue of moments, polled like the review queue. `enabled`
 *  is the render gate (is_coach and the walk switch); the backend gates the
 *  read itself.
 *
 *  `waiting` is how many speakers wait: null until the queue has been read
 *  once in this mount AND nothing is remembered from an earlier read on this
 *  device, so the bubble never claims "Nobody" before it knows. */
export function useMomentsQueue(enabled: boolean): {
  speakers: QueueSpeaker[];
  waiting: number | null;
  loading: boolean;
  refresh: () => void;
} {
  const [speakers, setSpeakers] = useState<QueueSpeaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [read, setRead] = useState(false);
  const [remembered, setRemembered] = useState<number | null>(null);
  const cancelRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const result = await fetchMomentsQueue();
    if (cancelRef.current) return;
    const next = result.ok ? result.speakers : [];
    setSpeakers(next);
    setLoading(false);
    if (result.ok) {
      setRead(true);
      rememberWaiting(speakersWaiting(next));
    }
  }, [enabled]);

  useEffect(() => {
    cancelRef.current = false;
    if (!enabled) {
      setSpeakers([]);
      setLoading(false);
      setRead(false);
      return;
    }
    setRemembered(rememberedWaiting());
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelRef.current = true;
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  const waiting = read ? speakersWaiting(speakers) : remembered;
  return { speakers, waiting, loading, refresh: () => void refresh() };
}
