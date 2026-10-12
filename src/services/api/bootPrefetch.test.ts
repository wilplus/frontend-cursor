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

  it("never reuses a signed-out lounge read", async () => {
    getAuthToken.mockResolvedValue(null);
    prefetchChatBoot();
    await takeLoungeHistory();
    // The prefetch declined; the take fetched for itself.
    expect(fetchLoungeHistory).toHaveBeenCalledTimes(1);
  });
});
