// @vitest-environment jsdom
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
