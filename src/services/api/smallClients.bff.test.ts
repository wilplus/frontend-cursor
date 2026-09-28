/* Pins what three small clients answer before and after they move onto
 * bffFetch (audit D5): the signed-out, network, refused and success cases. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { fetchSessionState } from "./chatSessionState";
import { postJourneyNextSteps } from "./journeyNextSteps";
import { fetchProductDiscoveries } from "./productDiscoveries";

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

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postJourneyNextSteps", () => {
  it("posts with the Bearer header and reports a 2xx", async () => {
    const fn = stubFetch(204, null);
    expect(await postJourneyNextSteps("arc/1")).toBe(true);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/explore/arc/arc%2F1/journey/next-steps");
    expect(init).toMatchObject({
      method: "POST", cache: "no-store",
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("is false when refused, offline or signed out (nothing sent)", async () => {
    stubFetch(500, null);
    expect(await postJourneyNextSteps("a")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await postJourneyNextSteps("a")).toBe(false);
    token.mockResolvedValue(null);
    const fn = stubFetch(200, null);
    expect(await postJourneyNextSteps("a")).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("fetchProductDiscoveries", () => {
  it("keeps only known product ids", async () => {
    const fn = stubFetch(200, { products: ["not-a-product", 7] });
    expect(await fetchProductDiscoveries()).toEqual([]);
    expect(fn.mock.calls[0]?.[1]).toMatchObject({
      cache: "no-store", headers: { Authorization: "Bearer tok" },
    });
  });

  it("is empty when refused, malformed, offline or signed out", async () => {
    stubFetch(403, { products: [] });
    expect(await fetchProductDiscoveries()).toEqual([]);
    stubFetch(200, { products: "x" });
    expect(await fetchProductDiscoveries()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await fetchProductDiscoveries()).toEqual([]);
    token.mockResolvedValue(null);
    const fn = stubFetch(200, { products: [] });
    expect(await fetchProductDiscoveries()).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("fetchSessionState", () => {
  it("reads a known state, with or without a session", async () => {
    stubFetch(200, { state: "REVIEW_LOOP" });
    expect(await fetchSessionState()).toBe("REVIEW_LOOP");
    token.mockResolvedValue(null);
    const fn = stubFetch(200, { state: "NO_SESSION" });
    expect(await fetchSessionState()).toBe("NO_SESSION");
    expect(fn.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", headers: {} });
  });

  it("is null for an unknown state, a refusal or no network", async () => {
    stubFetch(200, { state: "SOMETHING_ELSE" });
    expect(await fetchSessionState()).toBeNull();
    stubFetch(500, { state: "REVIEW_LOOP" });
    expect(await fetchSessionState()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await fetchSessionState()).toBeNull();
  });
});
