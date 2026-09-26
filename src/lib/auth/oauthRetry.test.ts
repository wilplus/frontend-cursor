// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { claimOAuthRetry, isStateReplayError, rememberOAuthStart } from "./oauthRetry";

describe("isStateReplayError", () => {
  it("matches Supabase's error code and its description", () => {
    expect(isStateReplayError("flow_state_already_used", null)).toBe(true);
    expect(isStateReplayError(null, "State has already been used")).toBe(true);
  });

  it("leaves every other OAuth failure alone", () => {
    expect(isStateReplayError("bad_oauth_state", "OAuth state has expired")).toBe(false);
    expect(isStateReplayError(null, "access_denied")).toBe(false);
    expect(isStateReplayError(null, null)).toBe(false);
  });
});

describe("claimOAuthRetry", () => {
  beforeEach(() => window.localStorage.clear());

  it("restarts the provider the person picked, exactly once", () => {
    rememberOAuthStart("linkedin_oidc");
    expect(claimOAuthRetry()).toBe("linkedin_oidc");
    expect(claimOAuthRetry()).toBeNull();
  });

  it("does not restart without a recorded sign-in", () => {
    expect(claimOAuthRetry()).toBeNull();
  });

  it("does not restart a sign-in started long ago", () => {
    rememberOAuthStart("google");
    expect(claimOAuthRetry(Date.now() + 11 * 60 * 1000)).toBeNull();
  });

  it("a new tap re-arms the restart", () => {
    rememberOAuthStart("linkedin_oidc");
    claimOAuthRetry();
    rememberOAuthStart("google");
    expect(claimOAuthRetry()).toBe("google");
  });
});
