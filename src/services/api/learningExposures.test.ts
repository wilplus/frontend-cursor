import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acknowledgeVisibleLearningExposures,
} from "./learningExposures";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("learning exposure acknowledgement", () => {

  it("returns false when any surface receipt is not accepted", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: call++ === 0 })));
    const saved = await acknowledgeVisibleLearningExposures([
      {
        presentationId: "11111111-1111-4111-8111-111111111111",
        acknowledgementToken: "22222222-2222-4222-8222-222222222222",
        learningSurface: "praise_generation",
      },
      {
        presentationId: "44444444-4444-4444-8444-444444444444",
        acknowledgementToken: "55555555-5555-4555-8555-555555555555",
        learningSurface: "praise_selection",
      },
    ], "33333333-3333-4333-8333-333333333333");
    expect(saved).toBe(false);
  });
});
