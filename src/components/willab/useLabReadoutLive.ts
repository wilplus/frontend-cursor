"use client";

import { useEffect, useRef } from "react";
import { getAuthToken } from "@/lib/api/auth-client";
import {
  fetchGuestLabReadout,
  mapLabReadoutRereadBody,
  type LabReadoutReread,
} from "@/services/api/labRecording";
import { createSseFrameParser } from "@/lib/sse";
import { guestOwnerHeaders } from "@/services/api/projects";

/* -------------------------------------------------------------------------- */
/*  useLabReadoutLive — push-first transport for the async-analysis readout.   */
/*                                                                            */
/*  Replaces the Lab's 2s / Lounge's 5s client setIntervals with ONE SSE       */
/*  connection to the readout events bridge, in the same two-tier shape        */
/*  usePublishLiveSubscription proved out:                                     */
/*    1. PRIMARY — fetch()-driven SSE (EventSource cannot carry the auth       */
/*       header). `status` events deliver the same envelope the poll fetched,  */
/*       through the same mapper, so the caller's handler logic is unchanged   */
/*       and still owns the terminal decision (it tears this down by clearing  */
/*       the session id).                                                      */
/*    2. FALLBACK — the original poll, entered after two failed connection     */
/*       attempts, so the record→transcribe→readout loop can never do worse    */
/*       than it did before SSE existed.                                       */
/*                                                                            */
/*  An immediate one-shot readout fetch fires on subscribe in both tiers — a   */
/*  fast daemon shouldn't wait for the SSE handshake (the same reason the old  */
/*  poll ticked immediately). Consecutive identical envelopes are deduped so   */
/*  the one-shot, the stream, and reconnect re-sends don't double-fire the     */
/*  handler.                                                                   */
/*                                                                            */
/*  A TERMINAL STATE IS NOT A REASON TO SPIN (6 Nov 2026). The bridge closes   */
/*  the stream on a terminal state, and a consumer that keeps listening past   */
/*  one (the Lounge does, for a later Take's `failed_ideal_text_unconfirmed`)  */
/*  used to reconnect every second until it gave up. It still reconnects, so   */
/*  a state that changes late (a document landing after the deadline) is      */
/*  still heard, but each such short stream waits twice as long as the last:   */
/*  1, 2, 4, 8, 16 s, then every 30 s. A stream that brings anything else, or  */
/*  that ends at the window, starts the count again.                           */
/* -------------------------------------------------------------------------- */

const MAX_SSE_ATTEMPTS = 2;
const RECONNECT_DELAY_MS = 1000;
// A stream that delivered and stayed open at least this long ended at the
// bridge's window (~55s), so the next one opens at once: a Take that finishes
// right then is not held back by the delay. A shorter stream is a terminal
// close or a broken bridge, and still waits, so it can never spin.
const WINDOW_END_MIN_MS = 10_000;
// The bridge's TERMINAL_STATES (events/route.ts): it closes the stream on them.
const TERMINAL_STATES: ReadonlySet<string> = new Set([
  "ready",
  "readout_ready",
  "failed",
  "failed_ideal_text_unconfirmed",
]);
const TERMINAL_BACKOFF_MAX_MS = 30_000;

/** What one stream did, as far as the next connection is concerned. */
type StreamEnd = {
  gotEvent: boolean;
  /** Some status event in it was not a terminal state. */
  sawOther: boolean;
  /** Its last status event was a terminal state. */
  endedTerminal: boolean;
  lastedMs: number;
};

/** The wait before the next stream, and the terminal backoff step after it.
 *  Pure: #1284's two rules, plus the backoff for a short terminal stream. */
function nextConnect(end: StreamEnd, step: number): { waitMs: number; step: number } {
  if (end.gotEvent && end.lastedMs >= WINDOW_END_MIN_MS) return { waitMs: 0, step: 0 };
  const from = end.sawOther ? 0 : step;
  if (!end.gotEvent || !end.endedTerminal) return { waitMs: RECONNECT_DELAY_MS, step: from };
  return {
    waitMs: Math.min(RECONNECT_DELAY_MS * 2 ** from, TERMINAL_BACKOFF_MAX_MS),
    step: from + 1,
  };
}

