import { getAuthToken } from "@/lib/api/auth-client";
import {
  mapReadoutSlide,
  type CoachTag,
  type ReadoutSlide,
} from "@/components/willab/readout";

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
  /** §7b — the slide on screen during this moment (BE-mapped from the tap
   *  timeline, same as the readout). null = no deck → the moment lives under
   *  "General strengths" instead of a per-slide group. */
  slide: ReadoutSlide | null;
  /** The session's served deck PDF, to render the slide page. null = no deck. */
  presentationRef: string | null;
  /** Rank among strong moments (1 = best, ascending); null = unranked. Orders
   *  the best moments within a slide. */
  rank: number | null;
  /** The training's topic — labels each slide-based training group. */
  sessionTopic: string;
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
    slide: mapReadoutSlide(r.slide),
    presentationRef:
      typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
        ? r.presentation_ref
        : null,
    rank: typeof r.rank === "number" && Number.isFinite(r.rank) ? r.rank : null,
    sessionTopic:
      typeof r.session_topic === "string"
        ? r.session_topic
        : typeof r.topic === "string"
        ? r.topic
        : "",
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

/* ----------------------- strong-sides slide grouping ---------------------- */

export interface StrongSlideGroup {
  /** The slide these moments were delivered on. */
  slide: ReadoutSlide;
  /** Top-N strong moments on this slide, best (lowest rank) first. */
  moments: LibraryEntry[];
}

export interface StrongTraining {
  sessionId: string;
  topic: string;
  presentationRef: string | null;
  /** Slides that had ≥1 strong moment, in deck order. */
  slides: StrongSlideGroup[];
}

export interface StrongSidesView {
  /** Strong moments with no slide (no-deck trainings) — the flat General list. */
  general: LibraryEntry[];
  /** Slide-based trainings, most recent first. */
  trainings: StrongTraining[];
}

/**
 * Shape the strong-sides library into the slide-grouped view (§7b): a flat
 * "General strengths" list of no-slide moments, then one group per slide-based
 * training (most recent first), each slide (in deck order) carrying its top
 * `perSlide` moments sorted by rank. Degrades cleanly — with no slide data
 * every strong moment is "general", i.e. today's flat list.
 */
export function groupStrongSides(
  entries: LibraryEntry[],
  perSlide = 3
): StrongSidesView {
  const strong = entries.filter((e) => e.tag === "strong");
  const general = strong.filter((e) => e.slide === null);
  const slided = strong.filter((e) => e.slide !== null);

  const bySession = new Map<string, LibraryEntry[]>();
  for (const e of slided) {
    const arr = bySession.get(e.sessionId);
    if (arr) arr.push(e);
    else bySession.set(e.sessionId, [e]);
  }

  const ranked = [...bySession.entries()].map(([sessionId, list]) => {
    const bySlide = new Map<number, LibraryEntry[]>();
    for (const e of list) {
      const idx = (e.slide as ReadoutSlide).index;
      const arr = bySlide.get(idx);
      if (arr) arr.push(e);
      else bySlide.set(idx, [e]);
    }
    const slides: StrongSlideGroup[] = [...bySlide.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, arr]) => ({
        slide: arr[0].slide as ReadoutSlide,
        moments: arr
          .slice()
          .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
          .slice(0, perSlide),
      }));
    const latestAt = list.map((e) => e.createdAt).sort().pop() ?? "";
    const training: StrongTraining = {
      sessionId,
      topic: list[0].sessionTopic,
      presentationRef: list[0].presentationRef,
      slides,
    };
    return { training, latestAt };
  });

  ranked.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  return { general, trainings: ranked.map((r) => r.training) };
}
