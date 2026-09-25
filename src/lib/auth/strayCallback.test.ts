import { describe, expect, it } from "vitest";

import { strayAuthCallbackUrl } from "./strayCallback";

const BASE = "https://www.willpowerlab.com";

describe("strayAuthCallbackUrl", () => {
  it("sends a LinkedIn code that fell back to the Site URL to the callback", () => {
    const target = strayAuthCallbackUrl(`${BASE}/?code=abc&state=xyz`);
    expect(target?.pathname).toBe("/auth/callback");
    expect(target?.searchParams.get("code")).toBe("abc");
    expect(target?.searchParams.get("state")).toBe("xyz");
    expect(target?.origin).toBe(BASE);
  });

  it("rescues /chat and keeps the /dashboard rescue it replaces", () => {
    expect(strayAuthCallbackUrl(`${BASE}/chat?code=abc`)?.pathname).toBe("/auth/callback");
    expect(strayAuthCallbackUrl(`${BASE}/dashboard?code=abc`)?.pathname).toBe("/auth/callback");
    expect(
      strayAuthCallbackUrl(`${BASE}/dashboard?type=recovery`)?.searchParams.get("type"),
    ).toBe("recovery");
  });

  it("routes a provider refusal to the callback so it reaches /login", () => {
    const target = strayAuthCallbackUrl(
      `${BASE}/?error=access_denied&error_description=The+user+cancelled`,
    );
    expect(target?.pathname).toBe("/auth/callback");
    expect(target?.searchParams.get("error_description")).toBe("The user cancelled");
  });

  it("leaves ordinary visits alone", () => {
    expect(strayAuthCallbackUrl(`${BASE}/`)).toBeNull();
    expect(strayAuthCallbackUrl(`${BASE}/chat?project=1`)).toBeNull();
    expect(strayAuthCallbackUrl(`${BASE}/?error=x`)).toBeNull();
  });

  it("never touches the callback itself or other pages", () => {
    expect(strayAuthCallbackUrl(`${BASE}/auth/callback?code=abc`)).toBeNull();
    expect(strayAuthCallbackUrl(`${BASE}/auth/oauth-complete?code=abc`)).toBeNull();
    expect(strayAuthCallbackUrl(`${BASE}/recordings?code=abc`)).toBeNull();
  });
});
