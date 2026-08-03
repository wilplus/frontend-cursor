"use client";

import { useEffect, useRef } from "react";
import { getAuthToken } from "@/lib/api/auth-client";
import {
  fetchGuestLabReadout,
  mapLabReadoutRereadBody,
  type LabReadoutReread,
} from "@/services/api/labRecording";
import { createSseFrameParser } from "@/lib/sse";

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
/* -------------------------------------------------------------------------- */

const MAX_SSE_ATTEMPTS = 2;
const RECONNECT_DELAY_MS = 1000;

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
      while (active && attempts < MAX_SSE_ATTEMPTS) {
        attempts += 1;
        let gotEvent = false;
        try {
          const token = await getAuthToken();
          const headers: Record<string, string> = {
            Accept: "text/event-stream",
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
                  deliver(
                    mapLabReadoutRereadBody(parsed as Record<string, unknown>)
                  );
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
        await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
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
