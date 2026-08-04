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
  /*  Realtime — the wss:// half of Supabase                                 */
  /* ---------------------------------------------------------------------- */

  it("authorises the Supabase realtime WebSocket, not just its https origin", () => {
    const connect = directive(csp, "connect-src")!;
    expect(connect).toContain("https://*.supabase.co");
    // The bug: `https://host` does NOT authorise `wss://host`. CSP scheme
    // matching treats them as different schemes, so listing the https origin
    // alone left Safari refusing the socket with "The operation is insecure"
    // while Chrome allowed it and hid the fault.
    expect(connect).toContain("wss://*.supabase.co");
  });

  /* ---------------------------------------------------------------------- */
  /*  style-src — the directive that caused the outage                       */
  /* ---------------------------------------------------------------------- */

  it("still allows the inline <style> blocks dependencies inject at runtime", () => {
    // `sonner` writes its stylesheet into a <style> element on first mount.
    // Nothing in our markup or our source names it, which is exactly why
    // "the app ships zero <style> tags" was both true and misleading.
    const style = directive(csp, "style-src")!;
    expect(style).toContain("'unsafe-inline'");
  });

  it("does not carry a style-src-elem that would block those blocks again", () => {
    // Re-landing the hardening is fine, but only once the injected stylesheet
    // is accounted for (hashed, or pulled into the bundle). A bare
    // `style-src-elem 'self'` reintroduces the outage, because -elem OVERRIDES
    // the style-src fallback in browsers that understand it.
    const elem = directive(csp, "style-src-elem");
    if (elem !== null) {
      expect(elem).toContain("'unsafe-inline'");
    }
  });

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

  it("keeps the frame, object and base clamps", () => {
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("allows the service worker and the pdf.js worker", () => {
    expect(directive(csp, "worker-src")).toContain("'self'");
  });

  it("is a single well-formed header with no empty directives", () => {
    const parts = csp.split(";").map((d) => d.trim());
    expect(parts.every((p) => p.length > 0)).toBe(true);
    expect(csp).not.toContain(";;");
    expect(csp.trim().endsWith(";")).toBe(false);
  });
});
