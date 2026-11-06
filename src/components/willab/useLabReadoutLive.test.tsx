// @vitest-environment jsdom
/*
STORY    As a speaker whose Take ended without its Ideal Text, I want the app
         to stop hammering the server about that Take, and still notice at
         once if the text lands after all, so that what I see stays exactly
         as it was and a late Ideal Text still reaches me.
OUTCOME
  O1  After a terminal state the screen keeps listening to (the Lounge does
      for a later Take's `failed_ideal_text_unconfirmed`), the readout is
      asked a handful of times a minute, not every second; a later change
      (the document landed: `ready`) still arrives, within 30 seconds.
PROVES   O1 -> "backs off after a terminal state it keeps hearing, and still hears a late change"
WHY      Overnight audit, 6 Nov 2026: the stream closes on a terminal state
         and the hook reconnected every second for as long as the Lounge
         listened (up to 8 minutes). Founder: "Go, fix both" (6 Nov 2026).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "test-token") }));

import { useLabReadoutLive } from "./useLabReadoutLive";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The Take's state on the server, and every request made about it. */
let state = "failed_ideal_text_unconfirmed";
const requests: string[] = [];
/** The states the screen was given. */
const heard: (string | null)[] = [];

/** The readout bridge on a terminal state: one status frame, then it closes. */
function backend(url: string) {
  requests.push(url);
  const envelope = JSON.stringify({ state, readout: null, processing: null });
  if (url.endsWith("/events")) {
    const frames = [new TextEncoder().encode(`: connected\n\nevent: status\ndata: ${envelope}\n\n`)];
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => "text/event-stream" },
      body: { getReader: () => ({ read: async () => (frames.length ? { done: false, value: frames.shift() } : { done: true, value: undefined }) }) },
    });
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(envelope) });
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  state = "failed_ideal_text_unconfirmed";
  requests.length = 0;
  heard.length = 0;
  vi.stubGlobal("fetch", vi.fn((url: string) => backend(url)));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A screen that keeps listening past a terminal state, as the Lounge does. */
function Lounge() {
  useLabReadoutLive("take-2", (r) => heard.push(r.state), 5000);
  return null;
}
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it("backs off after a terminal state it keeps hearing, and still hears a late change", async () => {
  act(() => root.render(createElement(Lounge)));
  await wait(60_000);
  expect(heard).toEqual(["failed_ideal_text_unconfirmed"]);
  expect(requests.length).toBeLessThanOrEqual(8); // a handful a minute, not ~60

  state = "ready"; // the document landed after the deadline
  await wait(30_000);
  expect(heard).toEqual(["failed_ideal_text_unconfirmed", "ready"]);
});
