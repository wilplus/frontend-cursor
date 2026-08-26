import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchUserProfile,
  saveUserProfile,
  shouldAskSex,
  type UserProfile,
} from "./userProfile";

/* -------------------------------------------------------------------------- */
/*  profile_sex is a FOUR-state field and the states are not interchangeable.  */
/*  The two failure modes worth a test are both silent:                       */
/*                                                                            */
/*    · treating "prefer_not_to_say" as unanswered → we re-ask someone who    */
/*      already declined, and the BE has already suppressed its acoustic      */
/*      fallback for them.                                                    */
/*    · letting an unexpected value through as a real answer → we would hand  */
/*      it back to the BE on the next partial POST and store a claim about    */
/*      the user that they never made.                                        */
/* -------------------------------------------------------------------------- */

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

const base = {
  domain: "sales",
  goal: "g",
  domain_vocabulary_default: [],
  is_coach: false,
  proficient_languages: undefined,
};

function mockGet(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => body,
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUserProfile — sex normalisation", () => {
  it.each(["female", "male", "prefer_not_to_say"] as const)(
    "passes %s through verbatim",
    async (sex) => {
      mockGet({ ...base, sex });
      await expect(fetchUserProfile()).resolves.toMatchObject({ sex });
    }
  );

  it("null stays null (never asked)", async () => {
    mockGet({ ...base, sex: null });
    await expect(fetchUserProfile()).resolves.toMatchObject({ sex: null });
  });

  it("an ABSENT key reads as undefined (backend predates PR #288)", async () => {
    mockGet(base);
    await expect(fetchUserProfile()).resolves.toMatchObject({ sex: undefined });
  });

  it("distinguishes absent-key from present-null", async () => {
    mockGet(base);
    const noColumn = await fetchUserProfile();
    mockGet({ ...base, sex: null });
    const neverAsked = await fetchUserProfile();
    // Both are "no answer", but only one of them may be asked about.
    expect(noColumn?.sex).toBeUndefined();
    expect(neverAsked?.sex).toBeNull();
    expect(shouldAskSex(noColumn)).toBe(false);
    expect(shouldAskSex(neverAsked)).toBe(true);
  });

  it.each(["Female", "FEMALE", "f", "", "other", 1, true, {}])(
    "degrades unrecognised value %p to null rather than trusting it",
    async (sex) => {
      mockGet({ ...base, sex });
      await expect(fetchUserProfile()).resolves.toMatchObject({ sex: null });
    }
  );
});

describe("shouldAskSex", () => {
  const withSex = (sex: UserProfile["sex"]): UserProfile => ({ ...base, sex });

  it("asks when never asked", () => {
    expect(shouldAskSex(withSex(null))).toBe(true);
  });

  it.each(["female", "male"] as const)("does not re-ask after %s", (sex) => {
    expect(shouldAskSex(withSex(sex))).toBe(false);
  });

  it("does NOT re-ask after prefer_not_to_say (a decline is an answer)", () => {
    expect(shouldAskSex(withSex("prefer_not_to_say"))).toBe(false);
  });

  it("does not ask while the profile is unread (no flash on load)", () => {
    expect(shouldAskSex(null)).toBe(false);
  });

  it("does not ask when the backend has no column (undefined)", () => {
    expect(shouldAskSex(withSex(undefined))).toBe(false);
  });
});

describe("saveUserProfile — partial update semantics", () => {
  function mockPost() {
    const spy = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true }));
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  /** The body the client actually put on the wire. */
  const sentBody = (spy: ReturnType<typeof mockPost>) =>
    JSON.parse(String(spy.mock.calls[0]![1].body)) as Record<string, unknown>;

  it("sends sex alone, so domain/goal keys are absent and stay untouched", async () => {
    const spy = mockPost();
    await saveUserProfile({ sex: "male" });
    const body = sentBody(spy);
    expect(body).toEqual({ sex: "male" });
    expect(body).not.toHaveProperty("domain");
    expect(body).not.toHaveProperty("goal");
  });

  it("keeps an explicit null in the body, which is the documented clear", async () => {
    const spy = mockPost();
    await saveUserProfile({ sex: null });
    expect(sentBody(spy)).toEqual({ sex: null });
  });

  it("omits sex entirely when undefined, so a domain write cannot clear it", async () => {
    const spy = mockPost();
    await saveUserProfile({ domain: "sales" });
    expect(sentBody(spy)).not.toHaveProperty("sex");
  });
});
