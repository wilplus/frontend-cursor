import { getAuthToken } from "@/lib/api/auth-client";
import type { CoachTag } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  library — the strong-sides library (§7 / §3.11)                           */
/*                                                                            */
/*  GET /api/v2/user/library?tag= → { entries:[{id, session_id, snippet_id,    */
/*  note, tag, snippet_ref, created_at}], count }. The coach's curated notes —  */
/*  read-only replay, never profiling. `note` + `tag` are the renderable core.  */
/*                                                                            */
/*  FE-6 / T7: `snippet_ref` shape is confirmed (BE Batch 2, live on prod) —    */
/*  it carries audio_ref + start_offset_ms + duration_ms + transcript, so each  */
/*  entry now renders the PLAYABLE CLIP behind the coach's note (the user can   */
/*  hear the exact moment the note refers to). Parent-audio + offset-window     */
/*  model, same as the Readout snippet player.                                  */
/* -------------------------------------------------------------------------- */

/** The playable clip behind a library entry (§3.11 snippet_ref). Parent
 *  recording audio + the offset window the MediaPlayer trims to. */
export interface LibrarySnippetRef {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
}

export interface LibraryEntry {
  id: string;
  sessionId: string;
  snippetId: string;
  note: string;
  tag: CoachTag | null;
  createdAt: string;
  /** Playable clip for this note (T7). null when the BE row carries no
   *  snippet_ref (older entries, or a note with no resolvable audio). */
  snippet: LibrarySnippetRef | null;
}

function mapSnippetRef(raw: unknown): LibrarySnippetRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    audioRef: typeof r.audio_ref === "string" ? r.audio_ref : null,
    startOffsetMs: typeof r.start_offset_ms === "number" ? r.start_offset_ms : 0,
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : 0,
    transcript: typeof r.transcript === "string" ? r.transcript : "",
  };
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
    snippet: mapSnippetRef(r.snippet_ref),
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
