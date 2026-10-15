import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  The session's Bearer token on a BFF call (founder 2026-10-14, speed plan). */
/*                                                                            */
/*  A call that carries only the cookie makes the BFF validate it with        */
/*  supabase.auth.getUser, a network round trip to the auth server before     */
/*  every request (app/api/_lib/backend.ts getAccessToken). A call that       */
/*  carries `Authorization: Bearer …` skips it; the backend still verifies    */
/*  the token itself. The cookie keeps going, so nothing changes without a    */
/*  session. An Authorization header the caller set already is kept.          */
/* -------------------------------------------------------------------------- */

export async function withSessionBearer(init: RequestInit = {}): Promise<RequestInit> {
  const token = await getAuthToken();
  if (!token) return init;
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}
