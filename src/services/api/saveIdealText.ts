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
  | { kind: "saved"; text: string | null; version: number | null }
  /** The BE has not shipped the save lane yet (404) — the caller keeps
   *  today's behavior instead of surfacing an error. */
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
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return {
    kind: "saved",
    text: typeof body?.text === "string" ? body.text : null,
    version:
      typeof body?.version === "number" && Number.isFinite(body.version)
        ? body.version
        : null,
  };
}
