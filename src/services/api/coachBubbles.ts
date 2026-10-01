/* -------------------------------------------------------------------------- */
/*  Phase 0c · a student's new Take as a bubble in the coach's Lounge chat     */
/*  (founder 2026-10-01, A2). One read, dark on the backend (404) until       */
/*  COACH_TAKE_BUBBLES_ENABLED: it answers null then and the Lounge draws    */
/*  exactly as before. A bubble is a Take this coach has not walked yet; the */
/*  student's real name rides only when the backend may send it (0b, A3).    */
/* -------------------------------------------------------------------------- */

export interface TakeBubble {
  sessionId: string;
  takeIndex: number | null;
  sentAt: string;
  pseudonym: string;
  name: string | null;
  waitingForText: boolean;
  firstSnippetId: string | null;
}

export function mapTakeBubbles(raw: unknown): TakeBubble[] {
  const list = (raw as { bubbles?: unknown } | null)?.bubbles;
  if (!Array.isArray(list)) return [];
  return list
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => ({
      sessionId: typeof b.session_id === "string" ? b.session_id : "",
      takeIndex: typeof b.take_index === "number" ? b.take_index : null,
      sentAt: typeof b.sent_at === "string" ? b.sent_at : "",
      pseudonym: typeof b.pseudonym === "string" ? b.pseudonym : "",
      name: typeof b.name === "string" && b.name ? b.name : null,
      waitingForText: b.waiting_for_text === true,
      firstSnippetId: typeof b.first_snippet_id === "string" && b.first_snippet_id ? b.first_snippet_id : null,
    }))
    .filter((b) => b.sessionId);
}

/** null while dark or on any failure. */
export async function fetchTakeBubbles(): Promise<TakeBubble[] | null> {
  try {
    const res = await fetch("/api/v2/coach/take-bubbles", { credentials: "include", cache: "no-store" });
    if (res.status !== 200) return null;
    return mapTakeBubbles(await res.json().catch(() => null));
  } catch {
    return null;
  }
}
