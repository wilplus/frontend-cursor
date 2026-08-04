import { createBrowserClient } from "@supabase/ssr";

/* -------------------------------------------------------------------------- */
/*  The browser Supabase client.                                              */
/*                                                                            */
/*  Missing env is still a hard error IN THE BROWSER, and that is deliberate:  */
/*  callers depend on the throw. usePublishLiveSubscription catches it to skip */
/*  realtime entirely rather than crash the page when a dev has no            */
/*  .env.local — so silencing it everywhere would leave that hook opening a    */
/*  channel against a client that cannot work.                                */
/*                                                                            */
/*  On the SERVER it is not an error, and that asymmetry is the whole point.   */
/*  Six client components call createClient() in their render body, which also */
/*  runs while Next prerenders them at build time. Throwing there failed the   */
/*  entire build on any machine without secrets (a fresh clone, a CI sandbox)  */
/*  even though nothing on the server ever USES this client: every real call   */
/*  sits in an effect, an event handler or an async action, none of which run  */
/*  during prerender. So the server gets an inert placeholder it never         */
/*  touches, and the build stops requiring a secret it never reads.            */
/*                                                                            */
/*  This does not hide a misconfigured deploy. NEXT_PUBLIC_* values are        */
/*  inlined into the client bundle at build time, so a build without them      */
/*  still ships a browser bundle that throws on the first render needing       */
/*  auth — loudly, and now inside an error boundary rather than onto a white   */
/*  screen.                                                                   */
/* -------------------------------------------------------------------------- */

/** Unroutable on purpose: syntactically valid so the constructor itself cannot
 *  throw, but pointing nowhere, so a server-side call that was never supposed
 *  to happen fails as a connection error instead of quietly reaching a real
 *  host. */
const PRERENDER_PLACEHOLDER_URL = "http://127.0.0.1:1";
const PRERENDER_PLACEHOLDER_KEY = "prerender-placeholder-anon-key";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === "undefined") {
      return createBrowserClient(
        PRERENDER_PLACEHOLDER_URL,
        PRERENDER_PLACEHOLDER_KEY
      );
    }

    throw new Error(
      "Missing Supabase environment variables. Please check your .env.local file."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
