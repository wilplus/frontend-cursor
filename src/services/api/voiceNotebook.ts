import { bffFetch } from "@/lib/api/bffFetch";

/* The founder's voice notebook (Will learning plan, step 1; founder
   2026-10-20). Backend: services/voice_notebook.py. Each write puts its rows
   into the Lounge; the caller reloads the thread. */

export type NotebookState = { enabled: boolean; consented: boolean; max_seconds: number };

const OFF: NotebookState = { enabled: false, consented: false, max_seconds: 300 };

export async function getNotebookState(): Promise<NotebookState> {
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
    if (result.kind !== "response" || !result.ok) return OFF;
    const body = (result.body ?? {}) as Partial<NotebookState>;
    return {
      enabled: body.enabled === true,
      consented: body.consented === true,
      max_seconds: typeof body.max_seconds === "number" ? body.max_seconds : OFF.max_seconds,
    };
  } catch {
    return OFF;
  }
}

async function post(path: string, init: { json?: unknown; body?: BodyInit }): Promise<boolean> {
  try {
    const result = await bffFetch(path, { method: "POST", cache: "no-store", ...init });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}

/** Writes "Keep a voice notebook?" at the bottom of the thread. */
export function askNotebook(): Promise<boolean> {
  return post("/api/v2/notebook/ask", { json: {} });
}

export function answerNotebook(choice: "yes" | "not_now"): Promise<boolean> {
  return post("/api/v2/notebook/consent", { json: { choice } });
}

export function sendVoiceNote(audio: Blob, durationMs: number): Promise<boolean> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `note.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  return post("/api/v2/notebook/notes", { body: form });
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
