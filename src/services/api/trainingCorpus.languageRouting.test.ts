import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchConfidenceQueueResult,
} from "./trainingCorpus";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

describe("confidence queue language routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves the typed unknown-language response for the recovery UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        code: "CLIP_LANGUAGE_UNKNOWN",
        error: "This clip has no verified language and cannot be routed.",
      }),
    }));

    await expect(fetchConfidenceQueueResult("session-1")).resolves.toEqual({
      ok: false,
      status: 409,
      code: "CLIP_LANGUAGE_UNKNOWN",
      error: "This clip has no verified language and cannot be routed.",
      language: null,
    });
  });

});
