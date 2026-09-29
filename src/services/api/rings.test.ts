/**
 * The browser's read of the rings decision (backend 0392): it maps what the
 * backend said, decides nothing itself, fails closed, and reads once per
 * page load.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_RING_STATE,
  featureIsOn,
  loadRingState,
  mapRingState,
  recordAnnouncementDecision,
  refreshRingState,
  resetRingStateCache,
  RING_FEATURES,
} from "./rings";

const PAYLOAD = {
  principal_id: "11111111-1111-4111-8111-111111111111",
  ring: 3,
  has_ring_row: true,
  default_ring: 2,
  attributes: { region: "PL", bucket: 7 },
  features_on: ["exercise_service_ui", 42, null],
  pending_announcements: [
    {
      feature: "exercise_service",
      title: "[founder copy] Exercises matched to your moments",
      body: "[founder copy] Explain the practice tick.",
      requires_consent: true,
      consent_purpose: "personalised_practice",
      consent_policy_available: true,
      announced_at: "2026-09-29T10:00:00Z",
    },
    { nope: true },
  ],
  unavailable: false,
};

describe("mapRingState", () => {
  it("keeps the list, the ring and the pending sheet, and drops junk", () => {
    const state = mapRingState(PAYLOAD);
    expect(state.ring).toBe(3);
    expect(state.defaultRing).toBe(2);
    expect(state.hasRingRow).toBe(true);
    expect([...state.featuresOn]).toEqual(["exercise_service_ui"]);
    expect(state.pendingAnnouncements).toHaveLength(1);
    expect(state.pendingAnnouncements[0].consent_purpose).toBe("personalised_practice");
    expect(state.unavailable).toBe(false);
  });

  it("anything else is the empty state: nothing on, nothing pending", () => {
    for (const raw of [null, "x", [], 7]) expect(mapRingState(raw)).toEqual(EMPTY_RING_STATE);
    expect(mapRingState({ unavailable: true, features_on: ["exercise_service_ui"] }).unavailable).toBe(true);
  });
});

describe("featureIsOn", () => {
  it("is what the backend said and never a guess", () => {
    const state = mapRingState(PAYLOAD);
    expect(featureIsOn(state, RING_FEATURES.exerciseServiceUi)).toBe(true);
    expect(featureIsOn(state, RING_FEATURES.exerciseService)).toBe(false); // consent absent upstream
    expect(featureIsOn(state, RING_FEATURES.canonicalTakeRows)).toBe(false);
  });

  it("is off while loading and off when the read failed", () => {
    expect(featureIsOn(null, RING_FEATURES.exerciseServiceUi)).toBe(false);
    expect(featureIsOn(undefined, RING_FEATURES.exerciseServiceUi)).toBe(false);
    const failed = mapRingState({ ...PAYLOAD, unavailable: true });
    expect(featureIsOn(failed, RING_FEATURES.exerciseServiceUi)).toBe(false);
  });
});

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

  it("reads once for everyone on the page and again only on refresh", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(PAYLOAD), { status: 200 }));
    const [a, b] = await Promise.all([loadRingState(), loadRingState()]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/user/rings");
    await loadRingState();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await refreshRingState();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a 401, a 5xx or a thrown fetch is the empty state, never an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect((await loadRingState()).unavailable).toBe(true);
    resetRingStateCache();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await loadRingState()).unavailable).toBe(true);
  });

  it("a decision posts the answer and nothing else", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await recordAnnouncementDecision("exercise_service", "not_now")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v2/user/rings/announcements/exercise_service/decision");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ decision: "not_now" });
  });
});
