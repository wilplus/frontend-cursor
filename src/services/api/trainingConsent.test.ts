import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  fetchTrainingConsent,
  forgetSharedTrainingConsent,
  setTrainingConsent,
} from "./trainingConsent";

/* -------------------------------------------------------------------------- */
/*  The training switch is read by the acceptance flow, the Lab's prefetch,   */
/*  the question before the first Take and a visitor's kept yes. One page     */
/*  must cost the endpoint one read, with the bearer (so the BFF route does   */
/*  not validate the cookie session per hop), and a write must never leave a  */
/*  reader on the state from before it (founder 2026-10-16).                  */
/* -------------------------------------------------------------------------- */

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
