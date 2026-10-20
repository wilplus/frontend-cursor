/*
STORY    As a speaker buying a plan, I want checkout to open with the right
         plan and return pages, and a clear message when plans are unavailable,
         so that paying either works or tells me why not.
OUTCOME
  O1  Choosing a plan sends that plan with the success and cancel pages and
      opens checkout.
  O2  Plans switched off or misconfigured say "Plans aren't available right
      now."; other refusals show the server's message; an answer without a
      checkout link is an error.
PROVES   O1 -> "posts the tier with both return URLs and opens the checkout"
         O2 -> "tells the refusals apart"
WHY      Payments are on the critical path.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { startPlanCheckout } from "./subscribe";

const token = vi.mocked(getAuthToken);
const JSON_BEARER = { "Content-Type": "application/json", Authorization: "Bearer tok" };

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

describe("startPlanCheckout", () => {
  it("posts the tier with both return URLs and opens the checkout", async () => {
    const fn = stubFetch(200, { checkout_url: "https://pay/1" });
    expect(await startPlanCheckout("pro")).toEqual({ ok: true, url: "https://pay/1" });
    expect(fn).toHaveBeenCalledWith("/api/v2/tokens/checkout", {
      method: "POST",
      headers: JSON_BEARER,
      body: JSON.stringify({
        tier: "pro",
        success_url: "/dashboard/pricing?plan=success",
        cancel_url: "/dashboard/pricing?plan=cancelled",
      }),
    });
  });

  it("tells the refusals apart", async () => {
    for (const code of ["DISABLED", "MISCONFIGURED"]) {
      stubFetch(503, { code });
      expect(await startPlanCheckout("pro")).toEqual({
        ok: false, reason: "unavailable", message: "Plans aren't available right now.",
      });
    }
    stubFetch(400, { error: "  Unknown tier.  " });
    expect(await startPlanCheckout("x")).toEqual({
      ok: false, reason: "error", message: "Unknown tier.",
    });
    // A 200 without a URL is not a checkout.
    stubFetch(200, {});
    expect(await startPlanCheckout("pro")).toEqual({
      ok: false, reason: "error", message: "Couldn't start checkout. Try again.",
    });
  });
});
