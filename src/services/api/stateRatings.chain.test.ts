import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeConfidenceChainRender,
  saveStateRating,
  type ConfidenceChainBlindHandle,
} from "./stateRatings";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const handle: ConfidenceChainBlindHandle = {
  reviewAssignmentId: "20000000-0000-4000-8000-000000000003",
  presentationId: "20000000-0000-4000-8000-000000000005",
  acknowledgementToken: "20000000-0000-4000-8000-000000000006",
  visiblePayloadSha256: "b".repeat(64),
};

const renderRequest = {
  renderInstanceId: "20000000-0000-4000-8000-000000000007",
  clientRenderedAt: "2026-09-29T10:00:00.000Z",
  idempotencyKey: "coach-card-visible-render:presentation-1:instance-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Q2: the legacy coach card's receipt on the confidence chain", () => {
  it("posts the receipt to the chain's own route with the browser's retry key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exposure_id: "exposure-9" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await acknowledgeConfidenceChainRender(handle, renderRequest);

    expect(result).toEqual({
      ok: true,
      receipt: {
        reviewAssignmentId: handle.reviewAssignmentId,
        presentationId: handle.presentationId,
        exposureId: "exposure-9",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `/api/v2/coach/mlc2/assignments/${handle.reviewAssignmentId}/render`,
    );
    expect(init.headers["Idempotency-Key"]).toBe(renderRequest.idempotencyKey);
    expect(JSON.parse(init.body)).toEqual({
      presentation_id: handle.presentationId,
      acknowledgement_token: handle.acknowledgementToken,
      render_instance_id: renderRequest.renderInstanceId,
      client_rendered_at: renderRequest.clientRenderedAt,
      client_version: "coach-card-blind-v1",
      visible_payload_sha256: handle.visiblePayloadSha256,
    });
  });

  it("a refused receipt is refused, never faked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: "CONFIDENCE_CHAIN_RENDER_NOT_RECORDED" }),
    }));
    const result = await acknowledgeConfidenceChainRender(handle, renderRequest);
    expect(result.ok).toBe(false);
  });

  it("the label PUT echoes the assignment and exposure beside an unchanged body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveStateRating(
      "snip-1",
      { state_id: "confidence", value: "yes", idempotency_key: "k-1" },
      null,
      null,
      { handle, exposureId: "exposure-9" },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/v2/coach/snippets/snip-1/confidence-label");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      state_id: "confidence",
      value: "yes",
      idempotency_key: "k-1",
      mlc2: {
        review_assignment_id: handle.reviewAssignmentId,
        exposure_id: "exposure-9",
      },
    });
  });

  it("without the echo the PUT is byte-identical to before", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveStateRating(
      "snip-1",
      { state_id: "confidence", value: "no", idempotency_key: "k-2" },
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      state_id: "confidence",
      value: "no",
      idempotency_key: "k-2",
    });
  });
});
