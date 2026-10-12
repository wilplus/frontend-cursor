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

  it("reports a thrown fetch as network, never as a response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await bffFetch("/api/x")).toEqual({ kind: "network" });
  });
});
