import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  mergeSession — claim + send a guest Lab session (§3.4/§3.5, BE A3)         */
/*                                                                            */
/*  POST /api/v2/auth/merge-session { anonymous_session_id }. One endpoint for  */
/*  both paths: signed-in calls it directly (instant claim+send); unsigned      */
/*  OAuths first, then calls it on the callback. Confirmation ONLY on send      */
/*  success (§3.6) — `sent` is returned only on a 2xx that reports the flip.    */
/* -------------------------------------------------------------------------- */

export type MergeSessionResult =
  | { kind: "sent"; state: string } // review_pending
  | { kind: "unauthenticated" } // 401 — sign in (OAuth) first
  | { kind: "error"; status: number; message: string };

export async function mergeSession(
  anonymousSessionId: string
): Promise<MergeSessionResult> {
  const token = await getAuthToken();
  if (!token) return { kind: "unauthenticated" };

  let res: Response;
  try {
    res = await fetch("/api/v2/auth/merge-session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ anonymous_session_id: anonymousSessionId }),
      credentials: "include",
    });
  } catch {
    return {
      kind: "error",
      status: 0,
      message: "Couldn't reach the server — your recording is held; try again.",
    };
  }

  if (res.status === 401) return { kind: "unauthenticated" };

  const body = (await res.json().catch(() => null)) as
    | { state?: string; error?: string }
    | null;

  if (!res.ok) {
    // 500 SEND_FAILED etc. — the send is idempotent, so a retry is safe (§3.6).
    return {
      kind: "error",
      status: res.status,
      message: body?.error ?? `Send failed (HTTP ${res.status}).`,
    };
  }
  return { kind: "sent", state: body?.state ?? "review_pending" };
}
