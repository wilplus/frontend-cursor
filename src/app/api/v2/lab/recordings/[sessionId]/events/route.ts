import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel duration cap for ONE SSE connection — 60 is the FREE (Hobby) plan's
// hard ceiling, and a higher value FAILS DEPLOYMENT there (Vercel rejects the
// build rather than clamping). We deploy on Hobby: do not raise this. Jobs
// that outlive a connection see the stream end cleanly; useLabReadoutLive
// reconnects and the bridge re-sends current state, so a long analysis rides
// a chain of ≤60s connections instead of one long one.
export const maxDuration = 60;

const POLL_MS = 2000;
const HEARTBEAT_MS = 15_000;
// Close a little before maxDuration so the stream ends as a clean EOF the
// client treats as "reconnect", not a mid-frame kill.
const BRIDGE_WINDOW_MS = 55_000;
// Bounds the SERVER loop only — the FE client owns the real terminal decision
// (it also treats a non-processing state WITH content as done), exactly as it
// did when it polled.
const TERMINAL_STATES = new Set(["ready", "readout_ready", "failed"]);

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Defeat intermediary buffering so events flush as they happen.
  "X-Accel-Buffering": "no",
} as const;

/**
 * GET /api/v2/lab/recordings/[sessionId]/events
 *
 * SSE for the async-analysis status the Lab (2s) and Lounge (5s) used to poll
 * from the browser. Same optional-auth trust model as the readout proxy:
 * account token or canonical signed Guest ID. A session UUID alone is never
 * access.
 *
 * Two modes, decided per request:
 *   1. PASSTHROUGH — if the backend exposes native SSE at
 *      GET /v2/lab/recordings/<id>/events (text/event-stream), pipe it through
 *      verbatim. This is the end state: the backend repo implements that
 *      endpoint against the contract below and this bridge upgrades itself
 *      with zero FE changes.
 *   2. BRIDGE — until then, poll the existing readout endpoint SERVER-side at
 *      the same 2s cadence and push only CHANGES down the pipe. The browser
 *      holds one streaming connection instead of paying a lambda invocation
 *      per tick; backend load is unchanged until mode 1 lands.
 *
 * Event contract (both modes — the backend must match it exactly):
 *   `event: status` frames whose `data` is the SAME single-line JSON envelope
 *   GET …/readout returns (the FE client owns the envelope shape, as with the
 *   readout proxy). `: ping` comment heartbeats every ~15s keep intermediaries
 *   from idling the socket. The stream ends after a terminal state (ready /
 *   readout_ready / failed) or the duration cap; clients reconnect until THEY
 *   decide the job is done.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  // Optional auth — same contract as the readout proxy.
  const token = await getV2AccessToken(req);
  const guestOwner = req.headers.get("X-Willab-Guest-Owner");
  const id = encodeURIComponent(params.sessionId);

  // Mode 1 — PASSTHROUGH when the backend speaks SSE natively.
  try {
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (guestOwner) headers["X-Willab-Guest-Owner"] = guestOwner;
    const upstream = await fetch(`${backend}/v2/lab/recordings/${id}/events`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: req.signal,
    });
    if (
      upstream.ok &&
      (upstream.headers.get("content-type") ?? "").includes(
        "text/event-stream"
      ) &&
      upstream.body
    ) {
      return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
    }
    // Not implemented upstream (404 today) — discard and bridge instead.
    void upstream.body?.cancel().catch(() => undefined);
  } catch {
    // Unreachable backend falls through to the bridge, whose per-tick fetches
    // keep retrying — the same behavior the client's own poll had.
  }

  // Mode 2 — BRIDGE.
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string): boolean => {
        if (cancelled) return false;
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          cancelled = true; // client went away mid-enqueue
          return false;
        }
      };

      const run = async () => {
        const startedAt = Date.now();
        let lastPayload: string | null = null;
        let lastSent = Date.now();
        send(": connected\n\n");
        while (
          !cancelled &&
          !req.signal.aborted &&
          Date.now() - startedAt < BRIDGE_WINDOW_MS
        ) {
          let state: string | null = null;
          try {
            const headers: Record<string, string> = {
              Accept: "application/json",
            };
            if (token) headers.Authorization = `Bearer ${token}`;
            else if (guestOwner) headers["X-Willab-Guest-Owner"] = guestOwner;
            const upstream = await fetch(
              `${backend}/v2/lab/recordings/${id}/readout`,
              { method: "GET", headers, cache: "no-store", signal: req.signal }
            );
            if (upstream.ok) {
              const parsed: unknown = await upstream.json().catch(() => null);
              if (parsed && typeof parsed === "object") {
                // Re-serialize compact: SSE frames are newline-delimited, so
                // the data payload must be a single line.
                const payload = JSON.stringify(parsed);
                if (payload !== lastPayload) {
                  lastPayload = payload;
                  if (!send(`event: status\ndata: ${payload}\n\n`)) break;
                  lastSent = Date.now();
                }
                const s = (parsed as Record<string, unknown>).state;
                if (typeof s === "string") state = s;
              }
            }
          } catch {
            // Upstream blip — the next tick retries, mirroring the old client
            // poll's "null responses just keep polling".
          }
          if (state && TERMINAL_STATES.has(state)) break;
          if (Date.now() - lastSent > HEARTBEAT_MS) {
            if (!send(": ping\n\n")) break;
            lastSent = Date.now();
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        try {
          controller.close();
        } catch {
          // Already errored/cancelled — the flag is all the cleanup there is.
        }
      };
      void run();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
