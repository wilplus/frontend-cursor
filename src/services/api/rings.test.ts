/*
STORY    As a speaker, I want feature rollout read from the server and treated
         as "off" when it can't be read, so that a hiccup never switches on
         unfinished features.
OUTCOME
  O1  A readable answer maps the features the server turned on.
  O2  A 401, a 5xx or a thrown fetch is the empty state (nothing on), never
      an error.
  O3  The rings are read once per page load: every later caller shares it.
PROVES   O1 -> "maps the features the server turned on"
         O2 -> "a 401, a 5xx or a thrown fetch is the empty state, never an error"
         O3 -> "reads once per page load"
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadRingState,
  resetRingStateCache,
} from "./rings";

describe("the shared read", () => {
  const fetchMock = vi.fn();
  const on = () =>
    new Response(JSON.stringify({ ring: 2, features_on: ["practise"], pending_announcements: [] }));
  beforeEach(() => {
    resetRingStateCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetRingStateCache();
  });

  it("maps the features the server turned on", async () => {
    fetchMock.mockResolvedValueOnce(on());
    const state = await loadRingState();
    expect(state.unavailable).toBe(false);
    expect([...state.featuresOn]).toEqual(["practise"]);
  });

  it("a 401, a 5xx or a thrown fetch is the empty state, never an error", async () => {
    for (const fail of [
      () => fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 })),
      () => fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 })),
      () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")),
    ]) {
      resetRingStateCache();
      fail();
      const state = await loadRingState();
      expect(state.unavailable).toBe(true);
      expect(state.featuresOn.size).toBe(0);
    }
  });

  it("reads once per page load", async () => {
    fetchMock.mockImplementation(async () => on());
    await Promise.all([loadRingState(), loadRingState()]);
    await loadRingState();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
