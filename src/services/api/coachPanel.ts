/* -------------------------------------------------------------------------- */
/*  THE COACH PANEL'S LEARNING ADDITIONS — the clients (founder 2026-10-01;   */
/*  Phases 1b, 7, 6a and 8). Plumbing: every call is dark on the backend      */
/*  (404) until its own switch, and every read answers null then, so a sheet  */
/*  shows nothing rather than an error. Nothing here carries a score, a rank  */
/*  or the machine's pick (AC-9, BLIND COACH): the block pick is letters and  */
/*  sounds, the audit is a clip and the error's own question.                */
/*                                                                            */
/*    GET/POST …/snippets/:snip/exercise-preference  → 1b keep / swap / new  */
/*    POST …/word/draft, …/moment-line/draft         → 7 drafts, text only   */
/*    GET /coach/error-audit, POST …/:id/answer       → 6a blind Yes / No     */
/*    GET /coach/block-picks, POST …/:id/answer       → 8 blind pick          */
/* -------------------------------------------------------------------------- */

type Raw = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

async function readJson(res: Response): Promise<Raw | null> {
  return (await res.json().catch(() => null)) as Raw | null;
}

async function post(path: string, body: unknown): Promise<{ status: number; data: Raw | null }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return { status: res.status, data: await readJson(res) };
  } catch {
    return { status: 0, data: null };
  }
}

async function get(path: string): Promise<{ status: number; data: Raw | null }> {
  try {
    const res = await fetch(path, { credentials: "include", cache: "no-store" });
    return { status: res.status, data: await readJson(res) };
  } catch {
    return { status: 0, data: null };
  }
}

/* ── 1b · the coach's exercise preference ────────────────────────────── */

export interface ServedExercise {
  exerciseId: string;
  title: string | null;
  instruction: string | null;
  /** The errors the exercise treats, as the library's labels. */
  treats: string[];
}

export interface PoolExercise {
  exerciseId: string;
  served: boolean;
  title: string | null;
  instruction: string | null;
}

export interface ExercisePreferenceView {
  served: ServedExercise;
  /** Shuffled by the backend; no rank, no score. */
  pool: PoolExercise[];
}

export type PreferenceAction = "kept" | "swapped" | "new";

export function mapExercisePreferenceView(raw: unknown): ExercisePreferenceView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  const served = (r.served ?? null) as Raw | null;
  const servedId = str(served?.exercise_id);
  if (!served || !servedId) return null;
  const treats = Array.isArray(served.treats)
    ? served.treats
        .map((t) => (t && typeof t === "object" ? str((t as Raw).label) ?? str((t as Raw).error_id) : str(t)))
        .filter((t): t is string => t !== null)
    : [];
  const pool = Array.isArray(r.pool)
    ? r.pool
        .filter((p): p is Raw => !!p && typeof p === "object")
        .map((p) => ({
          exerciseId: str(p.exercise_id) ?? "",
          served: p.served === true,
          title: str(p.title),
          instruction: str(p.instruction),
        }))
        .filter((p) => p.exerciseId)
    : [];
  return {
    served: { exerciseId: servedId, title: str(served.title), instruction: str(served.instruction), treats },
    pool,
  };
}

function momentPath(sessionId: string, snippetId: string, tail: string): string {
  return `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/${tail}`;
}

/** null while dark, when nothing was served, before the blind rating, or on
 *  any failure: the box simply does not draw. */
export async function fetchExercisePreference(
  sessionId: string,
  snippetId: string,
): Promise<ExercisePreferenceView | null> {
  const { status, data } = await get(momentPath(sessionId, snippetId, "exercise-preference"));
  if (status !== 200) return null;
  return mapExercisePreferenceView(data);
}

export async function recordExercisePreference(
  sessionId: string,
  snippetId: string,
  input: { action: PreferenceAction; chosenExerciseId?: string | null },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { status, data } = await post(momentPath(sessionId, snippetId, "exercise-preference"), {
    action: input.action,
    ...(input.chosenExerciseId ? { chosen_exercise_id: input.chosenExerciseId } : {}),
  });
  if (status === 201) return { ok: true };
  return { ok: false, status, message: str(data?.error) ?? "Couldn’t record that." };
}

/* ── 7 · drafts of the coach's own words (text only) ─────────────────── */

export interface CoachWordDraft {
  surface: "coach_take_word" | "coach_moment_line";
  text: string;
  modelVersion: string | null;
  /** The backend's own label for the field; shown as sent. */
  label: string | null;
}

