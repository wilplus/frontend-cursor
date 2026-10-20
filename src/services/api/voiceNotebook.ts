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

/* The Sunday note (Will learning plan, step 2). */
export type SundayStep = "pattern" | "principle";
export type SundayChoice = "old" | "new" | "add" | "not_now";

export function answerSunday(noteId: string, step: SundayStep, choice: SundayChoice): Promise<boolean> {
  return post(`/api/v2/notebook/sunday/${encodeURIComponent(noteId)}/${step}`, { json: { choice } });
}
