/*
STORY    As a speaker accepting the terms, I want Continue to work only once I pick an allowed country and agree to the recordings consent, so that processing my recordings is properly authorised.
OUTCOME
  O1  Continue needs both a country and the recordings consent.
  O2  A country the policy does not allow is refused.
  O3  The country list shows Poland first, the United States next, then the rest by name.
PROVES   O1 -> needs the country and the recordings consent together
         O2 -> refuses a country the policy does not allow
         O3 -> lists Poland first and the United States right below it, the rest by name
*/
import { describe, expect, it } from "vitest";
import type { ProcessingPolicy } from "@/services/api/processingAuthorization";
import { canSubmit, countryChoices } from "./acceptanceSteps";

function policy(overrides: Partial<ProcessingPolicy> = {}): ProcessingPolicy {
  return {
    policyId: "p1",
    policyVersion: "phase1-2026.1",
    terms: { version: "2.0", copy: "terms", sha256: "a" },
    privacy: { version: "2.0", copy: "privacy", sha256: "b" },
    aiNotice: { version: "1.0", copy: "ai", sha256: "c" },
    agreementCopy: "agreement",
    agreementCopySha256: "d",
    allowedCountries: ["pl"],
    minimumAge: 18,
    aiNoticeRendered: false,
    ...overrides,
  };
}

describe("canSubmit", () => {
  const p = policy({ allowedCountries: ["pl", "de"] });

  it("needs the country and the recordings consent together", () => {
    expect(canSubmit({ country: "pl", sensitiveAttested: true }, p)).toBe(true);
    expect(canSubmit({ country: null, sensitiveAttested: true }, p)).toBe(false);
    expect(canSubmit({ country: "pl", sensitiveAttested: false }, p)).toBe(false);
  });

  it("refuses a country the policy does not allow", () => {
    expect(canSubmit({ country: "fr", sensitiveAttested: true }, p)).toBe(false);
  });
});

describe("countryChoices", () => {
  it("lists Poland first and the United States right below it, the rest by name", () => {
    const p = policy({ allowedCountries: ["de", "us", "at", "pl"] });
    const rows = countryChoices(p, "en");
    expect(rows.map((c) => c.code)).toEqual(["pl", "us", "at", "de"]);
    expect(rows[1].label).toBe("United States (California)");
  });
});
