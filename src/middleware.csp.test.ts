import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCspDirectives } from "./middleware";

/* -------------------------------------------------------------------------- */
/*  CSP regression guard.                                                      */
/*                                                                            */
/*  Bug #60: connect-src listed https://*.supabase.co but no wss: source, so   */
/*  the Supabase Realtime handshake was refused. realtime-js builds its socket  */
/*  synchronously inside .subscribe(), so the refusal threw out of a useEffect  */
/*  and the whole page fell to the error boundary. CSP matches on scheme —      */
/*  an https: source does NOT authorize wss: to the same host — so the          */
/*  websocket origins have to be listed in their own right.                     */
/* -------------------------------------------------------------------------- */

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ?? "";
}

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_API_URL"] as const;

describe("getCspDirectives", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("authorizes the Supabase Realtime websocket, not just https", () => {
    const connect = directive(getCspDirectives("abc123"), "connect-src");
    expect(connect).toContain("wss://*.supabase.co");
    expect(connect).toContain("wss://*.supabase.io");
    // The https sources must survive alongside them — REST/auth still ride those.
    expect(connect).toContain("https://*.supabase.co");
  });

  it("derives the wss origin from the configured project URL", () => {
    // A custom domain the *.supabase.co wildcard can never match: the derived
    // source is the only thing keeping Realtime alive on a self-hosted setup.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.willpowerlab.com";
    const connect = directive(getCspDirectives("abc123"), "connect-src");
    expect(connect).toContain("https://db.willpowerlab.com");
    expect(connect).toContain("wss://db.willpowerlab.com");
  });

  it("leaves connect-src free of a websocket source when no project URL is set", () => {
    const connect = directive(getCspDirectives("abc123"), "connect-src");
    expect(connect).not.toContain("wss://undefined");
  });

  it("keeps script-src nonce-based with no unsafe-inline", () => {
    const script = directive(getCspDirectives("abc123"), "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'self'");
    expect(script).not.toContain("'unsafe-inline'");
  });
});
