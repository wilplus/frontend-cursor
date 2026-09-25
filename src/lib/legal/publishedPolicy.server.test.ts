import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/_lib/backend", () => ({ getBackendUrl: () => "http://backend.test" }));

import { loadPublishedPolicyText } from "./publishedPolicy.server";

/* Founder 2026-09-25, decisions 2/3: the legal pages read the stored copy on
 * the server, from the public read, and a failed read is a fallback — never
 * an error page and never the retired v1.2 text. */
afterEach(() => vi.unstubAllGlobals());

describe("loadPublishedPolicyText", () => {
  it("reads the public policy text, revalidated, and returns the page's copy", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ terms: { version: "3.1", copy: "T" }, privacy: { version: "3.1", copy: "P" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadPublishedPolicyText("privacy")).toEqual({ kind: "published", copy: "P", version: "3.1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/v2/processing-authorization/policy-text");
    expect(init.next).toEqual({ revalidate: 300 });
  });

  it("falls back when the backend refuses or cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    expect(await loadPublishedPolicyText("terms")).toEqual({ kind: "fallback" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await loadPublishedPolicyText("terms")).toEqual({ kind: "fallback" });
  });
});
