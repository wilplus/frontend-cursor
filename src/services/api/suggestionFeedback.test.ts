import { afterEach, describe, expect, it, vi } from "vitest";

let authToken: string | null = null;
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => authToken,
}));

import { sendSuggestionFeedback } from "./suggestionFeedback";

afterEach(() => {
  authToken = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendSuggestionFeedback guest ownership", () => {
  it("forwards the signed Guest ID for a pre-signup feedback decision", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "principal.secret-value-that-is-long-enough",
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ saved: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendSuggestionFeedback({
        snippetId: "snippet-1",
        sessionId: "take-1",
        target: "comment",
        action: "preferred",
      })
    ).resolves.toEqual({ saved: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/user/snippets/snippet-1/suggestion-feedback",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Willab-Guest-Owner":
            "principal.secret-value-that-is-long-enough",
        }),
      })
    );
  });
});
