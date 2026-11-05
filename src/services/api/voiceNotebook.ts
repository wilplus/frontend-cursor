import { bffFetch } from "@/lib/api/bffFetch";

/* The founder's voice notebook (Will learning plan, step 1; founder
   2026-10-20). Backend: services/voice_notebook.py. Each write puts its rows
   into the Lounge; the caller reloads the thread. */

export type NotebookState = { enabled: boolean; consented: boolean; max_seconds: number };

const OFF: NotebookState = { enabled: false, consented: false, max_seconds: 300 };

export async function getNotebookState(): Promise<NotebookState> {
  return (await readNotebookState()) ?? OFF;
}

/** The read in flight. The chat asks this from three places as it opens
 *  (the dump screen's open-first check, the phone app's sync, the
 *  notebook in the Lounge), so callers that ask at the same moment share one
 *  request; once it has answered, the next ask reads again (2026-11-05). */
let inFlight: Promise<NotebookState | null> | null = null;

/** The notebook's state, or null when it could not be read (no network, a
 *  failed request): "unknown" is not "off". */
export function readNotebookState(): Promise<NotebookState | null> {
  if (inFlight) return inFlight;
  const read: Promise<NotebookState | null> = requestNotebookState().finally(() => {
    if (inFlight === read) inFlight = null;
  });
  inFlight = read;
  return read;
}

async function requestNotebookState(): Promise<NotebookState | null> {
  try {
    const tz = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    })();
    const query = tz ? `?${new URLSearchParams({ tz }).toString()}` : "";
    const result = await bffFetch(`/api/v2/notebook/state${query}`, { cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return null;
    const body = (result.body ?? {}) as Partial<NotebookState>;
    return {
      enabled: body.enabled === true,
      consented: body.consented === true,
      max_seconds: typeof body.max_seconds === "number" ? body.max_seconds : OFF.max_seconds,
    };
  } catch {
    return null;
  }
}

async function post(path: string, init: { json?: unknown; body?: BodyInit }): Promise<boolean> {
  try {
    const result = await bffFetch(path, { method: "POST", cache: "no-store", ...init });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  } finally {
    // A read asked after a write never shares one that began before it.
    inFlight = null;
  }
}

/** `source` "dump_screen": the Yes given on the dump screen, after which
 *  Will's chat asks nothing (backend N514). */
export function answerNotebook(choice: "yes" | "not_now", source: "chat" | "dump_screen" = "chat"): Promise<boolean> {
  return post("/api/v2/notebook/consent", { json: { choice, source } });
}

/** The sale's step under "Which step did it stall at?" (backend N241 P2). */
export type SalesStep = "opening" | "discovery" | "offer" | "follow_up";

export function answerSalesStep(note: string, step: SalesStep): Promise<boolean> {
  return post("/api/v2/notebook/sales-step", { json: { note, step } });
}

function audioName(audio: Blob, stem: string): string {
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  return `${stem}.${ext}`;
}

/** What became of a note sent: kept (with the user row's client_id), refused
 *  for good (nothing heard, no notebook), or not sent and to try again. */
export type SendOutcome = { kind: "kept"; clientId: string | null } | { kind: "refused" } | { kind: "retry" };

/** One voice note. `key` names it, so a note sent again after the app was
 *  closed mid-send is kept once (backend N194). */
export async function sendVoiceNote(
  audio: Blob,
  durationMs: number,
  key: string,
  liveMs?: number,
): Promise<SendOutcome> {
  const form = new FormData();
  form.append("audio", audio, audioName(audio, "note"));
  form.append("duration_ms", String(Math.round(durationMs)));
  form.append("key", key);
  // How long its live words were streamed, for the cost table (backend N396).
  if (liveMs) form.append("live_ms", String(Math.round(liveMs)));
  try {
    const result = await bffFetch("/api/v2/notebook/notes", { method: "POST", cache: "no-store", body: form });
    if (result.kind !== "response") return { kind: "retry" };
    if (result.ok) {
      const rows = ((result.body as { messages?: { role?: string; client_id?: string }[] } | null)?.messages ?? []);
      return { kind: "kept", clientId: rows.find((r) => r.role === "user")?.client_id ?? null };
    }
    // A refusal that will not change on a second try: nothing heard, too
    // long, no notebook, no consent. Anything else (5xx, 429) is tried again.
    return result.status >= 400 && result.status < 500 && result.status !== 429 ? { kind: "refused" } : { kind: "retry" };
  } catch {
    return { kind: "retry" };
  }
}

