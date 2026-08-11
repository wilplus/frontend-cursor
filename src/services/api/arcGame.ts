import { getAuthToken } from "@/lib/api/auth-client";
import { notifyTokensSpent } from "@/lib/willabWindowEvents";

/* -------------------------------------------------------------------------- */
/*  arcGame — the key-moment game (E5)                                          */
/*                                                                            */
/*  Rounds mix the arc owner's coach-confirmed key moments with their own       */
/*  unmarked moments as decoys; the user guesses which is which, and the "why"   */
/*  reveal teaches through their own patterns (E4). Every answer is second-     */
/*  order signal (L2/L3: never joined into coach truth) — the FE just plays.    */
/*                                                                            */
/*  Engine 5 is LIVE BE-side (2026-07-11); the 2026-07-28 handoff supersedes    */
/*  the old "coming soon" sentinel. 404 now MEANS not-owned (a coach opening    */
/*  a student's game gets 404 by design) → error, and 200 with zero rounds is   */
/*  a VALID state ("reason": NO_KEY_MOMENTS_YET — the coach hasn't labeled),    */
/*  not an error. All mappers stay defensive; a malformed round is dropped,     */
/*  and a round without a real id is dropped too — its answer POST would        */
/*  append a junk peer label (N3), which is worse than one fewer round.         */
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
  /** Empty = the coach hasn't challenge-labeled any moment yet — a valid
   *  state the surface renders as its own copy, never as an error. */
  rounds: GameRound[];
}

export interface GameVerdict {
  /** null = the answer was Ambiguous ("I don't know") — no verdict exists
   *  on an abstained guess, and the reveal renders without a win/lose head
   *  (founder 2026-08-10: yes / no / idk). */
  correct: boolean | null;
  /** What the moment actually WAS. Drives the N5-neutral reveal line — a
   *  decoy is the user's own solid moment, never a failure. null when the BE
   *  omits it (older payloads); the reveal line simply doesn't render. */
  truthIsKey: boolean | null;
  /** "Here is why" paragraphs (≤3, qualitative). Keywords arrive marked
   *  (**kw** or ==kw==) for the orange tint; render via renderTintedText. */
  why: string[];
  /** Coach's breakthrough video for this moment, when one exists. */
  videoRef: string | null;
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function mapRound(raw: unknown): GameRound | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // round_id IS the snippet id; snippet_id is its explicit alias. A row
  // without a real id is unanswerable — a fabricated id would POST a junk
  // peer label (N3) — so it is dropped, never repaired.
  const roundId = str(r.round_id) || str(r.snippet_id) || str(r.id);
  const transcript = str(r.transcript) || str(r.text);
  if (!roundId || !transcript) return null;
  return {
    roundId,
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

/** Fetch the arc's game. `snippetId` deep-link → the BE pins that round
 *  first when it is among the chosen rounds, and silently ignores a stale
 *  link otherwise — never an error. Same arc → same rounds, same order. */
export async function fetchArcGame(
  arcId: string,
  snippetId?: string | null
): Promise<GameSession | null> {
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
  if (!res.ok) return null; // incl. 404 = not the arc's owner
  // TOKEN PRICING — metered, like the feedback read: the BE charges the `game`
  // price here, once per arc (`ref_id` is the arc id), silently and fail-open.
  //
  // Re-read the balance so the drop is tied to starting the game rather than
  // appearing unexplained at the next poll. Keyed on the response, not on a
  // usable body: the charge belongs to the request the BE served.
  //
  // Not priced up front anywhere. The menu row that opens this has no arc to
  // ask about (the training is resolved here, from `?arc=` or localStorage),
  // and by the time this page can resolve one the charge has already happened.
  notifyTokensSpent();
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !Array.isArray(body.rounds)) return null;
  const rounds = body.rounds
    .map(mapRound)
    .filter((r): r is GameRound => r !== null);
  // Served rounds that ALL failed mapping = a malformed payload (error);
  // a served empty list = the coach hasn't labeled yet (valid, N/FE-1).
  if (body.rounds.length > 0 && rounds.length === 0) return null;
  return {
    gameSessionId:
      typeof body.game_session_id === "string" && body.game_session_id
        ? body.game_session_id
        : null,
    rounds,
  };
}

/** Submit an answer — the ternary instrument ("yes" / "no" / "neutral" =
 *  the founder's idk; booleans still accepted for older callers). Returns
 *  the verdict + the "Here is why" reveal. Soft-fails to null (the FE keeps
 *  the round open). */
export async function submitGameAnswer(
  arcId: string,
  roundId: string,
  answer: boolean | "yes" | "no" | "neutral"
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
    correct:
      body.correct === true || body.verdict === "correct"
        ? true
        : body.correct === false
          ? false
          : null,
    truthIsKey:
      body.truth_is_key === true
        ? true
        : body.truth_is_key === false
          ? false
          : null,
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
