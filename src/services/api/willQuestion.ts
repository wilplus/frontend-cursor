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
