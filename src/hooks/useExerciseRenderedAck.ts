"use client";

import { useCallback, useEffect, useRef } from "react";
import { reportExerciseRendered } from "@/services/api/exerciseRendered";
import type { DocumentSuggestion } from "@/services/api/idealText";

/** Cards already confirmed in this page view, keyed snippet + exercise. The
 *  backend records once per offer anyway; this only keeps the call to one. */
const sent = new Set<string>();

/** Test seam: a fresh page view. */
export function resetExerciseRenderedForTests(): void {
  sent.clear();
}

/** About half the card on screen. A card taller than twice its scroll box can
 *  never reach 50% of itself, so half the box filled counts as well. */
function halfVisible(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= 0.5) return true;
  const root = entry.rootBounds;
  return root !== null && entry.intersectionRect.height >= root.height * 0.5;
}

/**
 * MLC-3 §3.5 — an exercise counts as shown only once the speaker's app
 * confirms it rendered. Returns a ref for the EXISTING exercise card element:
 * nothing is added to the page, and loading the data is not a render. The
 * first time the card is about half visible, the confirmation goes out once,
 * fire-and-forget. A 409 (the card shows a stale offer) calls `onStale` so the
 * host re-reads the Ideal Text; nothing is ever retried or shown.
 */
export function useExerciseRenderedAck(
  item: DocumentSuggestion | null,
  onStale?: (() => void) | null,
): (element: Element | null) => void {
  const snippetId = item?.snippetId ?? null;
  const exerciseId = item?.practiceExercise?.exerciseId ?? null;
  const key = snippetId && exerciseId ? `${snippetId}:${exerciseId}` : null;
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;
  const observer = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback(() => {
    observer.current?.disconnect();
    observer.current = null;
  }, []);
  useEffect(() => disconnect, [disconnect]);

  return useCallback(
    (element: Element | null) => {
      disconnect();
      if (!element || !key || !snippetId || !exerciseId || sent.has(key)) return;
      if (typeof IntersectionObserver === "undefined") return;
      const io = new IntersectionObserver(
        (entries) => {
          if (sent.has(key) || !entries.some(halfVisible)) return;
          sent.add(key);
          io.disconnect();
          void reportExerciseRendered(snippetId, exerciseId).then((outcome) => {
            if (outcome === "stale") onStaleRef.current?.();
          });
        },
        { threshold: [0, 0.25, 0.5] },
      );
      observer.current = io;
      io.observe(element);
    },
    [disconnect, key, snippetId, exerciseId],
  );
}
