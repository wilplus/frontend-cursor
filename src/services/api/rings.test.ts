/**
 * The browser's read of the rings decision (the backend rings migration): it maps what the
 * backend said, decides nothing itself, fails closed, and reads once per
 * page load.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadRingState,
  resetRingStateCache,
} from "./rings";

describe("the shared read", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetRingStateCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetRingStateCache();
  });

  it("a 401, a 5xx or a thrown fetch is the empty state, never an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect((await loadRingState()).unavailable).toBe(true);
    resetRingStateCache();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await loadRingState()).unavailable).toBe(true);
  });
});
