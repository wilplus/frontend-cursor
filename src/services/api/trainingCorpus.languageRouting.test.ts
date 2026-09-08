import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmCoachSessionLanguage,
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

  it("submits one normalized coach confirmation through the BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      confirmCoachSessionLanguage("session/1", " EN "),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/coach/sessions/session%2F1/confidence-queue",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ language: "en" }),
      }),
    );
  });

  it("never sends an unsupported language", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      confirmCoachSessionLanguage("session-1", "unknown"),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
