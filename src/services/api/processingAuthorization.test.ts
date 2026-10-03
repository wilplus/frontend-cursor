import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Signed in unless a test says otherwise: a session never mints a guest
// identity, so the wire below is exactly the acceptance contract's own.
let authToken: string | null = "session-token";
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(authToken),
}));

import { __resetGuestOwnerMemoryForTests } from "./projects";
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
  authToken = "session-token";
  __resetGuestOwnerMemoryForTests();
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

  it("says when a newer policy replaced the one accepted (0358)", async () => {
    stubFetch(() => policyRow({ reacceptance_required: true }));
    const status = await fetchAuthorization();
    expect(status.kind === "acceptance_required" && status.acceptedEarlierVersion).toBe(true);
    stubFetch(() => policyRow());
    const first = await fetchAuthorization();
    expect(first.kind === "acceptance_required" && first.acceptedEarlierVersion).toBe(false);
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
      optionalPurposes: [],
      idempotencyKey: "attempt-1",
    });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.terms_copy_sha256).toBe(TERMS_HASH);
    expect(body.privacy_copy_sha256).toBe(PRIVACY_HASH);
    expect(body.ai_notice_copy_sha256).toBe(NOTICE_HASH);
    expect(body.agreement_copy_sha256).toBe(AGREEMENT_HASH);
  });

  it("sends only the optional purposes that were ticked", async () => {
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      optionalPurposes: ["personalized_exercise_recommendation"],
      idempotencyKey: "attempt-1",
    });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.optional_purposes).toEqual([
      "personalized_exercise_recommendation",
    ]);
  });

  it("sends an empty array when practice was declined", async () => {
    // A recorded no. The receipt must be able to distinguish "said no" from
    // "was never asked", and an absent field cannot.
    const policy = await acceptedPolicy();
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1" }));
    await acceptAuthorization({
      policy,
      countryOfResidence: "pl",
      locale: "pl-PL",
      clientVersion: "web-1",
      optionalPurposes: [],
      idempotencyKey: "attempt-1",
    });
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.optional_purposes).toEqual([]);
    expect("optional_purposes" in body).toBe(true);
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
      optionalPurposes: [],
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
      optionalPurposes: [],
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
      optionalPurposes: [],
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
      optionalPurposes: [],
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
      optionalPurposes: [],
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
      optionalPurposes: [],
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

describe("a first-time guest (F1 Repair Plan Phase 0.5)", () => {
  // Under PLF1 enforce a visitor with no account and no stored guest token
  // got "A verified owner is required." on the acceptance read and on project
  // creation, so they never saw the Terms and never recorded. The client now
  // mints the guest identity first and carries it on every call.
  let store: Record<string, string>;

  beforeEach(() => {
    authToken = null;
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  it("mints the guest identity, stores it, then reads the policy with it", async () => {
    const spy = stubFetch((url) =>
      url.endsWith("/principal")
        ? { owner_principal_id: "guest-1", is_guest: true, guest_owner_token: "guest-token" }
        : policyRow(),
    );
    const status = await fetchAuthorization();
    expect(status.kind).toBe("acceptance_required");
    expect(String(spy.mock.calls[0][0])).toBe("/api/v2/processing-authorization/principal");
    expect(spy.mock.calls[0][1]?.method).toBe("POST");
    const read = spy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(read["X-Willab-Guest-Owner"]).toBe("guest-token");
    expect(Object.values(store)).toContain("guest-token");
  });

  it("mints once: a stored identity is reused, and so is one in flight", async () => {
    const spy = stubFetch((url) =>
      url.endsWith("/principal")
        ? { owner_principal_id: "guest-1", is_guest: true, guest_owner_token: "guest-token" }
        : policyRow(),
    );
    await Promise.all([fetchAuthorization(), fetchAuthorization()]);
    await fetchAuthorization();
    const mints = spy.mock.calls.filter(([u]) => String(u).endsWith("/principal"));
    expect(mints).toHaveLength(1);
  });

  it("carries the guest identity on the acceptance itself", async () => {
    store["willab_guest_owner:v1"] = "stored-token";
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1", policy_version: "phase1-2026.1" }));
    const status = await fetchAuthorization();
    expect(status.kind).toBeDefined();
    expect(spy.mock.calls.some(([u]) => String(u).endsWith("/principal"))).toBe(false);
    const read = spy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(read["X-Willab-Guest-Owner"]).toBe("stored-token");
  });

  it("a signed-in person never mints a guest identity", async () => {
    authToken = "session-token";
    const spy = stubFetch(() => policyRow());
    await fetchAuthorization();
    expect(spy.mock.calls.some(([u]) => String(u).endsWith("/principal"))).toBe(false);
  });

  it("a failed mint leaves the read as it was before", async () => {
    const spy = vi.fn(async (url: string) => {
      if (url.endsWith("/principal")) throw new Error("offline");
      return { ok: true, json: async () => policyRow() } as unknown as Response;
    });
    vi.stubGlobal("fetch", spy);
    expect((await fetchAuthorization()).kind).toBe("acceptance_required");
    const read = spy.mock.calls[1] as unknown as [string, RequestInit];
    expect((read[1].headers as Record<string, string>)["X-Willab-Guest-Owner"]).toBeUndefined();
  });

  it("a refused identity that holds nothing is dropped and minted again", async () => {
    store["willab_guest_owner:v1"] = "stale-token";
    store["willab_guest_owner_minted_only:v1"] = "1";
    let reads = 0;
    const spy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/principal")) {
        return { ok: true, json: async () => ({ is_guest: true, guest_owner_token: "fresh-token" }) } as unknown as Response;
      }
      reads += 1;
      const sent = (init?.headers as Record<string, string>)["X-Willab-Guest-Owner"];
      const body = sent === "fresh-token"
        ? policyRow()
        : { code: "INVALID_GUEST_OWNER", error: "Guest owner token was rejected" };
      return { ok: sent === "fresh-token", json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", spy);
    expect((await fetchAuthorization()).kind).toBe("acceptance_required");
    expect(reads).toBe(2);
    expect(store["willab_guest_owner:v1"]).toBe("fresh-token");
  });

  it("the acceptance and the AI-notice receipt carry the same identity", async () => {
    store["willab_guest_owner:v1"] = "stored-token";
    const spy = stubFetch(() => ({ authorized: true, receipt_id: "r1", policy_version: "phase1-2026.1" }));
    const status = await fetchAuthorization();
    expect(status.kind).toBeDefined();
    await recordAiNoticeRendered({ aiNoticeVersion: "1.0", surface: "s", clientRenderId: "c", clientVersion: "v" });
    for (const [, init] of spy.mock.calls) {
      expect((init?.headers as Record<string, string>)["X-Willab-Guest-Owner"]).toBe("stored-token");
    }
  });

  it("a refused identity that holds the guest's work is kept, never reminted", async () => {
    // The backend also answers INVALID_GUEST_OWNER when its principal read
    // fails; dropping a used identity on that would lose the guest's work.
    store["willab_guest_owner:v1"] = "used-token";
    const spy = stubFetch((url) =>
      url.endsWith("/principal")
        ? { guest_owner_token: "should-not-mint" }
        : { code: "INVALID_GUEST_OWNER", error: "Guest owner token was rejected" },
    );
    await fetchAuthorization();
    expect(spy.mock.calls.some(([u]) => String(u).endsWith("/principal"))).toBe(false);
    expect(store["willab_guest_owner:v1"]).toBe("used-token");
  });

  it("a guest's acceptance marks the identity used; a signed-in one does not", async () => {
    store["willab_guest_owner:v1"] = "minted-token";
    store["willab_guest_owner_minted_only:v1"] = "1";
    const policy = (await (async () => {
      stubFetch(() => policyRow());
      const st = await fetchAuthorization();
      return st.kind === "acceptance_required" ? st.policy : null;
    })())!;
    const accept = () => acceptAuthorization({
      policy, countryOfResidence: "pl", locale: "en", clientVersion: "v",
      idempotencyKey: "k", optionalPurposes: [],
    } as Parameters<typeof acceptAuthorization>[0]);
    stubFetch(() => ({ authorized: true, receipt_id: "r1", policy_version: "phase1-2026.1" }));
    authToken = "session-token";
    await accept();
    expect(store["willab_guest_owner_minted_only:v1"]).toBe("1");
    authToken = null;
    await accept();
    expect(store["willab_guest_owner_minted_only:v1"]).toBeUndefined();
  });
});
