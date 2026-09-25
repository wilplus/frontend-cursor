/* -------------------------------------------------------------------------- */
/*  An OAuth return that landed on the wrong page (2026-09-25).                */
/*                                                                            */
/*  When Supabase does not accept the `redirectTo` a sign-in asked for (the    */
/*  redirect-URL allow-list is strict about host — www vs apex — and, in some  */
/*  project configurations, about query strings), it does not fail: it sends   */
/*  the provider's answer to the project's Site URL instead. That is `/`.      */
/*                                                                            */
/*  `/` is the public landing and knows nothing about `?code=`, so a LinkedIn  */
/*  sign-up "worked" at LinkedIn and then quietly left the person signed out   */
/*  on the landing (or on /chat after it). Middleware already rescued exactly  */
/*  this for /dashboard; this widens the rescue to every page Supabase might   */
/*  fall back to, and routes the provider's own error there too, so a refusal  */
/*  shows on /login instead of vanishing.                                      */
/* -------------------------------------------------------------------------- */

/** Pages a Supabase Site-URL fallback can land on. Never /auth/callback
 *  itself (that is the destination) and never a page that owns a `code`
 *  param of its own. */
const LANDING_PATHS = new Set(["/", "/chat", "/dashboard"]);

/** Where to send this request instead, or null to leave it alone.
 *
 *  Forwarded: `code` (the OAuth / PKCE answer), `type=recovery` (a password
 *  reset), and `error` only when Supabase's `error_description` rides with it
 *  — a bare `?error=` on the landing is not an auth answer and stays put. */
export function strayAuthCallbackUrl(requestUrl: string): URL | null {
  const url = new URL(requestUrl);
  if (!LANDING_PATHS.has(url.pathname)) return null;
  const params = url.searchParams;
  const isAuthReturn =
    params.has("code") ||
    params.get("type") === "recovery" ||
    (params.has("error") && params.has("error_description"));
  if (!isAuthReturn) return null;
  const target = new URL("/auth/callback", requestUrl);
  params.forEach((value, key) => target.searchParams.set(key, value));
  return target;
}
