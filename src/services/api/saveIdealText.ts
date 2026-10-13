import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  saveIdealText — "Save the ideal text", the last item under ⋯. It stamps   */
/*  the version on screen as saved and changes no word (rule 5); the reads   */
/*  then serve `is_saved: true` for that version.                            */
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
  const res = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    auth: "optional",
  });
  if (res.kind !== "response") return { kind: "error" };
  if (res.status === 404) return { kind: "unavailable" };
  const body = res.body as Record<string, unknown> | null;
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
