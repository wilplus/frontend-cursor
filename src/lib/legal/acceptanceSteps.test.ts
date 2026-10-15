import { describe, expect, it } from "vitest";
import type { ProcessingPolicy } from "@/services/api/processingAuthorization";
import {
  canSubmit,
  countryChoices,
} from "./acceptanceSteps";

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

  it("requires country, age and the sensitive-data consent together", () => {
    expect(
      canSubmit(
        { country: "pl", ageAttested: true, sensitiveAttested: true, practiceOptIn: false },
        p,
      ),
    ).toBe(true);
  });
});

describe("the optional practice purposes", () => {
  const p = policy({ allowedCountries: ["pl"] });
  const base = {
    country: "pl",
    ageAttested: true,
    sensitiveAttested: true,
  };

  it("does NOT gate the button — declining still submits", () => {
    // THE WHOLE POINT. An optional purpose that blocks submission is a
    // required purpose wearing an optional tick, which is the Art 7(4) defect
    // the 2026-09-23 policy exists to remove.
    expect(canSubmit({ ...base, practiceOptIn: false }, p)).toBe(true);
    expect(canSubmit({ ...base, practiceOptIn: true }, p)).toBe(true);
  });
});

describe("countryChoices", () => {
  it("lists Poland first and the United States right below it, the rest by name", () => {
    const p = policy({ allowedCountries: ["de", "us", "at", "pl"] });
    expect(countryChoices(p, "en").map((c) => c.code)).toEqual(["pl", "us", "at", "de"]);
  });
});
