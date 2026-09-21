import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The seam: `authedFetch` asks auth-client for a pass and for a renewal. That
 * is the whole reason it lives in its own module — a call made inside
 * auth-client's own scope would bypass this mock, and the behaviour below
 * could not be observed at all. */
const auth = vi.hoisted(() => ({
  getAuthToken: vi.fn<() => Promise<string | null>>(),
  renewAuthToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("@/lib/api/auth-client", () => auth);

import { authedFetch } from "./authed-fetch";

const ok = () => ({ ok: true, status: 200 }) as unknown as Response;
const unauthorized = () => ({ ok: false, status: 401 }) as unknown as Response;

function bearerOf(call: unknown[] | undefined): string | undefined {
  const init = call?.[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers?.Authorization;
}

beforeEach(() => {
  auth.getAuthToken.mockReset();
  auth.renewAuthToken.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a request that outlives its own pass", () => {
  it("sends the pass it has and asks only once when that works", async () => {
    auth.getAuthToken.mockResolvedValue("fresh");
    const fetchMock = vi.fn(async (..._args: unknown[]) => ok());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/core");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer fresh");
    expect(auth.renewAuthToken).not.toHaveBeenCalled();
  });

  it("renews and asks again when the pass expired mid-page", async () => {
    // THE BUG THIS EXISTS FOR. An hour into one Ideal Text screen the pass is
    // spent; the read used to come back 401 and the student was told the
    // document could not be loaded.
    auth.getAuthToken.mockResolvedValue("spent");
    auth.renewAuthToken.mockResolvedValue("renewed");
    const fetchMock = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/core");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer spent");
    expect(bearerOf(fetchMock.mock.calls[1])).toBe("Bearer renewed");
  });

  it("retries a PUT too, because a 401 means the route never ran", async () => {
    // The BFF answers 401 before it forwards, and require_auth answers before
    // the handler is entered — so nothing was written and the body is safe to
    // send again. Losing written words to an expired pass was the worst
    // version of this bug.
    auth.getAuthToken.mockResolvedValue("spent");
    auth.renewAuthToken.mockResolvedValue("renewed");
    const fetchMock = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/user-edit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "the student's words" }),
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(second?.body).toBe(JSON.stringify({ text: "the student's words" }));
    expect(second?.method).toBe("PUT");
  });

  it("does not replay a body it cannot send twice", async () => {
    // A stream is consumed by the first attempt; retrying would send an empty
    // body, which is worse than the 401.
    auth.getAuthToken.mockResolvedValue("spent");
    auth.renewAuthToken.mockResolvedValue("renewed");
    const fetchMock = vi.fn(async (..._args: unknown[]) => unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/upload", {
      method: "POST",
      body: new Blob(["audio"]),
    });

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(auth.renewAuthToken).not.toHaveBeenCalled();
  });

  it("stops at one attempt when the renewal returns the same pass", async () => {
    // Re-sending a pass the server just rejected can only earn the same 401.
    auth.getAuthToken.mockResolvedValue("spent");
    auth.renewAuthToken.mockResolvedValue("spent");
    const fetchMock = vi.fn(async (..._args: unknown[]) => unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/core");

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the 401 when the session really is over", async () => {
    // By this point "sign in again" is a fact, not a guess — and the caller is
    // free to say so instead of blaming the document.
    auth.getAuthToken.mockResolvedValue(null);
    auth.renewAuthToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async (..._args: unknown[]) => unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/core");

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf(fetchMock.mock.calls[0])).toBeUndefined();
  });

  it("never loops: a second 401 after a good renewal is the answer", async () => {
    auth.getAuthToken.mockResolvedValue("spent");
    auth.renewAuthToken.mockResolvedValue("renewed");
    const fetchMock = vi.fn(async (..._args: unknown[]) => unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/v2/explore/arc/a/ideal-text/core");

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.renewAuthToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the caller's headers and defaults the transport bits", async () => {
    auth.getAuthToken.mockResolvedValue("fresh");
    const fetchMock = vi.fn(async (..._args: unknown[]) => ok());
    vi.stubGlobal("fetch", fetchMock);

    await authedFetch("/api/v2/explore/arc/a/ideal-text/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const init = fetchMock.mock.calls[0]?.[1] as
      | (RequestInit & { headers: Record<string, string> })
      | undefined;
    expect(init?.headers["Content-Type"]).toBe("application/json");
    expect(init?.headers.Authorization).toBe("Bearer fresh");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
  });
});
