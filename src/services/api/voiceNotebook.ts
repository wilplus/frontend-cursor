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

function audioName(audio: Blob, stem: string): string {
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  return `${stem}.${ext}`;
}

/** What became of a note sent: kept (with the user row's client_id), refused
 *  for good (nothing heard, no notebook), or not sent and to try again. */
export type SendOutcome = { kind: "kept"; clientId: string | null } | { kind: "refused" } | { kind: "retry" };

/** One voice note. `key` names it, so a note sent again after the app was
 *  closed mid-send is kept once (backend N194). */
export async function sendVoiceNote(audio: Blob, durationMs: number, key: string): Promise<SendOutcome> {
  const form = new FormData();
  form.append("audio", audio, audioName(audio, "note"));
  form.append("duration_ms", String(Math.round(durationMs)));
  form.append("key", key);
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

/** The person's own words for one of their voice notes (backend N194). */
export function fixVoiceNote(clientId: string, text: string): Promise<boolean> {
  return post("/api/v2/notebook/fix", { json: { client_id: clientId, text } });
}

/* The Sunday note (Will learning plan, step 2). */
export type SundayStep = "pattern" | "principle";
export type SundayChoice = "old" | "new" | "add" | "not_now";

export function answerSunday(noteId: string, step: SundayStep, choice: SundayChoice): Promise<boolean> {
  return post(`/api/v2/notebook/sunday/${encodeURIComponent(noteId)}/${step}`, { json: { choice } });
}
