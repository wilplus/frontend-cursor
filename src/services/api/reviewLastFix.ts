import { bffFetch } from "@/lib/api/bffFetch";
import type { WalkClip } from "@/lib/willab/feedbackWalkModel";

/** The previous Take's fix when it rose on this Take (backend N309 item 1,
 *  `take_progress.last_fix`): what kind of fix it was (the pace game's
 *  "tempo" too, N347 item 3) and this Take's clip on that slide. Never a
 *  number (Never 1). */
export type LastFix = {
  kind: "voice" | "clearer" | "tempo";
  clip: WalkClip;
  /** The tip the last walk gave, kept with its fix step in the chat
   *  (`fix_tip`), as the server reads it (C-LASTFIX: `tip` beside `last`);
   *  absent: the walk looks it up in the chat's loaded messages. */
  tip?: string | null;
};

const KINDS: ReadonlySet<unknown> = new Set(["voice", "clearer", "tempo"]);

/** Null when the last Take's fix did not rise, there is none, and on any
 *  failure: the walk then opens without "Last time". */
export async function fetchLastFix(arcId: string, takeId: string): Promise<LastFix | null> {
  try {
    const result = await bffFetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/review/last-fix/${encodeURIComponent(takeId)}`,
      { cache: "no-store" },
    );
    if (result.kind !== "response" || !result.ok) return null;
    const body = result.body as { last?: unknown; tip?: unknown } | null;
    return readLastFix(body?.last, body?.tip);
  } catch {
    return null;
  }
}

/** The backend's answer, when it is whole, with the tip served beside it
 *  (null when unknown). Pure. */
export function readLastFix(raw: unknown, served?: unknown): LastFix | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: unknown; clip?: unknown };
  const tip = typeof served === "string" && served.trim() ? served : null;
  const clip = (r.clip ?? {}) as { url?: unknown; start_offset_ms?: unknown; duration_ms?: unknown; snippet_id?: unknown };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (!KINDS.has(r.kind) || typeof clip.url !== "string" || !clip.url) return null;
  return {
    kind: r.kind as LastFix["kind"],
    clip: {
      src: clip.url,
      startOffsetMs: num(clip.start_offset_ms),
      durationMs: num(clip.duration_ms),
      snippetId: typeof clip.snippet_id === "string" ? clip.snippet_id : null,
    },
    ...(tip ? { tip } : {}),
  };
}