export function useLabReadoutLive(
  sessionId: string | null,
  onReadout: (r: LabReadoutReread) => void,
  fallbackPollMs: number = 2000
): void {
  // Latest-callback ref: subscribers re-render freely without tearing down
  // the connection — the effect keys on the session id alone.
  const onReadoutRef = useRef(onReadout);
  useEffect(() => {
    onReadoutRef.current = onReadout;
  }, [onReadout]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let lastDelivered: string | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const controller = new AbortController();

    const deliver = (r: LabReadoutReread | null) => {
      if (!active || !r) return;
      const key = JSON.stringify(r);
      if (key === lastDelivered) return;
      lastDelivered = key;
      onReadoutRef.current(r);
    };

    // Tier 2 — the original poll, at the caller's original cadence.
    const startPollingFallback = () => {
      if (!active || pollId !== null) return;
      const tick = async () => deliver(await fetchGuestLabReadout(sessionId));
      void tick();
      pollId = setInterval(() => void tick(), fallbackPollMs);
    };

    // Tier 1 — SSE with bounded connect retries, then demote to polling.
    const runSse = async () => {
      let attempts = 0;
      let step = 0;
      while (active && attempts < MAX_SSE_ATTEMPTS) {
        attempts += 1;
        let gotEvent = false;
        let sawOther = false;
        let lastState: string | null = null;
        const openedAt = Date.now();
        try {
          const token = await getAuthToken();
          const headers: Record<string, string> = {
            Accept: "text/event-stream",
            ...(token ? {} : guestOwnerHeaders()),
          };
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(
            `/api/v2/lab/recordings/${encodeURIComponent(sessionId)}/events`,
            { headers, cache: "no-store", signal: controller.signal }
          );
          if (
            !res.ok ||
            !res.body ||
            !(res.headers.get("content-type") ?? "").includes(
              "text/event-stream"
            )
          ) {
            throw new Error(`SSE unavailable (HTTP ${res.status})`);
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const parse = createSseFrameParser();
          for (;;) {
            const { done, value } = await reader.read();
            if (done || !active) break;
            for (const evt of parse(decoder.decode(value, { stream: true }))) {
              if (evt.event !== "status") continue;
              gotEvent = true;
              try {
                const parsed: unknown = JSON.parse(evt.data);
                if (parsed && typeof parsed === "object") {
                  const r = mapLabReadoutRereadBody(
                    parsed as Record<string, unknown>
                  );
                  lastState = r.state;
                  if (!TERMINAL_STATES.has(r.state ?? "")) sawOther = true;
                  deliver(r);
                }
              } catch {
                // A malformed frame is dropped; the next status event (or the
                // polling fallback, if the stream dies) recovers.
              }
            }
          }
        } catch {
          if (!active) return;
        }
        if (!active) return;
        // A stream that DELIVERED and then ended is the bridge hitting its
        // duration cap (or a terminal close the handler is about to act on),
        // not a failure — reconnect without burning an attempt.
        if (gotEvent) attempts = 0;
        const next = nextConnect(
          {
            gotEvent,
            sawOther,
            endedTerminal: TERMINAL_STATES.has(lastState ?? ""),
            lastedMs: Date.now() - openedAt,
          },
          step
        );
        step = next.step;
        if (next.waitMs > 0) {
          await new Promise((r) => setTimeout(r, next.waitMs));
        }
      }
      startPollingFallback();
    };

    // Immediate first read; racing tier 1's first event is fine — deliver()
    // dedupes, and terminal handling clears the session id upstream, tearing
    // all of this down.
    void fetchGuestLabReadout(sessionId).then(deliver);
    void runSse();

    return () => {
      active = false;
      controller.abort();
      if (pollId !== null) clearInterval(pollId);
    };
  }, [sessionId, fallbackPollMs]);
}
