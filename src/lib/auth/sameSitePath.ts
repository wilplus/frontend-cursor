/** The page a sign-in link asks to come back to (`?redirectTo=`), when it is
 *  a path on this site; else null. The one rule for the login and sign-up
 *  forms, the OAuth start and the middleware, so a crafted link can never
 *  send a person to another website right after they sign in.
 *
 *  "Starts with one /" is not enough on its own: browsers read "\" as "/"
 *  and drop tabs and newlines, so "/\evil.com" and "/<tab>/evil.com" are both
 *  "//evil.com". The path is resolved the way the browser will resolve it and
 *  must stay on our origin. */
export function sameSitePath(back: string | null | undefined): string | null {
  if (!back || !back.startsWith("/") || back.startsWith("//")) return null;
  const origin = "https://same-site.invalid";
  try {
    return new URL(back, origin).origin === origin ? back : null;
  } catch {
    return null;
  }
}
