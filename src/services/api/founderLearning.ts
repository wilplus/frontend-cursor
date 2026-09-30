/* -------------------------------------------------------------------------- */
/*  The founder's pace panel and the research screen (founder 2026-09-30;     */
/*  ML-4, ML-6, ML-7). Thin fetches over the BFF routes:                       */
/*                                                                            */
/*    GET  /api/v2/admin/learning/ledger            the ledger, weeks, pace    */
/*    POST /api/v2/admin/learning/weekly/run        run the weekly job now     */
/*    GET  /api/v2/research/overview                the research view          */
/*    GET  /api/v2/research/golden                  the golden sets' counts    */
/*    GET  /api/v2/research/golden/:s/next          the next moment to judge   */
/*    POST /api/v2/research/golden/:s/judgements    one judgement              */
/*    POST /api/v2/research/golden/:s/seal          seal at fifty              */
/*                                                                            */
/*  The backend gates every call (founder by email; research role or admin,   */
/*  GET only). A refusal comes back as its code and the page shows it.        */
/* -------------------------------------------------------------------------- */

import { mapLedgerWeek, mapPaceRow, type LedgerWeek, type PaceRow } from "@/lib/founder/pace";
import type { ConfidenceRatingValue } from "./stateRatings";

export type FounderResult<T> = { ok: true; value: T } | { ok: false; code: string; status: number };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function call<T>(path: string, init: RequestInit, pick: (body: Record<string, unknown>) => T): Promise<FounderResult<T>> {
  try {
    const response = await fetch(path, { cache: "no-store", credentials: "include", ...init });
    const body = await readJson(response);
    if (!response.ok) {
      return { ok: false, code: String(body.code ?? `HTTP_${response.status}`), status: response.status };
    }
    return { ok: true, value: pick(body) };
  } catch {
    return { ok: false, code: "UNREACHABLE", status: 0 };
  }
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface LedgerRead {
  ledger: Record<string, unknown>;
  weeks: LedgerWeek[];
  pace: PaceRow[];
}

export interface WeeklyRun {
  weekStart: string | null;
  readyCues: string[];
  unavailable: string[];
}

export interface GoldenCounts {
  surface: string;
  count: number;
  setSize: number;
  sealed: { count: number; sha256: string; sealed_at: string } | null;
}

export interface GoldenMoment {
  snippetId: string;
  takeSessionId: string | null;
  passage: string;
  audioUrl: string | null;
  startOffsetMs: number;
  durationMs: number;
}

export function mapGoldenCounts(raw: unknown): GoldenCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sealed = r.sealed && typeof r.sealed === "object" ? (r.sealed as Record<string, unknown>) : null;
  return {
    surface: String(r.surface ?? ""),
    count: typeof r.count === "number" ? r.count : 0,
    setSize: typeof r.set_size === "number" ? r.set_size : 50,
    sealed: sealed
      ? { count: Number(sealed.count ?? 0), sha256: String(sealed.sha256 ?? ""), sealed_at: String(sealed.sealed_at ?? "") }
      : null,
  };
}

export function mapGoldenMoment(raw: unknown): GoldenMoment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.snippet_id !== "string" || !r.snippet_id) return null;
  return {
    snippetId: r.snippet_id,
    takeSessionId: typeof r.take_session_id === "string" ? r.take_session_id : null,
    passage: typeof r.passage === "string" ? r.passage : "",
    audioUrl: typeof r.audio_url === "string" ? r.audio_url : null,
    startOffsetMs: typeof r.start_offset_ms === "number" ? r.start_offset_ms : 0,
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : 0,
  };
}

function mapSets(body: Record<string, unknown>): Record<string, GoldenCounts> {
  const sets = body.sets && typeof body.sets === "object" ? (body.sets as Record<string, unknown>) : {};
  const out: Record<string, GoldenCounts> = {};
  for (const [surface, raw] of Object.entries(sets)) {
    const mapped = mapGoldenCounts(raw);
    if (mapped) out[surface] = mapped;
  }
  return out;
}

export const founderLearning = {
  ledger: () =>
    call("/api/v2/admin/learning/ledger", { method: "GET" }, (b): LedgerRead => ({
      ledger: (b.ledger && typeof b.ledger === "object" ? b.ledger : {}) as Record<string, unknown>,
      weeks: (Array.isArray(b.weeks) ? b.weeks : []).map(mapLedgerWeek).filter((w): w is LedgerWeek => w !== null),
      pace: (Array.isArray(b.pace) ? b.pace : []).map(mapPaceRow).filter((p): p is PaceRow => p !== null),
    })),
  runWeekly: () =>
    call("/api/v2/admin/learning/weekly/run", { method: "POST" }, (b): WeeklyRun => ({
      weekStart: typeof b.week_start === "string" ? b.week_start : null,
      readyCues: Array.isArray(b.ready_cues) ? b.ready_cues.map(String) : [],
      unavailable: Array.isArray(b.unavailable) ? b.unavailable.map(String) : [],
    })),
  overview: () => call("/api/v2/research/overview", { method: "GET" }, (b) => b),
  golden: () => call("/api/v2/research/golden", { method: "GET" }, mapSets),
  nextMoment: (surface: string) =>
    call(`/api/v2/research/golden/${encodeURIComponent(surface)}/next`, { method: "GET" }, (b) => mapGoldenMoment(b.moment)),
  judge: (surface: string, body: { snippet_id: string; take_session_id: string | null; value: ConfidenceRatingValue }) =>
    call(`/api/v2/research/golden/${encodeURIComponent(surface)}/judgements`, { method: "POST", ...json(body) }, (b) =>
      mapGoldenCounts(b.judged)),
  seal: (surface: string) =>
    call(`/api/v2/research/golden/${encodeURIComponent(surface)}/seal`, { method: "POST" }, (b) => b),
};
