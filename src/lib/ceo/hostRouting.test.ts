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

  it("moves main-domain CEO pages to the canonical subdomain", () => {
    expect(decide("www.willpowerlab.com", "/admin/ceo").action).toBe(
      "redirect-to-ceo-host"
    );
    expect(decide("www.willpowerlab.com", "/admin/users").action).toBe(
      "redirect-to-ceo-host"
    );
    expect(decide("www.willpowerlab.com", "/admin/tokens").action).toBe(
      "redirect-to-ceo-host"
    );
    expect(
      decide("willpowerlab.com", "/api/v2/admin/ceo/bootstrap").action
    ).toBe("not-found");
    expect(
      decide("willpowerlab.com", "/api/v2/admin/users").action
    ).toBe("not-found");
    expect(
      decide("willpowerlab.com", "/api/v2/admin/tokens/grant").action
    ).toBe("not-found");
  });

  it("serves the project deletion queue only on the CEO host", () => {
    expect(decide(CEO_CANONICAL_HOST, "/admin/project-deletions").action).toBe(
      "allow"
    );
    expect(
      decide(
        CEO_CANONICAL_HOST,
        "/api/v2/admin/project-deletions/00000000-0000-4000-8000-000000000000/confirm"
      ).action
    ).toBe("allow");
    expect(decide("www.willpowerlab.com", "/admin/project-deletions").action).toBe(
      "redirect-to-ceo-host"
    );
    expect(
      decide("willpowerlab.com", "/api/v2/admin/project-deletions").action
    ).toBe("not-found");
  });

  it("serves the library and the speaking errors pages next to pace (CP3 A)", () => {
    for (const page of ["/admin/library", "/admin/errors"]) {
      expect(decide(CEO_CANONICAL_HOST, page).action, page).toBe("allow");
      expect(decide("www.willpowerlab.com", page).action, page).toBe(
        "redirect-to-ceo-host"
      );
    }
    // The endpoints those pages read answer on the CEO host…
    for (const api of [
      "/api/v2/coach/exercises",
      "/api/v2/coach/exercises/land-the-ending/video",
      "/api/v2/coach/exercises/script-draft",
      "/api/v2/coach/catalogue",
      "/api/v2/coach/speaking-errors",
      "/api/v2/user/profile",
    ]) {
      expect(decide(CEO_CANONICAL_HOST, api).action, api).toBe("allow");
      // …and stay where the coach's walk reads them on the main host.
      expect(decide("www.willpowerlab.com", api).action, api).toBe("allow");
    }
    // The rest of the coach's surface stays off the CEO host.
    expect(decide(CEO_CANONICAL_HOST, "/api/v2/coach/queue/moments").action).toBe(
      "not-found"
    );
    expect(decide(CEO_CANONICAL_HOST, "/coach/exercises").action).toBe(
      "redirect-to-ceo"
    );
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
