import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  chatSessionState — seam 8 client fetcher                                  */
/*                                                                            */
/*  GET /api/v2/chat/session-state → { state: SessionStateValue }            */
/*  @optional_auth — works for anonymous users (returns NO_SESSION).          */
/*  The FE maps the result to WillabState in useWillabFlow.                   */
/* -------------------------------------------------------------------------- */

export type SessionStateValue =
  | "NO_SESSION"
  | "PENDING_COACH"
  | "REVIEW_LOOP";

export async function fetchSessionState(): Promise<SessionStateValue | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch("/api/v2/chat/session-state", {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const v = body?.state;
    if (v === "NO_SESSION" || v === "PENDING_COACH" || v === "REVIEW_LOOP")
      return v;
    return null;
  } catch {
    return null;
  }
}
