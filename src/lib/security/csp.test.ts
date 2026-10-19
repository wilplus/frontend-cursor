/*
 * STORY    As an operator, I want the CSP to allow what pages need while
 *          scripts stay nonce-only, so that the site neither breaks nor opens
 *          to XSS.
 * OUTCOME
 *   O1  script-src is nonce + self, never 'unsafe-inline'.
 *   O2  style-src still allows runtime-injected <style> blocks, and no
 *       stricter style-src-elem overrides it.
 * PROVES   O1 -> "keeps scripts on the nonce and never opens them to 'unsafe-inline'"
 *          O2 -> "still allows the styles a dependency injects at runtime"
 * WHY      2026-08-04 outage: #242's `style-src-elem 'self'` took every route down on Safari.
 */
import { describe, expect, it } from "vitest";

import { getCspDirectives } from "@/middleware";

/** Pull one directive's source list out of the policy string. */
function directive(csp: string, name: string): string | null {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ?? null;
}

describe("the content security policy", () => {
  const csp = getCspDirectives("test-nonce");

  it("keeps scripts on the nonce and never opens them to 'unsafe-inline'", () => {
    const script = directive(csp, "script-src")!;
    expect(script).toContain("'nonce-test-nonce'");
    expect(script).toContain("'self'");
    // Script is the XSS vector the policy exists to close. Nothing in this
    // file's rollback is allowed to loosen it.
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("still allows the styles a dependency injects at runtime", () => {
    // sonner writes its stylesheet into a <style> element on first mount.
    const style = directive(csp, "style-src")!;
    expect(style).toContain("'self'");
    expect(style).toContain("'unsafe-inline'");
    const elem = directive(csp, "style-src-elem");
    if (elem) expect(elem).toContain("'unsafe-inline'");
  });
});
