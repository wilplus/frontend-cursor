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
