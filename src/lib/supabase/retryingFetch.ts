/* -------------------------------------------------------------------------- */
/*  One dropped connection must not cost a sign-in (2026-09-26).              */
/*                                                                            */
/*  Safari reuses keep-alive connections, and when the server has already     */
/*  closed one it fails the request with "The network connection was lost"   */
/*  (fetch rejects with `TypeError: Load failed`). For a navigation Safari    */
/*  quietly resends it — which is how one LinkedIn answer reached Supabase's  */
/*  callback twice ("State has already been used"). For a fetch POST it does  */
/*  not resend, and supabase-js then DELETES the PKCE code verifier on the    */
/*  way out, even though the failure was only the network. The sign-in is    */
/*  gone and the person sees "PKCE code verifier not found in storage".       */
/*                                                                            */
/*  So the one request that finishes an OAuth sign-in — POST                  */
/*  /auth/v1/token?grant_type=pkce — is resent when the network (not the      */
/*  server) failed it. The resend happens inside fetch, before supabase-js    */
/*  sees any error, so the verifier is still in storage. If the first attempt */
/*  did reach Supabase, the resend is refused as an already-used code: no     */
/*  worse than today. Every other request is passed through untouched.        */
/* -------------------------------------------------------------------------- */

const RETRY_DELAYS_MS = [300, 1000];

/** True for the PKCE code exchange — the only request this wrapper retries. */
export function isPkceTokenExchange(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "POST") return false;
  const raw = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(raw);
    return url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "pkce";
  } catch {
    return false;
  }
}

/** A fetch rejection is a network failure (never an HTTP status). */
function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError;
}

export function createRetryingFetch(
  baseFetch: typeof fetch = (...args) => fetch(...args),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): typeof fetch {
  return async (input, init) => {
    if (!isPkceTokenExchange(input, init)) return baseFetch(input, init);
    for (let attempt = 0; ; attempt++) {
      try {
        return await baseFetch(input, init);
      } catch (err) {
        if (!isNetworkFailure(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
        console.warn("[auth] code exchange lost the connection — retrying", attempt + 1);
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  };
}
