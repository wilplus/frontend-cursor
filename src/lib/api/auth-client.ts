import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  THE PASS, AND WHAT HAPPENS WHEN IT RUNS OUT MID-PAGE (#422).              */
/*                                                                            */
/*  A Supabase access token lives about an hour. The Ideal Text screen is the  */
/*  longest-lived page in the product: record → wait → read → answer → record  */
/*  again is all ONE page, and it can run for hours without a navigation. So   */
/*  the token expiring while the screen is open is the normal case, not the    */
/*  edge case.                                                                */
/*                                                                            */
/*  Nothing used to recover from it. `getSession()` renews an expired session  */
/*  by itself, but when that renewal FAILS it returns null — and every caller  */
/*  read null as "signed out", omitted the header and sent the request anyway. */
/*  The BFF then answered 401 without ever reaching the backend, or forwarded  */
/*  a spent token for Flask to reject. Either way the reader mapped it through */
/*  `if (!response.ok) return { kind: "error" }` and the student was told      */
/*  "Couldn't load your ideal text. Try again in a moment." Trying again could */
/*  not help: nothing in the page could renew the pass. Only a full reload     */
/*  worked, and nothing on screen said so.                                     */
/*                                                                            */
/*  The middleware is not the place to fix it. It renews the cookie session on */
/*  NAVIGATION and deliberately steps aside for `/api/*` — adding an auth      */
/*  round trip to every data fetch would be a real cost — and this screen      */
/*  never navigates. So renewal has to live with the request: see              */
/*  `authedFetch` in ./authed-fetch.                                           */
/* -------------------------------------------------------------------------- */

/** The one renewal in flight, shared by every caller that asks during it.
 *
 *  A page that 401s does it to a DOZEN requests at once (the Ideal Text screen
 *  loads core, roots and enrichment together, then polls). Without this they
 *  would each start their own refresh against the same rotating refresh token.
 *  Cleared as soon as the refresh settles, so a later 401 gets a fresh attempt
 *  rather than a memoised stale answer.
 */
let renewal: Promise<string | null> | null = null;

/**
 * Get the current authenticated user's access token.
 * Used for passing auth to API routes that need to proxy to backend.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    if (token) return token;
    // getSession() already renews an expired session; reaching here means it
    // had nothing to renew OR the renewal failed. One explicit attempt costs a
    // single request and is the difference between a recoverable blip and a
    // screen that reports the document as gone.
    return await renewAuthToken();
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}

/** Force a new access token, sharing one refresh across concurrent callers.
 *
 *  Returns null when the session really is over — the caller should then say
 *  "sign in", not "something went wrong". */
export async function renewAuthToken(): Promise<string | null> {
  if (renewal) return renewal;
  renewal = (async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.refreshSession();
      return session?.access_token || null;
    } catch (error) {
      console.error("Failed to renew auth token:", error);
      return null;
    } finally {
      renewal = null;
    }
  })();
  return renewal;
}
