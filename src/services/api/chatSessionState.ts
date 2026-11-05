import { bffFetch } from "@/lib/api/bffFetch";

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
  // @optional_auth: an anonymous read is valid (the answer is NO_SESSION).
  // A read that hangs ends as a failed one (null: the Lounge, as on any
  // failure), never as a chat that does not open.
  const result = await bffFetch("/api/v2/chat/session-state", {
    auth: "optional",
    cache: "no-store",
    timeoutMs: 10_000,
  });
  if (result.kind !== "response" || !result.ok) return null;
  const body = result.body as Record<string, unknown> | null;
  const v = body?.state;
  if (v === "NO_SESSION" || v === "PENDING_COACH" || v === "REVIEW_LOOP")
    return v;
  return null;
}
