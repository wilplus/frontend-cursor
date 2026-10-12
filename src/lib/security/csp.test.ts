/* -------------------------------------------------------------------------- */
/*  The CSP, held (2026-08-04)                                                 */
/*                                                                            */
/*  This policy is the one piece of middleware that can take every route down  */
/*  at once, and on 2026-08-04 it did: #242 tightened style-src into           */
/*  `style-src-elem 'self'`, Safari refused a stylesheet a DEPENDENCY injects   */
/*  at runtime, webpack's chunk load rejected with it, and every route showed   */
/*  "Something went wrong".                                                    */
/*                                                                            */
/*  What made it slip through was the shape of the verification: the rendered   */
/*  HTML really does ship zero <style> tags, so inspecting pages could not      */
/*  have caught it. The block only exists after a component mounts.            */
/*                                                                            */
/*  So these tests assert the POLICY, not the markup. They are deliberately     */
/*  about what must remain ALLOWED — a CSP fails closed, and every failure      */
/*  here is something a user cannot load.                                      */
/* -------------------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------------- */
  /*  The parts that must not regress while fixing the above                 */
  /* ---------------------------------------------------------------------- */

  it("keeps scripts on the nonce and never opens them to 'unsafe-inline'", () => {
    const script = directive(csp, "script-src")!;
    expect(script).toContain("'nonce-test-nonce'");
    expect(script).toContain("'self'");
    // Script is the XSS vector the policy exists to close. Nothing in this
    // file's rollback is allowed to loosen it.
    expect(script).not.toContain("'unsafe-inline'");
  });
});
