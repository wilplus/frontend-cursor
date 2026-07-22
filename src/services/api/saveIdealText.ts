import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  saveIdealText — MASTER DOCUMENT, "Save the ideal text" (BE-3, founder      */
/*  2026-07-22).                                                              */
/*                                                                            */
/*  Save is ACCEPT-AND-FREEZE, not a second copy: it resolves the pending     */
/*  state (anything the student left unactioned is dismissed-and-remembered), */
/*  stamps the saved version and writes the frozen snapshot. There is exactly */
/*  ONE source of truth afterwards — the master, with no offers outstanding.  */
/*                                                                            */
/*  Saving is also the gate for the re-read: you read aloud what you have     */
/*  settled on, never a script still carrying open suggestions.               */
/* -------------------------------------------------------------------------- */

export type SaveIdealTextResult =
  | { kind: "saved"; version: number | null }
  /** 409 NOTHING_TO_SAVE — the document has nothing pending to freeze (it is
   *  already settled). NOT an error: the state the student wanted is the
   *  state they have, so the caller just refetches. */
  | { kind: "nothing" }
  /** The BE has not shipped the save lane yet, or the master flag is off
   *  (404) — the caller keeps today's behavior instead of surfacing an
   *  error the student cannot act on. */
  | { kind: "unavailable" }
  | { kind: "error" };

export async function saveIdealText(
  arcId: string
): Promise<SaveIdealTextResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/save`,
      { method: "POST", headers, credentials: "include" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "unavailable" };
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (res.status === 409) {
    // The BE distinguishes "nothing to save" from a real failure; only the
    // former is benign.
    return body?.code === "NOTHING_TO_SAVE"
      ? { kind: "nothing" }
      : { kind: "error" };
  }
  if (!res.ok) return { kind: "error" };
  // The BE returns {saved, arc_id, saved_version} — no text (the caller
  // refetches the document, which is the single source of truth).
  const v = body?.saved_version ?? body?.version;
  return {
    kind: "saved",
    version: typeof v === "number" && Number.isFinite(v) ? v : null,
  };
}
