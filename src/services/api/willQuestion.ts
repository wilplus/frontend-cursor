import { bffFetch } from "@/lib/api/bffFetch";

/** A tap under Will's one question after a Take (founder 2026-10-20, N82):
 *  one of its answers, or "Skip". The backend writes the tap and the reply
 *  (thanks, or the one follow-up) into the Lounge; the caller reloads the
 *  thread. False on any failure. */
export async function postWillQuestion(
  arcId: string,
  takeSessionId: string,
  choice: string,
): Promise<boolean> {
  try {
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/will-question`, {
      method: "POST",
      cache: "no-store",
      json: { take_session_id: takeSessionId, choice },
    });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}

/** An answer to Will's open question by voice (backend N294 items 2 and 3,
 *  N314, N319 item 1): the recording goes to the backend, which hears it
 *  under the speaker's processing authorization and writes their voice
 *  bubble with the words, Will's reply and what comes after. The rows
 *  written, or null on any failure (nothing was kept). */
export async function postWillVoiceAnswer(
  arcId: string,
  takeSessionId: string,
  audio: Blob,
  durationMs: number,
): Promise<LoungeRow[] | null> {
  try {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", audio, `answer.${ext}`);
    form.append("duration_ms", String(Math.round(durationMs)));
    form.append("take_session_id", takeSessionId);
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/will-question/voice`, {
      method: "POST",
      cache: "no-store",
      timeoutMs: 60_000,
      body: form,
    });
    if (result.kind !== "response" || !result.ok) return null;
    const rows = (result.body as { messages?: unknown } | null)?.messages;
    return Array.isArray(rows) ? (rows as LoungeRow[]) : [];
  } catch {
    return null;
  }
}

/** A row the backend wrote, as far as the voice answer reads it. */
export type LoungeRow = { client_id: string; metadata?: Record<string, unknown> | null };
