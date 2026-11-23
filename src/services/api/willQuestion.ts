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



/** A spoken answer to Will's key-line question (backend N544): the backend
 *  hears it under the caller's processing authorization and writes the
 *  speaker's bubble with the words and Will's reply into the Lounge; the
 *  caller reloads the thread. The recording is not kept. False on any
 *  failure. */
export async function postWillQuestionVoice(
  arcId: string,
  takeSessionId: string,
  audio: Blob,
  durationMs: number,
): Promise<boolean> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `answer.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  form.append("take_session_id", takeSessionId);
  try {
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/will-question/voice`, {
      method: "POST",
      cache: "no-store",
      timeoutMs: 60_000,
      body: form,
    });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}

/** Hear a spoken follow-up; the existing chat outbox sends its words. */
export async function transcribeTakeFollowUp(
  arcId: string, takeSessionId: string, audio: Blob, durationMs: number,
): Promise<{ text: string; durationMs: number } | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `follow-up.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  form.append("take_session_id", takeSessionId);
  form.append("transcribe_only", "1");
  try {
    const reply = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/will-question/voice`, {
      method: "POST", cache: "no-store", timeoutMs: 60_000, body: form,
    });
    if (reply.kind !== "response" || !reply.ok) return null;
    const body = reply.body as { text?: unknown; duration_ms?: unknown } | null;
    return typeof body?.text === "string" && body.text.trim()
      ? { text: body.text, durationMs: typeof body.duration_ms === "number" ? body.duration_ms : durationMs }
      : null;
  } catch {
    return null;
  }
}
