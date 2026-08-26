import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUserProfile, shouldAskRaterLanguages } from "./userProfile";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

describe("rater language profile contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes, deduplicates and sorts explicit language codes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domain: null,
        goal: null,
        is_coach: true,
        sex: null,
        proficient_languages: [" PL ", "en", "pl", "invalid"],
      }),
    }));
    const profile = await fetchUserProfile();
    expect(profile?.proficient_languages).toEqual(["en", "pl"]);
  });

  it("asks a coach once when the supported field is empty", () => {
    const profile = {
      domain: null,
      goal: "",
      domain_vocabulary_default: [],
      is_coach: true,
      sex: null,
      proficient_languages: null,
    };
    expect(shouldAskRaterLanguages(profile)).toBe(true);
    expect(shouldAskRaterLanguages({
      ...profile,
      proficient_languages: ["en"],
    })).toBe(false);
  });

  it("does not ask against a backend that predates the field", () => {
    const profile = {
      domain: null,
      goal: "",
      domain_vocabulary_default: [],
      is_coach: true,
      sex: null,
      proficient_languages: undefined,
    };
    expect(shouldAskRaterLanguages(profile)).toBe(false);
  });
});
