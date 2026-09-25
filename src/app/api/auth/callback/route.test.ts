import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GET } from "./route";

/**
 * The orphan callback must forward, not exchange.
 *
 * Nothing in the app points at /api/auth/callback — both provider buttons use
 * /auth/callback. But the route file is served regardless, and it used to run
 * the exchange itself with the legacy cookie API and throw the result away, so
 * a failed exchange redirected to /dashboard looking like a successful login
 * with no session and nothing in the console.
 *
 * These cases pin the properties that matter if an old redirect URL is still
 * configured somewhere: the code survives the hop, the PKCE state survives the
 * hop, and nothing lands on /dashboard any more.
 */
const call = (url: string) => GET(new NextRequest(new Request(url)));

describe("legacy /api/auth/callback", () => {
  it("forwards the OAuth code to the real callback", async () => {
    const res = await call("https://willpowerlab.com/api/auth/callback?code=abc123");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("code")).toBe("abc123");
  });

  it("carries the PKCE state and next through", async () => {
    const res = await call(
      "https://willpowerlab.com/api/auth/callback?code=abc&state=xyz&next=/results",
    );
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("state")).toBe("xyz");
    expect(location.searchParams.get("next")).toBe("/results");
  });

  it("forwards a provider error rather than swallowing it", async () => {
    const res = await call(
      "https://willpowerlab.com/api/auth/callback?error=access_denied" +
        "&error_description=user%20cancelled",
    );
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("error")).toBe("access_denied");
  });

  it("never sends anyone to /dashboard", async () => {
    for (const url of [
      "https://willpowerlab.com/api/auth/callback",
      "https://willpowerlab.com/api/auth/callback?code=abc",
      "https://willpowerlab.com/api/auth/callback?type=recovery",
    ]) {
      const res = await call(url);
      expect(new URL(res.headers.get("location")!).pathname).not.toBe("/dashboard");
    }
  });

  it("does not attempt the exchange itself", async () => {
    // The old route imported @supabase/ssr and called exchangeCodeForSession.
    // Doing that here at all is the bug, whatever the cookie API — the browser
    // client owns PKCE. Read the source rather than the behaviour, because a
    // silent failure looks identical to a success from the outside.
    //
    // Comments are stripped first: the docblock in route.ts names both calls
    // in order to explain why they are gone, and a guard that fires on its own
    // explanation is a guard nobody keeps.
    const raw = readFileSync(
      fileURLToPath(new URL("./route.ts", import.meta.url)),
      "utf-8",
    );
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("exchangeCodeForSession");
    expect(code).not.toContain("createServerClient");
  });
});
