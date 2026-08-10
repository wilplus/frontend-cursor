import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The pipeline admin panel's security claim, checked rather than trusted.
 *
 * The design decision (SPEC-pipeline-admin-panel §1, Option B) is that
 * PIPELINE_JOBS_SWEEP_SECRET is not merely kept out of the browser bundle —
 * it is never involved in the admin path at all, because the backend gates on
 * @require_admin and the BFF forwards only the user's JWT.
 *
 * A claim that strong is worth an assertion. If someone later "simplifies"
 * the panel by pointing it at /v2/internal/jobs/* and attaching the secret
 * server-side, these tests fail — and they fail on the FILE, before any
 * question of whether the bundler would have stripped it.
 */

const SRC = join(process.cwd(), "src");
const SECRET = "PIPELINE_JOBS_SWEEP_SECRET";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Source with comments removed.
 *
 * NOT a nicety — the first version of this file failed against its own
 * subject, because proxy.ts's header explains at length WHY the secret is not
 * carried, and naming a thing to forbid it is not using it. This repo has
 * shipped that same mistake several times: a text-matching fence tripped by
 * the comment written to justify it. Prose must stay free to name what code
 * may not touch.
 */
function codeOnly(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("pipeline admin — the sweep secret is never carried", () => {
  it("does not appear in any frontend CODE path", () => {
    const offenders = walk(SRC).filter((f) => {
      if (f.endsWith("pipelineAdmin.test.ts")) return false; // names it on purpose
      return codeOnly(f).includes(SECRET);
    });
    expect(
      offenders,
      `${SECRET} must never be referenced in frontend code — the admin path ` +
        `gates on @require_admin upstream and carries no secret. Found in:\n` +
        offenders.join("\n")
    ).toEqual([]);
  });

  it("the BFF proxy targets the admin routes, not the internal ones", () => {
    const code = codeOnly(join(SRC, "app/api/v2/admin/pipeline/proxy.ts"));
    expect(code).not.toContain("/v2/internal/");
    expect(code).not.toContain("X-Internal-Secret");
  });

  it("every pipeline BFF route goes through the shared proxy", () => {
    const base = join(SRC, "app/api/v2/admin/pipeline");
    for (const route of ["health", "jobs", "sweep"]) {
      const src = readFileSync(join(base, route, "route.ts"), "utf8");
      expect(src, `${route}/route.ts must use proxyPipeline`).toContain(
        "proxyPipeline"
      );
      // A route that builds its own fetch is a route that can grow its own
      // headers — including the one this whole design exists to avoid.
      expect(src).not.toContain("fetch(");
    }
  });

  it("forwards an allowlisted query string, not the raw search params", () => {
    const code = codeOnly(join(SRC, "app/api/v2/admin/pipeline/proxy.ts"));
    // Asserted POSITIVELY. The tempting negative — "must not contain
    // nextUrl.search" — is wrong: `nextUrl.searchParams` contains that exact
    // substring, so the check fails on the correct implementation. The real
    // invariant is that a fresh URLSearchParams is built from a named list.
    expect(code).toContain("new URLSearchParams()");
    for (const key of ["status", "limit", "before"]) {
      expect(code).toContain(`"${key}"`);
    }
    // Pasting the incoming query string wholesale would let a caller append
    // arbitrary params to an admin endpoint.
    expect(code).not.toContain("${req.nextUrl.search}");
  });
});