export function mapCoachWordDraft(raw: unknown): CoachWordDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = ((raw as Raw).draft ?? null) as Raw | null;
  const text = str(d?.text);
  const surface = d?.surface;
  if (!d || !text || (surface !== "coach_take_word" && surface !== "coach_moment_line")) return null;
  return { surface, text, modelVersion: str(d.model_version), label: str(d.label) };
}

/** null while dark (404), before every moment is judged (409), when no
 *  provider answer came (503) or on any failure: the coach writes by hand. */
export async function draftTakeWord(sessionId: string, notes?: string): Promise<CoachWordDraft | null> {
  const { status, data } = await post(
    `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/word/draft`,
    notes?.trim() ? { notes: notes.trim() } : {},
  );
  return status === 200 ? mapCoachWordDraft(data) : null;
}

export async function draftMomentLine(
  sessionId: string,
  snippetId: string,
  notes?: string,
): Promise<CoachWordDraft | null> {
  const { status, data } = await post(
    momentPath(sessionId, snippetId, "moment-line/draft"),
    notes?.trim() ? { notes: notes.trim() } : {},
  );
  return status === 200 ? mapCoachWordDraft(data) : null;
}

/* ── 6a · the blind error audit ──────────────────────────────────────── */

export type AuditAnswer = "yes" | "no" | "cant_tell";

export interface ErrorAuditItem {
  auditId: string;
  clipId: string;
  audioRef: string | null;
  errorId: string;
  /** The library's label and its question, word for word. */
  label: string;
  asks: string;
}

export interface ErrorAuditQueue {
  items: ErrorAuditItem[];
  wording: Record<string, string>;
}

function wording(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Raw).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

export function mapErrorAuditQueue(raw: unknown): ErrorAuditQueue {
  const r = (raw ?? {}) as Raw;
  const items = Array.isArray(r.items)
    ? r.items
        .filter((i): i is Raw => !!i && typeof i === "object")
        .map((i) => ({
          auditId: str(i.audit_id) ?? "",
          clipId: str(i.clip_id) ?? "",
          audioRef: str(i.audio_ref),
          errorId: str(i.error_id) ?? "",
          label: str(i.label) ?? str(i.error_id) ?? "",
          asks: str(i.asks) ?? "",
        }))
        .filter((i) => i.auditId)
    : [];
  return { items, wording: wording(r.wording) };
}

/** null while dark or on any failure. */
export async function fetchErrorAudit(): Promise<ErrorAuditQueue | null> {
  const { status, data } = await get("/api/v2/coach/error-audit");
  return status === 200 ? mapErrorAuditQueue(data) : null;
}

export async function answerErrorAudit(
  auditId: string,
  answer: AuditAnswer,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const { status } = await post(`/api/v2/coach/error-audit/${encodeURIComponent(auditId)}/answer`, { answer });
  return status === 200 ? { ok: true } : { ok: false, status };
}

/* ── 8 · the blind block pick ────────────────────────────────────────── */

export interface BlockPickClip {
  clipId: string;
  letter: string;
  audioRef: string | null;
}

export interface BlockPickItem {
  pickId: string;
  clips: BlockPickClip[];
  n: number;
  of: number;
}

export interface BlockPickQueue {
  items: BlockPickItem[];
  wording: Record<string, string>;
}

export function mapBlockPickQueue(raw: unknown): BlockPickQueue {
  const r = (raw ?? {}) as Raw;
  const items = Array.isArray(r.items)
    ? r.items
        .filter((i): i is Raw => !!i && typeof i === "object")
        .map((i) => ({
          pickId: str(i.pick_id) ?? "",
          clips: Array.isArray(i.clips)
            ? i.clips
                .filter((c): c is Raw => !!c && typeof c === "object")
                .map((c) => ({ clipId: str(c.clip_id) ?? "", letter: str(c.letter) ?? "", audioRef: str(c.audio_ref) }))
                .filter((c) => c.clipId)
            : [],
          n: typeof i.n === "number" ? i.n : 0,
          of: typeof i.of === "number" ? i.of : 0,
        }))
        .filter((i) => i.pickId)
    : [];
  return { items, wording: wording(r.wording) };
}

/** null while dark or on any failure. */
export async function fetchBlockPicks(): Promise<BlockPickQueue | null> {
  const { status, data } = await get("/api/v2/coach/block-picks");
  return status === 200 ? mapBlockPickQueue(data) : null;
}

export async function answerBlockPick(
  pickId: string,
  input: { pickClipId: string } | { cantTell: true },
): Promise<{ ok: true } | { ok: false; status: number }> {
  const body = "cantTell" in input ? { cant_tell: true } : { pick_clip_id: input.pickClipId };
  const { status } = await post(`/api/v2/coach/block-picks/${encodeURIComponent(pickId)}/answer`, body);
  return status === 200 ? { ok: true } : { ok: false, status };
}
