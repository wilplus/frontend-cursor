import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The real client is never built here — the point of these tests is WHICH
 *  credentials createClient() hands over, and whether it throws first. */
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (url: string, key: string) => ({ url, key }),
}));

import { createClient } from "./client";

type Built = { url: string; key: string };
const build = () => createClient() as unknown as Built;

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

describe("createClient", () => {
  const original = { url: process.env[URL_VAR], key: process.env[KEY_VAR] };

  beforeEach(() => {
    delete process.env[URL_VAR];
    delete process.env[KEY_VAR];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (original.url === undefined) delete process.env[URL_VAR];
    else process.env[URL_VAR] = original.url;
    if (original.key === undefined) delete process.env[KEY_VAR];
    else process.env[KEY_VAR] = original.key;
  });

  // The whole reason this file exists: prerendering a page whose render body
  // calls createClient() must not fail a build that has no secrets.
  describe("on the server, with no env (the build sandbox)", () => {
    it("does not throw", () => {
      expect(() => build()).not.toThrow();
    });

    it("hands back an unroutable placeholder, never a real host", () => {
      const client = build();
      expect(client.url).toBe("http://127.0.0.1:1");
      expect(client.key).toBe("prerender-placeholder-anon-key");
    });
  });

  // usePublishLiveSubscription catches this throw to skip realtime instead of
  // crashing the page. If this test ever goes green-by-deletion, that hook
  // starts opening channels against a client that cannot connect.
  describe("in the browser, with no env", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {});
    });

    it("still throws, so callers can bail on missing config", () => {
      expect(() => build()).toThrow(/Missing Supabase environment variables/);
    });
  });

  // The safety property: a configured environment behaves exactly as before,
  // and the placeholder is unreachable in it — on either side of the wire.
  describe("with env configured", () => {
    beforeEach(() => {
      process.env[URL_VAR] = "https://real-project.supabase.co";
      process.env[KEY_VAR] = "real-anon-key";
    });

    it("uses the real credentials on the server", () => {
      const client = build();
      expect(client.url).toBe("https://real-project.supabase.co");
      expect(client.key).toBe("real-anon-key");
    });

    it("uses the real credentials in the browser", () => {
      vi.stubGlobal("window", {});
      const client = build();
      expect(client.url).toBe("https://real-project.supabase.co");
      expect(client.key).toBe("real-anon-key");
    });

    it("still throws in the browser when only one of the two is set", () => {
      // Half-configured is still misconfigured: the browser must hear about it.
      vi.stubGlobal("window", {});
      delete process.env[KEY_VAR];
      expect(() => build()).toThrow(/Missing Supabase environment variables/);
    });
  });
});
