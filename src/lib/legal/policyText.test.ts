import { describe, expect, it } from "vitest";
import { policyTextState } from "./policyText";
import type {
  AuthorizationStatus,
  ProcessingPolicy,
} from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  Task 4 — the text a user READS must be the text whose hash they ACCEPT.    */
/*                                                                            */
/*  While /terms and /privacy were hardcoded JSX, those two could drift apart  */
/*  with nothing able to notice: POLICY_COPY_HASH_MISMATCH and                 */
/*  PROCESSING_POLICY_STALE guard the stored copy, and neither can see a       */
/*  separately maintained React page. The receipt would then prove agreement   */
/*  to words nobody was shown — worse than no receipt, because it looks like   */
/*  evidence.                                                                 */
/* -------------------------------------------------------------------------- */

const policy: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-2026.1",
  terms: { version: "2.0", copy: "TERMS BYTES", sha256: "a".repeat(64) },
  privacy: { version: "2.0", copy: "PRIVACY BYTES", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "NOTICE", sha256: "c".repeat(64) },
  agreementCopy: "I agree and continue",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl"],
  minimumAge: 18,
  aiNoticeRendered: false,
};

const required: AuthorizationStatus = {
  kind: "acceptance_required",
  policy,
  code: "PROCESSING_AUTHORIZATION_REQUIRED",
};
const authorized: AuthorizationStatus = { kind: "authorized", policy };

describe("which text the page shows", () => {
  it("shows the stored terms when a policy is active", () => {
    const state = policyTextState(required, "terms");
    expect(state).toEqual({
      kind: "published",
      copy: "TERMS BYTES",
      version: "2.0",
    });
  });

  it("picks the privacy document for the privacy page", () => {
    // A which/document mix-up would render the wrong policy under the right
    // heading — and it would look completely normal.
    const state = policyTextState(required, "privacy");
    expect(state).toEqual({
      kind: "published",
      copy: "PRIVACY BYTES",
      version: "2.0",
    });
  });

  it("shows the stored text to an already-accepted user too", () => {
    // The page is not the acceptance screen; having agreed does not mean you
    // should now be shown a different, stale document.
    expect(policyTextState(authorized, "terms")).toMatchObject({
      kind: "published",
      copy: "TERMS BYTES",
    });
  });

  it("returns the copy VERBATIM — no trimming, no transformation", () => {
    // The stored bytes are what was hashed. Anything that alters them shows
    // the user something other than what their receipt attests to.
    const raw = "  Line one\n\n\tIndented\n\nTrailing   \n";
    const state = policyTextState(
      { ...required, policy: { ...policy, terms: { ...policy.terms, copy: raw } } },
      "terms",
    );
    expect(state).toEqual({ kind: "published", copy: raw, version: "2.0" });
  });
});

describe("when there is nothing authoritative to show", () => {
  it("falls back when no policy is active", () => {
    expect(policyTextState(
      { kind: "unavailable", code: "PROCESSING_POLICY_INACTIVE" }, "terms",
    )).toEqual({ kind: "fallback" });
  });

  it("falls back when the request failed", () => {
    // A different fact about the system, the same fact about this page.
    expect(policyTextState(
      { kind: "error", message: "offline" }, "privacy",
    )).toEqual({ kind: "fallback" });
  });

  it("falls back on an active policy carrying an EMPTY document", () => {
    // A blank page presented as "the current terms" is worse than showing the
    // last published ones with a label.
    for (const empty of ["", "   ", "\n\n"]) {
      const state = policyTextState(
        { ...required, policy: { ...policy, terms: { ...policy.terms, copy: empty } } },
        "terms",
      );
      expect(state).toEqual({ kind: "fallback" });
    }
  });
});
