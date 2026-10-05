/* Pins what the package checkout client answers on bffFetch (audit D5): the
 * signed-out, network, refused and success cases, and exactly what each
 * sends. The test environment has no window, so the return URLs carry an
 * empty origin. */
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

function offline() {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
}

async function signedOutSendsNothing(call: () => Promise<unknown>, answer: unknown) {
  token.mockResolvedValue(null);
  const fn = stubFetch(200, {});
  expect(await call()).toEqual(answer);
  expect(fn).not.toHaveBeenCalled();
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

  it("names the offline and signed-out cases", async () => {
    offline();
    expect(await startPlanCheckout("pro")).toEqual({
      ok: false, reason: "error", message: "Couldn't reach the server. Try again.",
    });
    await signedOutSendsNothing(() => startPlanCheckout("pro"), {
      ok: false, reason: "error", message: "Sign in to change your plan.",
    });
  });
});
