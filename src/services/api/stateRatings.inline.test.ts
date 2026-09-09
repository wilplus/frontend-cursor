import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeCoachInlineBlindRender,
  saveStateRating,
  type CoachInlineBlindReviewHandle,
} from "./stateRatings";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const blindReview: CoachInlineBlindReviewHandle = {
  projectId: "10000000-0000-4000-8000-000000000001",
  reviewBatchId: "10000000-0000-4000-8000-000000000002",
  reviewAssignmentId: "10000000-0000-4000-8000-000000000003",
  blindPacketId: "10000000-0000-4000-8000-000000000004",
  presentationId: "10000000-0000-4000-8000-000000000005",
  acknowledgementToken: "10000000-0000-4000-8000-000000000006",
  visiblePayloadSha256: "a".repeat(64),
};

const renderRequest = {
  renderInstanceId: "10000000-0000-4000-8000-000000000007",
  clientRenderedAt: "2026-09-09T10:00:00.000Z",
  idempotencyKey: "coach-inline-visible-render:presentation-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("D5 independent render and exact blind response", () => {
  it("records a visible render with no judgment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exposure_id: "exposure-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await acknowledgeCoachInlineBlindRender(
      blindReview, renderRequest,
    );

    expect(result).toEqual({
      ok: true,
      receipt: {
        reviewAssignmentId: blindReview.reviewAssignmentId,
        presentationId: blindReview.presentationId,
        exposureId: "exposure-1",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/render");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/judgments");
  });

  it("later answer reuses the exposure and creates no second render", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ judgment_id: "judgment-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveStateRating(
      "snippet-1",
      { state_id: "confidence", value: "yes", idempotency_key: "action-1" },
      blindReview,
      "exposure-1",
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/judgments");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/render");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      blind_packet_id: blindReview.blindPacketId,
      exposure_id: "exposure-1",
      decision: "rating_yes",
    });
  });

  it("retries an identical render request with one server identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exposure_id: "exposure-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await acknowledgeCoachInlineBlindRender(blindReview, renderRequest);
    await acknowledgeCoachInlineBlindRender(blindReview, renderRequest);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      fetchMock.mock.calls[1][1].headers["Idempotency-Key"],
    );
  });

  it("fails closed before transport without an exact exposure", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveStateRating(
      "snippet-1",
      { state_id: "confidence", value: "yes", idempotency_key: "action-1" },
      blindReview,
      null,
    );

    expect(result).toEqual({
      ok: false,
      error: "This blind review card has not been visibly confirmed yet.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
