/* Pins what the project deletion client answers before and after it moves
 * onto bffFetch (audit D5): the signed-out, network, refused and success
 * cases. The coach review's three clients that shared this file left with
 * the arc-level delivery (founder 2026-09-30, B3; P2-19). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { cancelProjectDeletion, requestProjectDeletion } from "./projectDeletion";

const token = vi.mocked(getAuthToken);

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function offline() {
  const fn = vi.fn(async () => { throw new TypeError("offline"); });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("project deletion", () => {
  it("asks with an idempotency key and reads the open request", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("k-1-2-3-4");
    const fn = stubFetch(200, { deletion: { state: "pending", due_at: "d" } });
    expect(await requestProjectDeletion("p/1")).toEqual({
      ok: true, deletion: { state: "pending", dueAt: "d" },
    });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/projects/p%2F1/deletion-request");
    expect(init).toEqual({
      method: "POST",
      credentials: "include",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ idempotency_key: "k-1-2-3-4" }),
    });
  });

  it("cancels with no body", async () => {
    const fn = stubFetch(200, { deletion: null });
    expect(await cancelProjectDeletion("p")).toEqual({ ok: true, deletion: null });
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    expect(init).toEqual({
      method: "DELETE", credentials: "include",
      headers: { Authorization: "Bearer tok" },
    });
    expect(init.body).toBeUndefined();
  });

  it("changes nothing when refused, offline or signed out", async () => {
    stubFetch(409, { deletion: { state: "pending" } });
    expect(await requestProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    offline();
    expect(await cancelProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    token.mockResolvedValue(null);
    const fn = stubFetch(200, {});
    expect(await requestProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    expect(fn).not.toHaveBeenCalled();
  });
});
