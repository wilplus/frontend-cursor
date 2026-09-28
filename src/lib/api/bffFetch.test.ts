import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { bffFetch } from "./bffFetch";

const token = vi.mocked(getAuthToken);

function stubFetch(response: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bffFetch (audit D5)", () => {
  it("sends the Bearer header and only the options it was given", async () => {
    const fn = stubFetch({ ok: true, status: 200, json: async () => ({ a: 1 }) });
    const result = await bffFetch("/api/x");
    expect(result).toEqual({ kind: "response", ok: true, status: 200, body: { a: 1 } });
    expect(fn).toHaveBeenCalledWith("/api/x", {
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("sends a JSON body with its content type, method, cache and credentials", async () => {
    const fn = stubFetch({ ok: true, status: 201, json: async () => null });
    await bffFetch("/api/x", {
      method: "POST", json: { b: 2 }, cache: "no-store", credentials: "include",
    });
    expect(fn).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: '{"b":2}',
      cache: "no-store",
      credentials: "include",
    });
  });

  it("sends nothing without a token unless auth is optional", async () => {
    token.mockResolvedValue(null);
    const fn = stubFetch({ ok: true, status: 200, json: async () => ({}) });
    expect(await bffFetch("/api/x")).toEqual({ kind: "unauthenticated" });
    expect(fn).not.toHaveBeenCalled();

    await bffFetch("/api/x", { auth: "optional", method: "POST" });
    expect(fn).toHaveBeenCalledWith("/api/x", { method: "POST", headers: {} });
  });

  it("reports a thrown fetch as network, never as a response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await bffFetch("/api/x")).toEqual({ kind: "network" });
  });

  it("keeps an error response and reads a missing or broken body as null", async () => {
    stubFetch({ ok: false, status: 409, json: async () => ({ code: "STALE" }) });
    expect(await bffFetch("/api/x")).toEqual({
      kind: "response", ok: false, status: 409, body: { code: "STALE" },
    });
    stubFetch({ ok: true, status: 204, json: async () => { throw new SyntaxError("empty"); } });
    expect(await bffFetch("/api/x")).toMatchObject({ status: 204, body: null });
    stubFetch({ ok: true, status: 200 });
    expect(await bffFetch("/api/x")).toMatchObject({ ok: true, body: null });
  });
});
