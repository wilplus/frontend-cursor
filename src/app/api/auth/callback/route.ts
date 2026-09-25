import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy OAuth callback — forwards to the real one.
 *
 * WHY THIS FILE STILL EXISTS. Nothing in the app points here: both
 * `LinkedInAuthButton` and `GoogleAuthButton` send the provider to
 * `/auth/callback`. But Next.js serves every route file, so this path stayed
 * reachable — and if a Supabase redirect-URL allow-list entry, a bookmark, or
 * an installed PWA still holds the old URL, an OAuth code can land here.
 *
 * WHAT IT USED TO DO, AND WHY THAT WAS WORSE THAN A 404. It ran the exchange
 * itself, using the legacy `get`/`set`/`remove` cookie triplet and discarding
 * the result:
 *
 *     await supabase.auth.exchangeCodeForSession(code);   // no error check
 *     return response;                                     // → /dashboard
 *
 * Both halves are failure modes `/auth/callback` was rewritten to escape, and
 * its comments name them: the legacy triplet cannot read Supabase's chunked
 * PKCE cookies (`sb-*-auth-token-code-verifier.0`, `.1`, …), which produced
 * "code verifier should be non-empty" right after LinkedIn returned the code;
 * and the server-side exchange returned `{session: null, error: null}` on
 * Vercel, setting no auth cookie at all.
 *
 * With the result thrown away, both failures were SILENT. The user was
 * redirected to `/dashboard` looking signed in and holding no session — which
 * reads, from the outside, exactly like "login broke again" with nothing in
 * the console to show for it.
 *
 * WHY FORWARD RATHER THAN DELETE. Deleting would turn a silent failure into a
 * 404 — louder, but it would hard-break sign-in for anyone whose configured
 * redirect still points here, and that allow-list is not readable from the
 * codebase. Forwarding is strictly better than both: if nothing uses this
 * path, nothing changes; if something does, it now works instead of failing
 * quietly.
 *
 * Every query parameter is preserved, because the code, the PKCE state and
 * `next` all have to survive the hop. The hash cannot be forwarded by a
 * server redirect, but the recovery flow that uses hash fragments never
 * targets this path.
 */
export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = new URL("/auth/callback", req.url);
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return NextResponse.redirect(target);
}
