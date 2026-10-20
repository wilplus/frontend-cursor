// @vitest-environment jsdom
/*
STORY    As a speaker signing in, I want a failed sign-in to retry the provider I picked only once, so that I am not stuck in a loop.
OUTCOME
  O1  The provider I picked is retried once, then never again.
PROVES   O1 -> restarts the provider the person picked, exactly once
*/
import { beforeEach, describe, expect, it } from "vitest";

import { claimOAuthRetry, rememberOAuthStart } from "./oauthRetry";

describe("claimOAuthRetry", () => {
  beforeEach(() => window.localStorage.clear());

  it("restarts the provider the person picked, exactly once", () => {
    rememberOAuthStart("linkedin_oidc");
    expect(claimOAuthRetry()).toBe("linkedin_oidc");
    expect(claimOAuthRetry()).toBeNull();
  });
});
