import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  The Voice Album read (founder 2026-09-18: "the voices should be stored by  */
/*  project").                                                                 */
/*                                                                            */
/*  Two shapes of the same rows come back. `projects` is what the screen       */
/*  scrolls — one group per project, its moments in PRESENTATION order — and   */
/*  `entries` is the older flat list, still parsed so a client that loads      */
/*  during a backend deploy keeps working.                                     */
/*                                                                            */
/*  The fragment's transcript is deliberately NOT read here. The moment is     */
/*  the recording; the words belong to the Ideal Text, and showing them beside */
/*  the player made the Album read like a transcript archive.                  */
/* -------------------------------------------------------------------------- */

export interface VoiceAlbumEntry {
  projectId: string | null;
  /** The Album's own moment identity: a snippet id, or `practice:<id>`. */
  momentKey: string;
  takeSessionId: string | null;
  takeIndex: number | null;
  slideIndex: number | null;
  enteredAt: string | null;
  audioUrl: string | null;
  startOffsetMs: number | null;
  durationMs: number | null;
}

export interface VoiceAlbumProject {
  projectId: string;
  title: string | null;
  entries: VoiceAlbumEntry[];
}

export interface MomentOrigin {
  takeIndex: number | null;
  slideIndex: number | null;
  at: string | null;
  source: "snippet" | "practice_attempt";
}

export interface ExerciseAttempt {
  attemptId: string;
  index: number | null;
  audioUrl: string | null;
  durationMs: number | null;
  kept: boolean;
}

export type MomentEvent =
  | { kind: "owner_answer"; who: string; at: string | null; response: string }
  | { kind: "coach_agreed"; who: string; at: string | null }
  | {
      kind: "exercise";
      at: string | null;
      title: string;
      instruction: string;
      videoUrl: string | null;
      attempts: ExerciseAttempt[];
    }
  | { kind: "note"; who: string; at: string | null; body: string; noteId: string | null };

export interface MomentHistory {
  momentKey: string;
  origin: MomentOrigin;
  events: MomentEvent[];
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(path, {
      method: "GET",
      headers: await authHeaders(),
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function mapEntry(raw: unknown, fallbackProjectId: string | null): VoiceAlbumEntry | null {
  const row = rec(raw);
  if (!row) return null;
  // The backend calls it snippet_id for both kinds, and already prefixes an
  // admitted practice attempt with `practice:`. That string IS the identity
  // the history and note endpoints take, so it travels unmodified.
  const momentKey = str(row.snippet_id);
  if (!momentKey) return null;
  return {
    projectId: str(row.arc_id) ?? fallbackProjectId,
    momentKey,
    takeSessionId: str(row.take_session_id),
    takeIndex: num(row.take_index),
    slideIndex: num(row.slide_index),
    enteredAt: str(row.entered_at),
    audioUrl: str(row.audio_url),
    startOffsetMs: num(row.start_offset_ms),
    durationMs: num(row.duration_ms),
  };
}

/** null = the read failed; [] = the Album is genuinely empty. */
export async function fetchVoiceAlbum(): Promise<VoiceAlbumProject[] | null> {
  const body = rec(await getJson("/api/v2/voice-album"));
  if (!body) return null;

  const grouped = body.projects;
  if (Array.isArray(grouped)) {
    const out: VoiceAlbumProject[] = [];
    for (const item of grouped) {
      const row = rec(item);
      const projectId = row ? str(row.arc_id) : null;
      if (!row || !projectId) continue;
      const entries: VoiceAlbumEntry[] = [];
      for (const rawEntry of Array.isArray(row.entries) ? row.entries : []) {
        const entry = mapEntry(rawEntry, projectId);
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) out.push({ projectId, title: str(row.title), entries });
    }
    return out;
  }

  // Older backend: regroup the flat list so the screen has one code path.
  if (!Array.isArray(body.entries)) return null;
  const byProject = new Map<string, VoiceAlbumProject>();
  for (const rawEntry of body.entries) {
    const entry = mapEntry(rawEntry, null);
    if (!entry?.projectId) continue;
    const group = byProject.get(entry.projectId) ?? {
      projectId: entry.projectId,
      title: null,
      entries: [],
    };
    group.entries.push(entry);
    byProject.set(entry.projectId, group);
  }
  return [...byProject.values()];
}

function mapAttempt(raw: unknown): ExerciseAttempt | null {
  const row = rec(raw);
  const attemptId = row ? str(row.attempt_id) : null;
  if (!row || !attemptId) return null;
  return {
    attemptId,
    index: num(row.index),
    audioUrl: str(row.audio_url),
    durationMs: num(row.duration_ms),
    kept: row.kept === true,
  };
}

function mapEvent(raw: unknown): MomentEvent | null {
  const row = rec(raw);
  if (!row) return null;
  const at = str(row.at);
  switch (row.kind) {
    case "owner_answer": {
      const response = str(row.response);
      return response
        ? { kind: "owner_answer", who: str(row.who) ?? "You", at, response }
        : null;
    }
    case "coach_agreed":
      return { kind: "coach_agreed", who: str(row.who) ?? "Your coach", at };
    case "exercise": {
      const title = str(row.title);
      if (!title) return null;
      const attempts: ExerciseAttempt[] = [];
      for (const rawAttempt of Array.isArray(row.attempts) ? row.attempts : []) {
        const attempt = mapAttempt(rawAttempt);
        if (attempt) attempts.push(attempt);
      }
      return {
        kind: "exercise",
        at,
        title,
        instruction: str(row.instruction) ?? "",
        videoUrl: str(row.video_url),
        attempts,
      };
    }
    case "note": {
      const body = str(row.body);
      return body
        ? { kind: "note", who: str(row.who) ?? "You", at, body, noteId: str(row.note_id) }
        : null;
    }
    default:
      // An event kind this client does not know about is skipped rather than
      // rendered blank — a later backend may add lanes before this ships.
      return null;
  }
}

export async function fetchMomentHistory(
  projectId: string,
  momentKey: string
): Promise<MomentHistory | null> {
  const body = rec(
    await getJson(
      `/api/v2/voice-album/moment-history?arc=${encodeURIComponent(projectId)}` +
        `&moment=${encodeURIComponent(momentKey)}`
    )
  );
  if (!body) return null;
  const origin = rec(body.origin) ?? {};
  const events: MomentEvent[] = [];
  for (const rawEvent of Array.isArray(body.events) ? body.events : []) {
    const event = mapEvent(rawEvent);
    if (event) events.push(event);
  }
  return {
    momentKey: str(body.moment_key) ?? momentKey,
    origin: {
      takeIndex: num(origin.take_index),
      slideIndex: num(origin.slide_index),
      at: str(origin.at),
      source: origin.source === "practice_attempt" ? "practice_attempt" : "snippet",
    },
    events,
  };
}

export async function saveMomentNote(
  projectId: string,
  momentKey: string,
  body: string
): Promise<MomentEvent | null> {
  let response: Response;
  try {
    response = await fetch("/api/v2/voice-album/note", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ arc_id: projectId, moment_key: momentKey, body }),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = rec(await response.json().catch(() => null));
  return payload ? mapEvent(payload.note) : null;
}
