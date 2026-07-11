import { getAuthToken } from "@/lib/api/auth-client";
import type { BestPresentationPaywall } from "./bestPresentation";

/* -------------------------------------------------------------------------- */
/*  arcGame — the key-moment game (E5), a paid deliverable behind the $25 gate */
/*                                                                            */
/*  Rounds mix the arc owner's coach-confirmed key moments with their own       */
/*  unmarked moments as decoys; the user guesses which is which, and the "why"   */
/*  reveal teaches through their own patterns (E4). Every answer is second-     */
/*  order signal (L2/L3: never joined into coach truth) — the FE just plays.    */
/*                                                                            */
/*  Safe ahead of the BE: 402 → the same clean paywall as ideal-text /          */
/*  breakthroughs; 404/501 (engine not shipped yet) → a notAvailable sentinel   */
/*  rendered as "coming soon", never an error. All mappers are defensive; a      */
/*  malformed round is dropped, not crashed on.                                 */
/* -------------------------------------------------------------------------- */

export interface GameRound {
  roundId: string;
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
}

export interface GameSession {
  gameSessionId: string | null;
  rounds: GameRound[];
}

export interface GameNotAvailable {
  notAvailable: true;
}

export interface GameVerdict {
  correct: boolean;
  /** "Here is why" paragraphs (≤3, qualitative). Keywords arrive marked
   *  (**kw** or ==kw==) for the orange tint; render via renderTintedText. */
  why: string[];
  /** Coach's breakthrough video for this moment, when one exists. */
  videoRef: string | null;
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function mapRound(raw: unknown, i: number): GameRound | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const roundId =
    str(r.round_id) || str(r.id) || (r.round_id === 0 ? "0" : "");
  const transcript = str(r.transcript) || str(r.text);
  if (!transcript) return null; // nothing to judge → drop
  return {
    roundId: roundId || `round-${i}`,
    transcript,
    audioRef:
      typeof r.audio_ref === "string" && r.audio_ref.length > 0
        ? r.audio_ref
        : null,
    startOffsetMs: num(r.start_offset_ms),
    durationMs: num(r.duration_ms),
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Fetch the arc's game session. `snippetId` deep-link → the BE puts that
 *  round first. */
export async function fetchArcGame(
  arcId: string,
  snippetId?: string | null
): Promise<GameSession | BestPresentationPaywall | GameNotAvailable | null> {
  const headers = await authHeaders();
  const qs = snippetId ? `?snippet=${encodeURIComponent(snippetId)}` : "";
  let res: Response;
  try {
    res = await fetch(`/api/v2/arc/${encodeURIComponent(arcId)}/game${qs}`, {
      method: "GET",
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (res.status === 402) return { paymentRequired: true };
  if (res.status === 404 || res.status === 501) return { notAvailable: true };
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return null;
  const rawRounds = Array.isArray(body.rounds) ? body.rounds : [];
  const rounds = rawRounds
    .map(mapRound)
    .filter((r): r is GameRound => r !== null);
  if (rounds.length === 0) return { notAvailable: true };
  return {
    gameSessionId:
      typeof body.game_session_id === "string" && body.game_session_id
        ? body.game_session_id
        : null,
    rounds,
  };
}

/** Submit an answer (true = "this was a key moment"). Returns the verdict +
 *  the "Here is why" reveal. Soft-fails to null (the FE keeps the round open). */
export async function submitGameAnswer(
  arcId: string,
  roundId: string,
  answer: boolean
): Promise<GameVerdict | null> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/arc/${encodeURIComponent(arcId)}/game/answers`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ round_id: roundId, answer }),
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return null;
  const rawWhy = Array.isArray(body.why)
    ? body.why
    : Array.isArray(body.paragraphs)
      ? body.paragraphs
      : [];
  return {
    correct: body.correct === true || body.verdict === "correct",
    why: rawWhy.filter((p): p is string => typeof p === "string" && p.length > 0),
    videoRef:
      typeof body.video_ref === "string" && body.video_ref.length > 0
        ? body.video_ref
        : typeof body.breakthrough_video_ref === "string" &&
            body.breakthrough_video_ref.length > 0
          ? body.breakthrough_video_ref
          : null,
  };
}

/** Save the finished session to the daily-practice repository. */
export async function saveGameSession(
  arcId: string,
  gameSessionId: string | null
): Promise<boolean> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(`/api/v2/arc/${encodeURIComponent(arcId)}/game/save`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(
        gameSessionId ? { game_session_id: gameSessionId } : {}
      ),
    });
  } catch {
    return false;
  }
  return res.ok;
}

export interface SavedGameSession {
  id: string;
  /** ISO date the session was saved under. */
  savedAt: string;
  arcId: string | null;
  topic: string | null;
}

/** List the user's saved daily-practice sessions (newest first). Soft-fails
 *  to [] — the archive section simply hides. */
export async function fetchSavedGameSessions(): Promise<SavedGameSession[]> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(`/api/v2/user/game-sessions`, {
      method: "GET",
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return [];
  const raw = Array.isArray(body.sessions)
    ? body.sessions
    : Array.isArray(body.items)
      ? body.items
      : [];
  return raw
    .map((s, i): SavedGameSession | null => {
      if (!s || typeof s !== "object") return null;
      const r = s as Record<string, unknown>;
      const savedAt = str(r.saved_at) || str(r.created_at) || str(r.date);
      if (!savedAt) return null;
      return {
        id: str(r.id) || `saved-${i}`,
        savedAt,
        arcId: str(r.arc_id) || null,
        topic: str(r.topic) || null,
      };
    })
    .filter((s): s is SavedGameSession => s !== null);
}

/* ------------------------- keyword tint rendering ------------------------- */

/** Split a "why" paragraph into plain + tinted segments. The BE marks keywords
 *  with **kw** or ==kw== — both accepted (marker format not hard-pinned). */
export function splitTintedSegments(
  text: string
): { text: string; tinted: boolean }[] {
  const out: { text: string; tinted: boolean }[] = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), tinted: false });
    out.push({ text: m[1] ?? m[2] ?? "", tinted: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), tinted: false });
  return out.length > 0 ? out : [{ text, tinted: false }];
}
