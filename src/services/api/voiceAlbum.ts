import { getAuthToken } from "@/lib/api/auth-client";

export interface VoiceAlbumEntry {
  projectId: string | null;
  snippetId: string;
  takeSessionId: string | null;
  takeIndex: number | null;
  slideIndex: number | null;
  enteredAt: string | null;
  text: string;
  audioUrl: string | null;
  startOffsetMs: number | null;
  durationMs: number | null;
}

export async function fetchVoiceAlbum(
  projectId?: string | null
): Promise<VoiceAlbumEntry[] | null> {
  const token = await getAuthToken();
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(
      projectId
        ? `/api/v2/explore/arc/${encodeURIComponent(projectId)}/voice-album`
        : "/api/v2/voice-album",
      {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).entries;
  if (!Array.isArray(raw)) return null;

  const entries: VoiceAlbumEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.snippet_id !== "string" || !row.snippet_id) continue;
    entries.push({
      projectId:
        typeof row.arc_id === "string"
          ? row.arc_id
          : projectId ?? null,
      snippetId: row.snippet_id,
      takeSessionId:
        typeof row.take_session_id === "string" ? row.take_session_id : null,
      takeIndex: typeof row.take_index === "number" ? row.take_index : null,
      slideIndex: typeof row.slide_index === "number" ? row.slide_index : null,
      enteredAt: typeof row.entered_at === "string" ? row.entered_at : null,
      text: typeof row.text === "string" ? row.text : "",
      audioUrl: typeof row.audio_url === "string" ? row.audio_url : null,
      startOffsetMs:
        typeof row.start_offset_ms === "number" ? row.start_offset_ms : null,
      durationMs:
        typeof row.duration_ms === "number" ? row.duration_ms : null,
    });
  }
  return entries;
}
