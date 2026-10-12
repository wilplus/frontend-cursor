import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchUserProfileShared,
  forgetSharedUserProfile,
} from "./userProfile";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

describe("the shared profile read (founder 2026-09-26)", () => {
  afterEach(() => {
    forgetSharedUserProfile();
    vi.unstubAllGlobals();
  });

  const coach = {
    ok: true,
    json: async () => ({ domain: null, goal: null, is_coach: true,
                         proficient_languages: ["en"] }),
  };

  it("serves every caller from one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(coach);
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([
      fetchUserProfileShared(), fetchUserProfileShared(),
    ]);
    expect(a?.is_coach).toBe(true);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
