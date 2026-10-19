/**
 * STORY    As a speaker signing in through an old link, I want to land on the
 *          real sign-in callback with my code or error intact, so that my
 *          login works or tells me why.
 * OUTCOME
 *   O1  The code, the PKCE state and `next` reach /auth/callback unchanged.
 *   O2  A provider error reaches /auth/callback instead of being swallowed.
 *   O3  Nothing lands on /dashboard, even with no code at all.
 * PROVES   O1 -> "forwards the code, the PKCE state and next to the real callback"
 *          O2 -> "forwards a provider error rather than swallowing it"
 *          O3 -> "with no code it still goes to the real callback, never /dashboard"
 * WHY      This route used to exchange the code itself and send a failed
 *          login to /dashboard looking signed in (see route.ts).
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const call = (url: string) => GET(new NextRequest(new Request(url)));
const landing = (res: Response) => new URL(res.headers.get("location")!);

describe("legacy /api/auth/callback", () => {
  it("forwards the code, the PKCE state and next to the real callback", async () => {
    const res = await call(
      "https://willpowerlab.com/api/auth/callback?code=abc123&state=pkce-xyz&next=%2Flab",
    );
    const location = landing(res);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("code")).toBe("abc123");
    expect(location.searchParams.get("state")).toBe("pkce-xyz");
    expect(location.searchParams.get("next")).toBe("/lab");
  });

  it("forwards a provider error rather than swallowing it", async () => {
    const res = await call(
      "https://willpowerlab.com/api/auth/callback?error=access_denied" +
        "&error_description=user%20cancelled",
    );
    const location = landing(res);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("error_description")).toBe("user cancelled");
  });

  it("with no code it still goes to the real callback, never /dashboard", async () => {
    const res = await call("https://willpowerlab.com/api/auth/callback");
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(landing(res).pathname).toBe("/auth/callback");
  });
});
