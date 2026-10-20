/*
STORY    As a speaker, I want my training-consent choice read once per page
         with my login, and read again after I change it, so that every screen
         shows my current choice.
OUTCOME
  O1  All screens on a page share one read, sent with my login.
  O2  After I change my choice, the next read shows the new choice.
PROVES   O1 -> "serves every reader from one request, sent with the bearer"
         O2 -> "reads afresh after a write"
*/
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  fetchTrainingConsent,
  forgetSharedTrainingConsent,
  setTrainingConsent,
} from "./trainingConsent";

const on = {
  available: true,
  active: false,
  policy_version: "training-v1",
  copy: "The approved sentence.",
  copy_sha256: "c".repeat(64),
};
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("the shared training-consent read", () => {
  afterEach(() => {
    forgetSharedTrainingConsent();
    vi.unstubAllGlobals();
  });

  it("serves every reader from one request, sent with the bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(on));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([fetchTrainingConsent(), fetchTrainingConsent()]);
    expect(a?.available).toBe(true);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token");
  });

  it("reads afresh after a write", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(on))
      .mockResolvedValueOnce(response({ ...on, active: true }))
      .mockResolvedValueOnce(response({ ...on, active: true }));
    vi.stubGlobal("fetch", fetchMock);
    const shown = await fetchTrainingConsent();
    expect(shown?.active).toBe(false);
    await setTrainingConsent(true, shown!);
    const now = await fetchTrainingConsent();
    expect(now?.active).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
