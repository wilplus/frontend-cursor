import { describe, expect, it } from "vitest";
import { WILLAB_DOMAINS, domainSpec, type WillabDomain } from "./domains";

const ALL_KEYS: WillabDomain[] = [
  "public_speaking",
  "sales",
  "executive_presence",
  "customer_service",
  "interview_prep",
];

describe("WILLAB_DOMAINS", () => {
  it("is exactly the five locked domains, in order", () => {
    expect(WILLAB_DOMAINS.map((d) => d.key)).toEqual(ALL_KEYS);
  });

  it("has unique enum keys (the metadata contract)", () => {
    expect(new Set(WILLAB_DOMAINS.map((d) => d.key)).size).toBe(5);
  });

  it("gives every domain a label, a goal placeholder, and a non-empty vocabulary", () => {
    for (const d of WILLAB_DOMAINS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.goalPlaceholder.length).toBeGreaterThan(0);
      expect(d.vocabulary.length).toBeGreaterThan(0);
    }
  });
});

describe("domainSpec", () => {
  it("returns the matching spec by key", () => {
    expect(domainSpec("sales").label).toBe("Sales");
    expect(domainSpec("interview_prep").label).toBe("Interview preparation");
  });

  it("resolves a valid spec for every known key", () => {
    for (const k of ALL_KEYS) expect(domainSpec(k).key).toBe(k);
  });
});
