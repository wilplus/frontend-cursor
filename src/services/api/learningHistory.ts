/* -------------------------------------------------------------------------- */
/*  THE HISTORY OF LEARNING (founder 2026-09-25).                              */
/*                                                                            */
/*  "there was a video then the practice and they can scroll and actually see  */
/*  how it changed."                                                          */
/*                                                                            */
/*  A coach's note used to be pinned to an exact phrase and found by matching  */
/*  it against the CURRENT document, so rewriting the sentence dropped it —    */
/*  silently, with nobody told. The note was trying to stay current on words   */
/*  the speaker may change at will. A history entry is stamped to a moment     */
/*  instead: a rewrite cannot invalidate it, because the rewrite is the next   */
/*  entry.                                                                    */
/*                                                                            */
/*  Read-only, and nothing here is a score (AC-9). The coach half carries only */
/*  what they chose to SHARE — the backend refuses to send anything else.      */
/* -------------------------------------------------------------------------- */
import { getAuthToken } from "@/lib/api/auth-client";

export interface HistoryCoachEntry {
  title: string | null;
  instruction: string | null;
  videoRef: string | null;
  sharedAt: string | null;
}

export interface HistoryPracticeEntry {
  attemptIndex: number | null;
  recordedAt: string | null;
}

export interface LearningHistoryEntry {
  version: number | null;
  createdAt: string | null;
  text: string;
  takeSessionId: string | null;
  coach: HistoryCoachEntry | null;
  practice: HistoryPracticeEntry[];
}

export interface LearningHistory {
  entries: LearningHistoryEntry[];
  /** When the record begins. A project older than the snapshot table has a
   *  shorter chain, and saying so is the difference between a short history
   *  and a wrong one. */
  historyStartsAt: string | null;
}

const EMPTY: LearningHistory = { entries: [], historyStartsAt: null };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapCoach(raw: unknown): HistoryCoachEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const entry = {
    title: str(r.title),
    instruction: str(r.instruction),
    videoRef: str(r.video_ref),
    sharedAt: str(r.shared_at),
  };
  // An entry with nothing in it is not an entry; drawing an empty coach block
  // would read as "your coach said nothing", which is a different claim.
  return entry.title || entry.instruction || entry.videoRef ? entry : null;
}

function mapEntry(raw: unknown): LearningHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (!text) return null;
  const practice = Array.isArray(r.practice) ? r.practice : [];
  return {
    version: num(r.version),
    createdAt: str(r.created_at),
    text,
    takeSessionId: str(r.take_session_id),
    coach: mapCoach(r.coach),
    practice: practice
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const row = p as Record<string, unknown>;
        return {
          attemptIndex: num(row.attempt_index),
          recordedAt: str(row.recorded_at),
        };
      })
      .filter((p): p is HistoryPracticeEntry => p !== null),
  };
}

export function mapLearningHistory(body: unknown): LearningHistory {
  if (!body || typeof body !== "object") return EMPTY;
  const r = body as Record<string, unknown>;
  const entries = Array.isArray(r.entries) ? r.entries : [];
  return {
    entries: entries
      .map(mapEntry)
      .filter((e): e is LearningHistoryEntry => e !== null),
    historyStartsAt: str(r.history_starts_at),
  };
}

/** The project's chain, oldest first. An unreachable server is an empty
 *  history, never a wrong one — the caller shows nothing rather than a
 *  chapter it cannot prove. */
export async function fetchLearningHistory(
  arcId: string,
): Promise<LearningHistory> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/learning-history`,
      { headers, credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return EMPTY;
    return mapLearningHistory(await response.json().catch(() => null));
  } catch {
    return EMPTY;
  }
}
