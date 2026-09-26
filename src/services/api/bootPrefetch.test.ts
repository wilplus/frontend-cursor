import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* -------------------------------------------------------------------------- */
/*  What these tests protect: the prefetch may only make boot reads EARLIER.   */
/*  It must never hand a gate an answer a fresh fetch would not have given —   */
/*  so every entry is one-shot, expires, and a signed-out lounge read (an      */
/*  empty page that looks like an empty thread) is never reused.              */
/* -------------------------------------------------------------------------- */

const fetchAuthorization = vi.fn();
const fetchLoungeHistory = vi.fn();
const getAuthToken = vi.fn();

vi.mock("./processingAuthorization", () => ({
  fetchAuthorization: () => fetchAuthorization(),
}));
vi.mock("./loungeMessages", () => ({
  fetchLoungeHistory: () => fetchLoungeHistory(),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => getAuthToken(),
}));

import {
  __resetBootPrefetchForTests,
  prefetchChatBoot,
  takeAuthorization,
  takeLoungeHistory,
} from "./bootPrefetch";

const AUTHORIZED = { kind: "authorized", policy: {} };
const PAGE = { messages: [{ id: "m1" }], has_more: false, oldest_cursor: null };

beforeEach(() => {
  __resetBootPrefetchForTests();
  fetchAuthorization.mockReset().mockResolvedValue(AUTHORIZED);
  fetchLoungeHistory.mockReset().mockResolvedValue(PAGE);
  getAuthToken.mockReset().mockResolvedValue("jwt");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bootPrefetch", () => {
  it("starts both reads at once and hands each to its gate", async () => {
    prefetchChatBoot();
    expect(fetchAuthorization).toHaveBeenCalledTimes(1);
    await expect(takeAuthorization()).resolves.toBe(AUTHORIZED);
    await expect(takeLoungeHistory()).resolves.toBe(PAGE);
    expect(fetchAuthorization).toHaveBeenCalledTimes(1);
    expect(fetchLoungeHistory).toHaveBeenCalledTimes(1);
  });

  it("is idempotent while pending", () => {
    prefetchChatBoot();
    prefetchChatBoot();
    expect(fetchAuthorization).toHaveBeenCalledTimes(1);
  });

  it("is one-shot: a second take goes to the network", async () => {
    prefetchChatBoot();
    await takeAuthorization();
    await takeAuthorization();
    expect(fetchAuthorization).toHaveBeenCalledTimes(2);
  });

  it("fetches as before when nothing was prefetched", async () => {
    await expect(takeAuthorization()).resolves.toBe(AUTHORIZED);
    await expect(takeLoungeHistory()).resolves.toBe(PAGE);
    expect(fetchAuthorization).toHaveBeenCalledTimes(1);
    expect(fetchLoungeHistory).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale entry", async () => {
    vi.useFakeTimers();
    prefetchChatBoot();
    vi.advanceTimersByTime(16_000);
    await takeAuthorization();
    expect(fetchAuthorization).toHaveBeenCalledTimes(2);
  });

  it("never reuses a signed-out lounge read", async () => {
    getAuthToken.mockResolvedValue(null);
    prefetchChatBoot();
    await takeLoungeHistory();
    // The prefetch declined; the take fetched for itself.
    expect(fetchLoungeHistory).toHaveBeenCalledTimes(1);
  });

  it("falls back to a fresh fetch when the prefetch rejects", async () => {
    fetchAuthorization.mockRejectedValueOnce(new Error("offline"));
    prefetchChatBoot();
    await expect(takeAuthorization()).resolves.toBe(AUTHORIZED);
    expect(fetchAuthorization).toHaveBeenCalledTimes(2);
  });
});
