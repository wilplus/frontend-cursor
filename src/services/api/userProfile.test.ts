/*
GUARD    Concurrent profile reads share one request, and a failed read is not
         shared, so page load does not hammer the backend and one blip does
         not stick.
CATCHES  Each caller fetching its own profile; or a failed (null) read being
         served to every later caller for the rest of the window.
IF REMOVED  A change to the shared read could multiply profile requests per
         page, or pin a signed-in coach to "no profile" after one error.
PROVES   one request -> "serves every caller from one request"
         no failure  -> "does not share a failed read: the next caller asks again"
*/
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

  const coach = () =>
    new Response(JSON.stringify({ domain: null, goal: null, is_coach: true,
                                  proficient_languages: ["en"] }));

  it("serves every caller from one request", async () => {
    const fetchMock = vi.fn(async () => coach());
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([
      fetchUserProfileShared(), fetchUserProfileShared(),
    ]);
    expect(a?.is_coach).toBe(true);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not share a failed read: the next caller asks again", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockImplementation(async () => coach());
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchUserProfileShared()).toBeNull();
    expect((await fetchUserProfileShared())?.is_coach).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
