/* -------------------------------------------------------------------------- */
/*  Where the CMS password gate was interrupted.                              */
/*                                                                            */
/*  IN A MODULE OF ITS OWN, not in page.tsx: a Next.js page file may export    */
/*  only Next's own fields, and a stray named export fails `next build` with   */
/*  "not a valid Page export field" — which typecheck and the unit tier both   */
/*  let through, because neither runs the build.                              */
/* -------------------------------------------------------------------------- */

/** The authoring screen the CMS password gate interrupted, or null.
 *
 *  /cms/new bounces to /cms when the tab has no password, carrying where it
 *  was going. Without that the coach's "build an exercise for this moment"
 *  link died at the gate and they resumed at the Post-or-Exercise fork, two
 *  screens behind the record step they were sent to.
 *
 *  ONLY an authoring path is ever followed. The value arrives in a query
 *  parameter, so anything else — an absolute URL, a protocol-relative host, a
 *  path elsewhere in the app — is refused rather than navigated to, and the
 *  parameter cannot be turned into an open redirect. */
export function interruptedDestination(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/cms/new/") ? raw : null;
  } catch {
    return null;
  }
}

/** Where an authoring lane should return its author, or null.
 *
 *  The coach's review hands off with `?returnTo=/chat?review=…&piece=…` so the
 *  queue reopens on the exact piece. That parameter survived the trip in and
 *  was then thrown away at the end: publishing pushed `/cms` unconditionally,
 *  so a coach who came from a moment landed in the catalogue instead of back
 *  on it (founder 2026-09-24: "after publishing the video bring me back to the
 *  coach screen from where I was redirected to the CMS").
 *
 *  ONLY an in-app absolute path is ever followed. It arrives in a query
 *  parameter, so an absolute URL and a protocol-relative "//host" — which a
 *  browser would treat as another origin — are refused rather than navigated
 *  to. */
export function authoringReturnTo(search?: string): string | null {
  try {
    const raw = new URLSearchParams(
      search ?? window.location.search,
    ).get("returnTo");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  } catch {
    return null;
  }
}
