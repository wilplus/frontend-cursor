/*
STORY    As a speaker signing in with LinkedIn, I want a sign-in code that lands on the home page to be sent on to finish sign-in, so that sign-in completes.
OUTCOME
  O1  A code arriving on the home page is forwarded, unchanged, to the sign-in callback on the same site.
PROVES   O1 -> sends a LinkedIn code that fell back to the Site URL to the callback
*/
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
