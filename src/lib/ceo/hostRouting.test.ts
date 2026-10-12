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
    expect(decide(CEO_CANONICAL_HOST, "/admin/tokens").action).toBe("allow");
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
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/tokens/lookup").action
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
