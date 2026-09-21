import { getAuthToken, renewAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  A REQUEST THAT SURVIVES ITS OWN PASS EXPIRING (#422).                     */
/*                                                                            */
/*  Callers used to write this by hand, five lines at a time:                  */
/*                                                                            */
/*      const token = await getAuthToken();                                   */
/*      const headers = {};                                                   */
/*      if (token) headers.Authorization = `Bearer ${token}`;                  */
/*      await fetch(url, { headers, credentials: "include" });                 */
/*                                                                            */
/*  Two defects live in those lines. The header is omitted when the token is   */
/*  missing AND THE REQUEST IS SENT ANYWAY, burning a round trip to earn a     */
/*  401; and a 401 that comes back is indistinguishable, to every caller, from */
/*  a document that genuinely failed to load. Neither is visible at any one    */
/*  call site, which is why the pattern spread to 75 of them.                  */
/*                                                                            */
/*  Separate module from `auth-client` on purpose: `authedFetch` has to be     */
/*  able to ask for a token through a seam a test can replace. A call made     */
/*  inside auth-client's own module scope would bypass any mock of its         */
/*  exports, so the renew-and-retry behaviour could not be tested at all.      */
/* -------------------------------------------------------------------------- */

/** A request body is only replayable if sending it twice sends the same bytes.
 *
 *  A string or no body at all re-sends cleanly. A stream is consumed by the
 *  first attempt and would retry as an empty body — worse than the 401 — so
 *  those keep the original response. */
function isReplayable(body: BodyInit | null | undefined): boolean {
  return body == null || typeof body === "string";
}

/**
 * Fetch that renews the pass once and asks again, instead of surfacing a 401.
 *
 * WHY RETRYING A 401 IS SAFE, INCLUDING FOR A PUT OR POST. Both places that
 * can answer 401 do so BEFORE anything runs. The BFF's `callBackend` returns
 * its 401 before it forwards to the backend at all, and Flask's `require_auth`
 * returns before the route function is entered. A 401 therefore never means
 * "it half happened" — nothing was read, written or charged — which is exactly
 * what a blind retry needs to be true.
 *
 * The retry is capped at ONE and is skipped unless the renewal produced a
 * genuinely DIFFERENT token: re-sending the same spent pass can only earn the
 * same 401, and a loop over a dead session is how a page hangs instead of
 * telling the truth. When the retry also 401s, the first response is returned
 * and the caller surfaces it — by then "sign in again" is a fact, not a guess.
 *
 * `credentials` and `cache` default to what every call site already passed,
 * and `init` overrides them.
 */
export async function authedFetch(
  url: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const { headers: extraHeaders, ...rest } = init;
  const send = (token: string | null) =>
    fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...rest,
      headers: {
        ...(extraHeaders ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const token = await getAuthToken();
  const first = await send(token);
  if (first.status !== 401 || !isReplayable(rest.body)) return first;

  const renewed = await renewAuthToken();
  if (!renewed || renewed === token) return first;
  return send(renewed);
}
