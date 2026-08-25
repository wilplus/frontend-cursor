import { describe, expect, it } from "vitest";
import {
  CEO_CANONICAL_HOST,
  ceoCanonicalUrl,
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
  it("makes the CEO root the subdomain home", () => {
    expect(decide(CEO_CANONICAL_HOST, "/")).toEqual({
      action: "redirect-to-ceo",
      isCeoHost: true,
    });
    expect(decide(CEO_CANONICAL_HOST, "/admin/ceo")).toEqual({
      action: "allow",
      isCeoHost: true,
    });
  });

  it("allows only the CEO and the authentication paths it needs", () => {
    expect(decide(CEO_CANONICAL_HOST, "/login").action).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/api/v2/admin/whoami").action).toBe(
      "allow"
    );
    expect(
      decide(CEO_CANONICAL_HOST, "/api/v2/admin/ceo/bootstrap").action
    ).toBe("allow");
    expect(decide(CEO_CANONICAL_HOST, "/dashboard").action).toBe(
      "redirect-to-ceo"
    );
    expect(decide(CEO_CANONICAL_HOST, "/api/results/state").action).toBe(
      "not-found"
    );
  });

  it("moves main-domain CEO pages to the canonical subdomain", () => {
    expect(decide("www.willpowerlab.com", "/admin/ceo").action).toBe(
      "redirect-to-ceo-host"
    );
    expect(
      decide("willpowerlab.com", "/api/v2/admin/ceo/bootstrap").action
    ).toBe("not-found");
  });

  it("removes deployment ports from canonical production redirects", () => {
    expect(
      ceoCanonicalUrl(
        "http://www.willpowerlab.com:3011/admin/ceo?project=research"
      ).toString()
    ).toBe(
      "https://dev.willpowerlab.com/admin/ceo?project=research"
    );
  });

  it("uses the proxy's forwarded host and ignores a spoofed inner host", () => {
    expect(
      decide("internal.vercel.local", "/", "dev.willpowerlab.com, proxy.local")
    ).toEqual({ action: "redirect-to-ceo", isCeoHost: true });
  });

  it("keeps local review available even when Next runs in production mode", () => {
    expect(decide("localhost:3000", "/admin/ceo").action).toBe("allow");
    expect(decide("127.0.0.1:3000", "/admin/ceo").action).toBe("allow");
  });
});