/** The words so far of a note being said: a few seconds of audio, nothing
 *  kept (backend N194). null when it could not be heard. */
export async function hearPiece(audio: Blob): Promise<string | null> {
  const form = new FormData();
  form.append("audio", audio, audioName(audio, "piece"));
  try {
    const result = await bffFetch("/api/v2/notebook/live", { method: "POST", cache: "no-store", body: form });
    if (result.kind !== "response" || !result.ok) return null;
    const text = (result.body as { text?: unknown } | null)?.text;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

/** A short-lived key to stream a note being said to the transcription
 *  provider (backend N396): issued under the caller's processing
 *  authorization, nothing kept. null when it cannot be had: the note is
 *  then heard in pieces, as before. */
export async function openLiveSession(): Promise<{ value: string; rate: number } | null> {
  try {
    const result = await bffFetch("/api/v2/notebook/live-session", { method: "POST", cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return null;
    const body = result.body as { value?: unknown; rate?: unknown } | null;
    if (typeof body?.value !== "string" || !body.value) return null;
    return { value: body.value, rate: typeof body.rate === "number" && body.rate > 0 ? body.rate : 24_000 };
  } catch {
    return null;
  }
}

/** The person's own words for one of their voice notes (backend N194). */
export function fixVoiceNote(clientId: string, text: string): Promise<boolean> {
  return post("/api/v2/notebook/fix", { json: { client_id: clientId, text } });
}

/* The Sunday note as a lens (Will learning plan, step 2; backend N158,
   N170; rules docs/flows/principles.md §1 L). Every answer is a row of the
   one Lounge thread; the lens and the Lounge show the same rows. */
export type SundayStep = "bug" | "applied" | "reflection" | "principle" | "done" | "closed";
export type SundayNote = {
  id: string;
  case: string;
  /** The two held principles most likely to apply (L5). */
  likely: { id: string; title: string }[];
  new_principle: string | null;
  /** "sales" for a sales week: the sale's steps in place of the bugs
   *  (backend N241 P3). */
  kind?: "sales" | "self";
  /** The step the lens waits on. */
  step: SundayStep;
  rows: { role: "user" | "bot"; body: string; step: string }[];
};

function sundayNoteOf(body: unknown): SundayNote | null {
  const note = body as Partial<SundayNote> | null;
  return note && typeof note.id === "string" && Array.isArray(note.rows) && typeof note.step === "string"
    ? { likely: [], new_principle: null, case: "", ...note } as SundayNote
    : null;
}

export async function getSundayNote(id: string): Promise<SundayNote | null> {
  try {
    const result = await bffFetch(`/api/v2/notebook/sunday/${encodeURIComponent(id)}`, { cache: "no-store" });
    return result.kind === "response" && result.ok ? sundayNoteOf(result.body) : null;
  } catch {
    return null;
  }
}

/** One tap: "open", "bug", "applied", "reflection", "principle", or
 *  "dismiss" (Not now under the case). The note as it stands after it. */
export async function answerSundayNote(id: string, step: string, value?: unknown): Promise<SundayNote | null> {
  try {
    const result = await bffFetch(`/api/v2/notebook/sunday/${encodeURIComponent(id)}/answer`, {
      method: "POST",
      cache: "no-store",
      json: { step, value: value ?? null },
    });
    return result.kind === "response" && result.ok ? sundayNoteOf(result.body) : null;
  } catch {
    return null;
  }
}
