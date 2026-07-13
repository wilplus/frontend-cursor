"use client";

import { useEffect, useRef } from "react";
import { fetchSessionReadout } from "@/services/api/sessionReadout";
import { fetchGuestLabReadout } from "@/services/api/labRecording";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  useSayItStrongerPolling — bug 4: the cards land a few seconds AFTER the      */
/*  readout first loads (async BE generation). Comments are always-visible       */
/*  now (P6) — CommentBlock already shows a "sharpening…" shimmer while a        */
/*  snippet's sayItStronger is null, but nothing ever re-fetched to pick up      */
/*  the generated card, so the shimmer just sat there forever.                  */
/*                                                                            */
/*  Polls the readout every ~3s (capped) while any snippet is still pending,     */
/*  merging the fresh payload in wholesale via onUpdate. Neither readout host     */
/*  (LabOverlay's fresh recording, InsightsOverlay's re-open) holds any FE-only   │
/*  local state on top of the payload, so a wholesale replace is safe.           */
/* -------------------------------------------------------------------------- */

const MAX_POLLS = 8;
const INTERVAL_MS = 3000;

/** Mirrors CommentBlock's shimmer gate: pending = no card yet AND no coach note
 *  to show in its place. */
function hasPendingSuggestions(payload: ReadoutPayload): boolean {
  return payload.snippets.some((s) => !s.sayItStronger && !s.coach?.note);
}

export function useSayItStrongerPolling(
  sessionId: string | null,
  /** null while auth is still resolving — the hook waits (mirrors SendGate). */
  signedIn: boolean | null,
  payload: ReadoutPayload | null,
  onUpdate: (next: ReadoutPayload) => void
): void {
  const attemptsRef = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  // The freshest sessionId, read inside the fetch .then() to drop a stale
  // in-flight response if the host switched sessions while it was pending
  // (e.g. a second take finishes while the first's poll is still in flight).
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // A fresh session (or leaving/re-entering) gets its own attempt budget.
  useEffect(() => {
    attemptsRef.current = 0;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || signedIn === null) return;
    const current = payloadRef.current;
    if (!current || !hasPendingSuggestions(current)) return;
    if (attemptsRef.current >= MAX_POLLS) return;

    const timer = setTimeout(() => {
      attemptsRef.current += 1;
      const fetcher = signedIn ? fetchSessionReadout : fetchGuestLabReadout;
      void fetcher(sessionId).then((r) => {
        if (r && sessionIdRef.current === sessionId) onUpdateRef.current(r.readout);
      });
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
    // Re-runs on every payload change: each poll tick either resolves the
    // pending snippets (loop stops next render) or schedules the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, signedIn, payload]);
}
