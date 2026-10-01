import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  AFTER THE PRACTICE — the speaker-side clients (Phases 3 and 4, founder     */
/*  2026-10-01, F3 to F5). Plumbing only: every call is dark on the backend   */
/*  (404) until its switch, and the screens are the designer session's.      */
/* -------------------------------------------------------------------------- */

export type AfterPracticeStep = "bridge" | "lend_your_ear" | "bold_voices";

export interface BoldVoicesClip {
  clipId: string;
  audioRef: string | null;
  durationMs: number | null;
  passage?: string;
  practiceId?: string;
  mediaKind?: string;
}

export interface BoldVoices {
  own: BoldVoicesClip[];
  coachReadings: BoldVoicesClip[];
  others: BoldVoicesClip[];
  stepsShown: Partial<Record<AfterPracticeStep, string>>;
}

export interface LendYourEarClip {
  clipId: string;
  audioRef: string | null;
  durationMs: number | null;
  answered: boolean;
}

export interface LendYourEarSet {
  setId: string;
  clips: LendYourEarClip[];
}

export type FiveAnswers = "yes" | "in_between" | "no" | "not_sure" | "audio_unclear";

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null };

async function call<T>(
  path: string,
  init: { method: "GET" | "POST" | "PUT"; body?: unknown },
  map: (data: Record<string, unknown>) => T,
): Promise<Outcome<T>> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, status: 401, code: "NO_SESSION" };
    const res = await fetch(path, {
      method: init.method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : null };
    }
    return { ok: true, data: map(data ?? {}) };
  } catch {
    return { ok: false, status: 0, code: null };
  }
}

function clip(raw: unknown): BoldVoicesClip {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    clipId: String(r.clip_id ?? ""),
    audioRef: typeof r.audio_ref === "string" ? r.audio_ref : typeof r.media_url === "string" ? r.media_url : null,
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
    ...(typeof r.passage === "string" ? { passage: r.passage } : {}),
    ...(typeof r.practice_id === "string" ? { practiceId: r.practice_id } : {}),
    ...(typeof r.media_kind === "string" ? { mediaKind: r.media_kind } : {}),
  };
}

const list = (raw: unknown): BoldVoicesClip[] => (Array.isArray(raw) ? raw.map(clip) : []);

export function mapBoldVoices(data: Record<string, unknown>): BoldVoices {
  const steps = (data.steps_shown ?? {}) as Record<string, unknown>;
  const stepsShown: Partial<Record<AfterPracticeStep, string>> = {};
  for (const step of ["bridge", "lend_your_ear", "bold_voices"] as const) {
    if (typeof steps[step] === "string") stepsShown[step] = steps[step] as string;
  }
  return {
    own: list(data.own),
    coachReadings: list(data.coach_readings),
    others: list(data.others),
    stepsShown,
  };
}

export function mapLendYourEarSet(data: Record<string, unknown>): LendYourEarSet {
  const clips = Array.isArray(data.clips) ? data.clips : [];
  return {
    setId: String(data.set_id ?? ""),
    clips: clips.map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      return {
        clipId: String(r.clip_id ?? ""),
        audioRef: typeof r.audio_ref === "string" ? r.audio_ref : null,
        durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
        answered: r.answered === true,
      };
    }),
  };
}

export function fetchBoldVoices(takeSessionId: string): Promise<Outcome<BoldVoices>> {
  return call(`/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/bold-voices`, { method: "GET" }, mapBoldVoices);
}

export function reportAfterPracticeStep(
  takeSessionId: string,
  step: AfterPracticeStep,
): Promise<Outcome<{ recorded: boolean }>> {
  return call(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/after-practice-step`,
    { method: "POST", body: { step } },
    (d) => ({ recorded: d.recorded === true }),
  );
}

export function reportBoldVoicesHeard(
  takeSessionId: string,
  clipKind: "own_attempt" | "coach_reading",
  clipId: string,
): Promise<Outcome<{ recorded: boolean }>> {
  return call(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/bold-voices/heard`,
    { method: "POST", body: { clip_kind: clipKind, clip_id: clipId } },
    (d) => ({ recorded: d.recorded === true }),
  );
}

export function openLendYourEar(takeSessionId: string): Promise<Outcome<LendYourEarSet>> {
  return call(`/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/lend-your-ear`, { method: "GET" }, mapLendYourEarSet);
}

export function answerLendYourEar(
  setId: string,
  clipId: string,
  value: FiveAnswers,
): Promise<Outcome<{ answered: number; of: number }>> {
  return call(
    `/api/v2/user/lend-your-ear/${encodeURIComponent(setId)}/answers`,
    { method: "POST", body: { clip_id: clipId, value } },
    (d) => ({ answered: Number(d.answered ?? 0), of: Number(d.of ?? 0) }),
  );
}

export function setVoiceAlbumShare(
  snippetId: string,
  shared: boolean,
): Promise<Outcome<{ shared: boolean }>> {
  return call(
    `/api/v2/user/voice-album/${encodeURIComponent(snippetId)}/share`,
    { method: "PUT", body: { shared } },
    (d) => ({ shared: d.shared === true }),
  );
}
