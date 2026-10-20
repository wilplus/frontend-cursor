/*
STORY    As the founder, I want the CEO address to serve only the CEO tools and sign-in, and to trust only the address our proxy reports, so that admin tools are not exposed and the address cannot be faked.
OUTCOME
  O1  CEO tools and sign-in are allowed; other pages are sent to the CEO home; other server routes answer "not found".
  O2  The address reported by our proxy wins over the one inside the request.
PROVES   O1 -> allows only the CEO tools and the authentication paths they need
         O2 -> uses the proxy's forwarded host and ignores a spoofed inner host
*/
import { describe, expect, it } from "vitest";
import {
  CEO_CANONICAL_HOST,
  decideCeoHostRoute,
} from "./hostRouting";

function decide(host: string, pathname: string, forwardedHost: string | null = null) {
  return decideCeoHostRoute({
    hostHeader: host,
    forwardedHostHeader: forwardedHost,
    pathname,
  });
}

describe("CEO hostname routing", () => {

  it("allows only the CEO tools and the authentication paths they need", () => {
    expect(decide(CEO_CANONICAL_HOST, "/login").action).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/api/v2/admin/whoami").action).toBe(
      "allow"
    );
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/ceo/bootstrap").action
    ).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/admin/users").action).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/admin/rings").action).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/admin/pace").action).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/admin/research").action).toBe("allow");
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/learning/ledger").action
    ).toBe("allow");
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/research/golden/confidence/next").action
    ).toBe("allow");
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/rings/features").action
    ).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/api/v2/admin/users").action).toBe(
      "allow"
    );
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/tokens/grant").action
    ).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/dashboard").action).toBe(
      "redirect-to-ceo"
    );
    expect(decide(CEO_CANONICAL_HOST, "/api/results/state").action).toBe(
      "not-found"
    );
  });

  it("uses the proxy's forwarded host and ignores a spoofed inner host", () => {
    expect(
      decide("internal.vercel.local", "/", "dev.willpowerlab.com, proxy.local")
    ).toEqual({ action: "redirect-to-ceo", isCeoHost: true });
  });
});
