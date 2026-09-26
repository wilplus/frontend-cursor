"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** A signed media link without its signature: same path = same file. */
function mediaPath(url: string | null): string | null {
  if (!url) return null;
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** Signed links are reused only while they are surely still valid. */
const STABLE_LINK_MAX_AGE_MS = 30 * 60_000;

/* KEEP THE SAME LINK FOR THE SAME FILE (founder 2026-09-26: the coach review
   "is just very long"). Every blind answer refreshes the whole session, and
   the server signs every media link afresh on each read. A new signature is a
   new URL, so the deck PDF (cached by URL) downloaded again, the slide
   flashed back to loading, and every clip's audio reloaded, for files that
   had not changed. When a link points at the same file as the one already
   on screen, and that one is recent, keep it. Only the links: every other
   field, the owner answer and the transcript included, is taken from the
   server's fresh response exactly as sent. */
export function keepStableMediaLinks(
  prev: CoachReviewSession | null,
  next: CoachReviewSession,
): CoachReviewSession {
  if (!prev || prev.sessionId !== next.sessionId) return next;
  const same = (a: string | null, b: string | null) =>
    a !== null && b !== null && mediaPath(a) === mediaPath(b) ? a : b;
  const prevAudio = new Map(prev.snippets.map((s) => [s.id, s.audioRef]));
  return {
    ...next,
    videoRef: same(prev.videoRef, next.videoRef),
    presentationRef: same(prev.presentationRef, next.presentationRef),
    snippets: next.snippets.map((s) => {
      const before = prevAudio.get(s.id) ?? null;
      const audioRef = same(before, s.audioRef);
      return audioRef === s.audioRef ? s : { ...s, audioRef };
    }),
  };
}

export function useCoachReview(sessionId: string | null): UseCoachReviewResult {
  const [session, setSession] = useState<CoachReviewSession | null>(null);
  const [status, setStatus] = useState<CoachReviewStatus>("loading");
  // When the links now on screen were signed; reuse stops after the max age.
  const signedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const next = await fetchCoachReviewSession(sessionId);
    if (next) {
      const fresh = Date.now() - signedAt.current > STABLE_LINK_MAX_AGE_MS;
      if (fresh) signedAt.current = Date.now();
      setSession((prev) => (fresh ? next : keepStableMediaLinks(prev, next)));
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
        signedAt.current = Date.now();
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
