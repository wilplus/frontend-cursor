import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  THE SHELL CACHE IS VERSIONED BY THE BUILD, NOT BY HAND                     */
/*  (founder 2026-09-18, after "it holds on the desktop not on the phone")     */
/*                                                                            */
/*  `activate` deletes every cache whose name is not the current one, so the   */
/*  NAME is the only flush the service worker has. While it was a hand-bumped  */
/*  constant, a deploy that forgot to bump it left phones serving the previous */
/*  shell with nothing on screen to explain it.                               */
/*                                                                            */
/*  Asserted on the source of all three files, because the contract lives      */
/*  ACROSS them: the config produces the id, the registrar puts it in the URL, */
/*  and the worker reads it back. Any one of the three drifting breaks it      */
/*  silently, which is the failure mode being removed.                        */
/* -------------------------------------------------------------------------- */

const CONFIG = readFileSync("next.config.mjs", "utf8");
const REGISTRAR = readFileSync(
  "src/components/pwa/ServiceWorkerRegistrar.tsx",
  "utf8",
);
const WORKER = readFileSync("public/sw.js", "utf8");

/** Source with comments removed.
 *
 *  An assertion that a string is ABSENT has to read code only. The registrar's
 *  comment explains why it never emits `?v=undefined` — and a plain
 *  `not.toContain` on the whole file then fails on the sentence describing the
 *  guarantee it is checking. That is the third time this pattern has bitten in
 *  this repo; the fix is to strip the prose, not to reword it. */
const codeOf = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

describe("the build id reaches the cache name", () => {
  it("is produced by the config", () => {
    expect(CONFIG).toContain("NEXT_PUBLIC_BUILD_ID");
    expect(CONFIG).toContain("VERCEL_GIT_COMMIT_SHA");
  });

  it("is carried in the registration URL", () => {
    expect(REGISTRAR).toContain("process.env.NEXT_PUBLIC_BUILD_ID");
    expect(REGISTRAR).toContain("`/sw.js?v=${encodeURIComponent(build)}`");
  });

  it("is read back by the worker itself", () => {
    // One value, read from the worker's OWN location, so the registration and
    // the cache it empties cannot disagree.
    expect(WORKER).toContain('searchParams.get("v")');
    expect(WORKER).toContain("`willab-shell-${BUILD_ID}`");
  });
});

describe("what happens when there is no id", () => {
  it("registers the plain path rather than a literal undefined", () => {
    // "?v=undefined" is a hand-bumped constant wearing a query string — the
    // exact thing this removes — and it would be stable across every deploy.
    expect(REGISTRAR).toContain('build ? `/sw.js?v=');
    expect(REGISTRAR).toContain('/sw.js"');
    expect(codeOf(REGISTRAR)).not.toContain("?v=undefined");
  });

  it("falls back to a named constant in the worker", () => {
    expect(WORKER).toMatch(/BUILD_ID \? `willab-shell-\$\{BUILD_ID\}` : "willab-shell-v7"/);
  });

  it("never resolves the id to the string undefined in the config", () => {
    // A local `next build` has no commit sha. Without the fallback the id is
    // literally "undefined" — constant again, and silently so.
    expect(CONFIG).toMatch(/\|\|\s*`local-\$\{Date\.now\(\)\}`/);
  });
});

describe("the flush still works the way it always did", () => {
  it("keeps deleting every cache that is not the current one", () => {
    expect(WORKER).toContain("key !== CACHE_NAME");
    expect(WORKER).toContain("caches.delete(key)");
  });

  it("still takes over immediately", () => {
    // skipWaiting + clients.claim are what make a new worker apply to the page
    // already open, rather than the one after next.
    expect(WORKER).toContain("self.skipWaiting()");
    expect(WORKER).toContain("self.clients.claim()");
  });
});
