import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeConfidenceChainRender,
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

  it("a refused receipt is refused, never faked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: "CONFIDENCE_CHAIN_RENDER_NOT_RECORDED" }),
    }));
    const result = await acknowledgeConfidenceChainRender(handle, renderRequest);
    expect(result.ok).toBe(false);
  });
});
