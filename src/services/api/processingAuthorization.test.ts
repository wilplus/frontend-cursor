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
  pendingAccountDeletion,
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

  it("a blocked principal is blocked, NOT acceptance_required (PLF-T1)", async () => {
    // Re-accepting cannot lift a service block, so offering the acceptance
    // flow put the person in a loop they could never leave.
    stubFetch(() => policyRow({ code: "PROCESSING_SERVICE_BLOCKED" }));
    const status = await fetchAuthorization();
    expect(status.kind).toBe("blocked");
    if (status.kind !== "blocked") return;
    expect(status.code).toBe("PROCESSING_SERVICE_BLOCKED");
    // The policy rides along for a gate whose ended state is still off.
    expect(status.policy?.terms.sha256).toBe(TERMS_HASH);
    expect(status.pendingDeletion).toBeNull();
    expect(pendingAccountDeletion(status)).toBeNull();
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
});
