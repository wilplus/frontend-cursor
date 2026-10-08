/* -------------------------------------------------------------------------- */
/*  The coach's reads, with the session's Bearer token (founder 2026-10-08,  */
/*  coach-panel waiting time C3).                                             */
/*                                                                            */
/*  A coach GET that carries only the cookie makes the BFF's getAccessToken   */
/*  (app/api/_lib/backend.ts) validate the cookie with supabase.auth.getUser, */
/*  one more network call before every read. A request that carries          */
/*  `Authorization: Bearer …` skips it: the header wins there. So every coach */
/*  read attaches the token the way saveStateRating does, and keeps the       */
/*  cookie (credentials: "include") so nothing changes without a token.      */
/* -------------------------------------------------------------------------- */

import { getAuthToken } from "@/lib/api/auth-client";

/** The init of a coach GET: the cookie as before, plus the Bearer token when
 *  the browser has a session. No token: exactly today's init. */
export async function coachReadInit(): Promise<RequestInit> {
  const token = await getAuthToken();
  return {
    credentials: "include",
    cache: "no-store",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  };
}
