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

/** What a coach call got back. status 0: nothing answered. `data` is the
 *  parsed body, or null when there was none or it did not parse. */
export interface CoachAnswer {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

async function answerOf(call: Promise<Response>): Promise<CoachAnswer> {
  try {
    const res = await call;
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** A coach GET, with coachReadInit's cookie and token. */
export async function coachRead(path: string): Promise<CoachAnswer> {
  return answerOf(coachReadInit().then((init) => fetch(path, init)));
}

/** A coach write on the session cookie: a FormData upload as is, anything
 *  else as JSON. */
export function coachWrite(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<CoachAnswer> {
  return answerOf(
    fetch(
      path,
      body instanceof FormData
        ? { method, credentials: "include", body }
        : {
            method,
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    ),
  );
}
