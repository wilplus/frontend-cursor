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
});
