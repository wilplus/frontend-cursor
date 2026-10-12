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
  });
});
