import { describe, expect, it } from "vitest";
import type { ProcessingPolicy } from "@/services/api/processingAuthorization";
import {
  allDocumentsSeen,
  canSubmit,
  countryChoices,
  nextStep,
  previousStep,
  STEP_ORDER,
  type Step,
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

describe("step order", () => {
  it("walks the documents between the notice and the decision", () => {
    expect(STEP_ORDER).toEqual([
      "notice",
      "terms",
      "privacy",
      "ai",
      "country",
      "confirm",
    ]);
  });

  it("stops at both ends rather than wrapping", () => {
    expect(previousStep("notice")).toBe("notice");
    expect(nextStep("confirm")).toBe("confirm");
  });

  it("is reversible everywhere in between", () => {
    for (const step of STEP_ORDER.slice(1)) {
      expect(nextStep(previousStep(step))).toBe(step);
    }
  });
});

describe("countryChoices", () => {
  it("names each allowed country and keeps its stored code", () => {
    const rows = countryChoices(policy({ allowedCountries: ["pl", "de"] }));
    expect(rows.map((r) => r.code).sort()).toEqual(["de", "pl"]);
    expect(rows.find((r) => r.code === "pl")?.label).toBe("Poland");
  });

  // Intl returns the code itself for a region it has no name for, and throws
  // RangeError on a malformed one. Both land on the uppercase code, so a bad
  // entry in allowed_countries shows as a visibly wrong row rather than a
  // blank one — which is what someone reviewing a registration needs to see.
  it("falls back to the uppercase code when the runtime has no name", () => {
    const rows = countryChoices(policy({ allowedCountries: ["qq"] }));
    expect(rows[0]).toEqual({ code: "qq", label: "QQ" });
  });

  it("survives a malformed code rather than throwing the screen away", () => {
    const rows = countryChoices(policy({ allowedCountries: ["99", "pl"] }));
    expect(rows.map((r) => r.label).sort()).toEqual(["99", "Poland"]);
  });

  it("emits one row per code and never a region grouping", () => {
    const rows = countryChoices(
      policy({ allowedCountries: ["pl", "de", "fr"] }),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.code.length === 2)).toBe(true);
  });

  it("normalises whatever case the policy stored", () => {
    const rows = countryChoices(policy({ allowedCountries: ["PL"] })); 
    expect(rows[0].code).toBe("pl");
  });

  /* ---- POLAND FIRST, ENGLISH ALWAYS (founder 2026-09-20) -------------- */

  it("puts Poland first however the policy ordered the codes", () => {
    // The first acceptance screen ever shown listed 27 countries with Poland
    // in alphabetical position; on a phone that is a scroll away from the one
    // row most people need.
    const rows = countryChoices(
      policy({ allowedCountries: ["at", "de", "fr", "pl", "be"] }),
    );
    expect(rows[0].code).toBe("pl");
  });

  it("keeps the rest alphabetical after the pinned row", () => {
    const rows = countryChoices(
      policy({ allowedCountries: ["fr", "at", "pl", "de"] }),
    );
    expect(rows.map((r) => r.label)).toEqual([
      "Poland", "Austria", "France", "Germany",
    ]);
  });

  it("shows Poland exactly once, not pinned and alphabetical too", () => {
    const rows = countryChoices(
      policy({ allowedCountries: ["de", "pl", "fr"] }),
    );
    expect(rows.filter((r) => r.code === "pl")).toHaveLength(1);
  });

  it("drops a duplicate the policy stored twice", () => {
    const rows = countryChoices(
      policy({ allowedCountries: ["pl", "de", "PL", "de"] }),
    );
    expect(rows.map((r) => r.code)).toEqual(["pl", "de"]);
  });

  it("still leads with Poland when it is the only country", () => {
    expect(countryChoices(policy({ allowedCountries: ["pl"] }))[0].code)
      .toBe("pl");
  });

  it("is unaffected when Poland is not allowed at all", () => {
    const rows = countryChoices(policy({ allowedCountries: ["fr", "de"] }));
    expect(rows.map((r) => r.label)).toEqual(["France", "Germany"]);
  });

  /* ENGLISH REGARDLESS OF THE DEVICE. This is the actual report: a
     French-language phone rendered "Where do you live?" above Allemagne,
     Autriche, Belgique — half a legal screen in each language. The names no
     longer read `navigator.language` at all, so the stub below changes
     nothing. */
  it("names countries in English whatever the device language is", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "language");
    Object.defineProperty(navigator, "language", {
      value: "fr-FR",
      configurable: true,
    });
    try {
      const rows = countryChoices(
        policy({ allowedCountries: ["de", "at", "be"] }),
      );
      expect(rows.map((r) => r.label)).toEqual([
        "Austria", "Belgium", "Germany",
      ]);
    } finally {
      if (original) Object.defineProperty(navigator, "language", original);
    }
  });
});

describe("canSubmit", () => {
  const p = policy({ allowedCountries: ["pl", "de"] });

  it("requires country, age and the sensitive-data consent together", () => {
    expect(
      canSubmit(
        { country: "pl", ageAttested: true, sensitiveAttested: true },
        p,
      ),
    ).toBe(true);
  });

  it("refuses when either attestation is missing", () => {
    expect(
      canSubmit(
        { country: "pl", ageAttested: false, sensitiveAttested: true },
        p,
      ),
    ).toBe(false);
    expect(
      canSubmit(
        { country: "pl", ageAttested: true, sensitiveAttested: false },
        p,
      ),
    ).toBe(false);
  });

  it("refuses without a country", () => {
    expect(
      canSubmit(
        { country: null, ageAttested: true, sensitiveAttested: true },
        p,
      ),
    ).toBe(false);
  });

  // The RPC raises COUNTRY_NOT_ALLOWED for anything off the list; catching it
  // here is what keeps that from being a failed submit the user cannot read.
  it("refuses a country the policy does not allow", () => {
    expect(
      canSubmit(
        { country: "us", ageAttested: true, sensitiveAttested: true },
        p,
      ),
    ).toBe(false);
  });
});

describe("allDocumentsSeen", () => {
  it("is true only once all three have been opened", () => {
    const seen = new Set<Step>(["terms", "privacy"]);
    expect(allDocumentsSeen(seen)).toBe(false);
    seen.add("ai");
    expect(allDocumentsSeen(seen)).toBe(true);
  });

  it("ignores steps that are not documents", () => {
    expect(allDocumentsSeen(new Set<Step>(["notice", "country", "confirm"]))).toBe(
      false,
    );
  });
});
