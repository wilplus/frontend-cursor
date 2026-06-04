import { getAuthToken } from "@/lib/api/auth-client";
import type { CoachTag } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  library — the strong-sides library (§7 / §3.11)                           */
/*                                                                            */
/*  GET /api/v2/user/library?tag= → { entries:[{id, session_id, snippet_id,    */
/*  note, tag, snippet_ref, created_at}], count }. The coach's curated notes —  */
/*  read-only replay, never profiling. `note` + `tag` are the renderable core;  */
/*  `snippet_ref` (audio) is carried but its shape isn't pinned yet, so the     */
/*  view shows the note/tag (a player can be added when that's confirmed).      */
/* -------------------------------------------------------------------------- */

export interface LibraryEntry {
  id: string;
  sessionId: string;
  snippetId: string;
  note: string;
  tag: CoachTag | null;
  createdAt: string;
}

export function mapLibraryEntry(raw: unknown): LibraryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  return {
    id: r.id,
    sessionId: typeof r.session_id === "string" ? r.session_id : "",
    snippetId: typeof r.snippet_id === "string" ? r.snippet_id : "",
    note: typeof r.note === "string" ? r.note : "",
    tag: r.tag === "strong" || r.tag === "to_work_on" ? (r.tag as CoachTag) : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
  };
}

export async function fetchLibrary(tag?: CoachTag): Promise<LibraryEntry[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const qs = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  let res: Response;
  try {
    res = await fetch(`/api/v2/user/library${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const body = (await res.json().catch(() => null)) as { entries?: unknown } | null;
  const rows = body && Array.isArray(body.entries) ? body.entries : [];
  return rows
    .map(mapLibraryEntry)
    .filter((e): e is LibraryEntry => e !== null);
}
