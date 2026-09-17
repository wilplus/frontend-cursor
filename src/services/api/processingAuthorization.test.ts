import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptAuthorization,
  fetchAuthorization,
  recordAiNoticeRendered,
  type ProcessingPolicy,
} from "./processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  What these tests protect (Task 3).                                         */
/*                                                                            */
/*  The receipt scheme's whole claim is that a user agreed to EXACTLY the copy */
/*  the database stores. Two client-side mistakes can quietly falsify that     */
/*  claim, and neither one throws:                                             */
/*                                                                            */
/*    1. recomputing a hash from the text the client happens to hold — which   */
/*       passes PROCESSING_POLICY_STALE every time, including the time it      */
/*       mattered, because it verifies a copy against itself;                  */
/*    2. resubmitting after a stale response instead of re-presenting.         */
/*                                                                            */
/*  So the assertions below are about the exact bytes on the wire, not about   */
/*  the shape of a return value.                                              */
/* -------------------------------------------------------------------------- */

const TERMS_HASH = "a".repeat(64);
const PRIVACY_HASH = "b".repeat(64);
const NOTICE_HASH = "c".repeat(64);
const AGREEMENT_HASH = "d".repeat(64);

function policyRow(over: Record<string, unknown> = {}) {
  return {
    authorized: false,
    code: "PROCESSING_AUTHORIZATION_REQUIRED",
    policy_available: true,
    policy_id: "policy-uuid",
    policy_version: "phase1-2026.1",
    terms_version: "2.0",
    terms_copy: "Terms text",
    terms_copy_sha256: TERMS_HASH,
    privacy_version: "2.0",
    privacy_copy: "Privacy text",
    privacy_copy_sha256: PRIVACY_HASH,
    ai_notice_version: "1.0",
    ai_notice_copy: "AI notice text",
    ai_notice_copy_sha256: NOTICE_HASH,
    agreement_copy: "I agree and continue",
    agreement_copy_sha256: AGREEMENT_HASH,
    minimum_age: 18,
    allowed_countries: ["pl"],
    ai_notice_rendered: false,
    ...over,
  };
}

function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url, init);
    return {
      ok: true,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reading the policy", () => {
  it("maps an active policy awaiting acceptance", async () => {
    stubFetch(() => policyRow());
    const status = await fetchAuthorization();
    expect(status.kind).toBe("acceptance_required");
    if (status.kind !== "acceptance_required") return;
    expect(status.policy.terms.sha256).toBe(TERMS_HASH);
    expect(status.policy.allowedCountries).toEqual(["pl"]);
    expect(status.policy.minimumAge).toBe(18);
  });

  it("maps an accepted principal", async () => {
    stubFetch(() => policyRow({ authorized: true, code: "PROCESSING_AUTHORIZED" }));
    expect((await fetchAuthorization()).kind).toBe("authorized");
  });

  it("an inactive policy is unavailable, NOT acceptance_required", async () => {
    // Presenting an acceptance screen with no policy behind it would be
    // inventing terms. There is nothing to agree to, and the caller must be
    // able to tell that apart from "you have not agreed yet".
    stubFetch(() => ({
      authorized: false,
      code: "PROCESSING_POLICY_INACTIVE",
      policy_available: false,
    }));
    const status = await fetchAuthorization();
    expect(status.kind).toBe("unavailable");
  });

  it("a policy missing one hash is unusable, not partially usable", async () => {
    // It cannot be accepted (the RPC would reject the acceptance) and its copy
    // must not be rendered as a page the user then agrees to.
    stubFetch(() => policyRow({ privacy_copy_sha256: "" }));
    expect((await fetchAuthorization()).kind).toBe("unavailable");
  });

  it("a policy with no allowed countries is unusable", async () => {
    // Every acceptance must name a country the RPC will match exactly. With an
    // empty list no country can be chosen, so the screen has no valid outcome.
    stubFetch(() => policyRow({ allowed_countries: [] }));
    expect((await fetchAuthorization()).kind).toBe("unavailable");
  });

  it("a failed request is an error, not a verdict about the policy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    expect((await fetchAuthorization()).kind).toBe("error");
  });
});

async function acceptedPolicy(): Promise<ProcessingPolicy> {
  stubFetch(() => policyRow());
  const status = await fetchAuthorization();
  if (status.kind !== "acceptance_required") throw new Error("fixture");
  return status.policy;
}

describe("sending the acceptance", () => {
  it("sends back the four hashes EXACTLY as received", async () => {
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.terms_copy_sha256).toBe(TERMS_HASH);
    expect(body.privacy_copy_sha256).toBe(PRIVACY_HASH);
    expect(body.ai_notice_copy_sha256).toBe(NOTICE_HASH);
    expect(body.agreement_copy_sha256).toBe(AGREEMENT_HASH);
  });

  it("never sends any policy COPY back to the server", async () => {
    // The server has the copy; echoing it invites a future "well, we could
    // just hash what the client sent" shortcut, which is the failure mode the
    // hash comparison exists to prevent.
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    const raw = String(spy.mock.calls[0][1]?.body);
    expect(raw).not.toContain("Terms text");
    expect(raw).not.toContain("Privacy text");
    expect(raw).not.toContain("AI notice text");
  });

  it("sends the exact explicit_action the RPC demands", async () => {
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.explicit_action).toBe("agree_and_continue");
    expect(body.age_18_attested).toBe(true);
  });

  it("lowercases and trims the country — the RPC compares exactly", async () => {
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "  PL ",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).country_of_residence)
      .toBe("pl");
  });

  it("a stale policy is reported as stale and NOT retried in place", async () => {
    // The caller must re-fetch and re-present. Resubmitting the hashes we
    // already hold could only ever fail the same way, and silently re-hashing
    // would record agreement to words the user never saw.
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ code: "PROCESSING_POLICY_STALE" }));
    const result = await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    expect(result.kind).toBe("stale");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refused country rather than swallowing it", async () => {
    const policy = await acceptedPolicy();
    stubFetch(() => ({ code: "COUNTRY_NOT_ALLOWED", error: "Not available." }));
    const result = await acceptAuthorization({
      policy,
      countryOfResidence: "de",
      locale: "de-DE",
      clientVersion: "web-1",
      idempotencyKey: "attempt-1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") expect(result.code).toBe("COUNTRY_NOT_ALLOWED");
  });

  it("carries the caller's idempotency key unchanged", async () => {
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      idempotencyKey: "attempt-7",
    });
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).idempotency_key)
      .toBe("attempt-7");
  });
});

describe("the AI notice exposure receipt", () => {
  it("posts the notice version it was shown", async () => {
    const spy = stubFetch(() => ({ id: "exposure-1" }));
    await recordAiNoticeRendered({
      aiNoticeVersion: "1.0",
      surface: "acceptance",
      clientRenderId: "render-1",
      clientVersion: "web-1",
    });
    expect(String(spy.mock.calls[0][0])).toContain("/ai-rendered");
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.ai_notice_version).toBe("1.0");
    expect(body.surface).toBe("acceptance");
    expect(typeof body.rendered_at).toBe("string");
  });

  it("a failed receipt never throws — it must not block the notice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    await expect(recordAiNoticeRendered({
      aiNoticeVersion: "1.0",
      surface: "acceptance",
      clientRenderId: "render-1",
      clientVersion: "web-1",
    })).resolves.toBe(false);
  });
});
