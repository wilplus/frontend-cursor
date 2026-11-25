import { bffFetch } from "@/lib/api/bffFetch";
import { isUuid } from "@/lib/uuid";

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

export type SpokenChatAnswer = { text: string; durationMs: number; receipt?: string; turnId?: string; audio?: Blob; practiceReplyId?: string };

export type ChatVoiceFocus = { source: "clip"; turn_id: string; playback?: boolean };

export function chatVoiceFocus(raw: unknown): ChatVoiceFocus | null {
  if (!raw || typeof raw !== "object") return null;
  const { source, turn_id, playback } = raw as Partial<ChatVoiceFocus>;
  if (source !== "clip" || !isUuid(turn_id)) return null;
  return { source, turn_id, ...(typeof playback === "boolean" ? { playback } : {}) };
}

export const chatVoicePath = (turn: string) => "/api/v2/chat/voice/" + encodeURIComponent(turn);

export async function attachChatVoice(turn: string, audio: Blob, receipt: string): Promise<boolean> {
  const mime = audio.type.includes("mp4") ? "audio/mp4" : audio.type.includes("ogg") ? "audio/ogg" :
    audio.type.includes("wav") ? "audio/wav" : "audio/webm";
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: mime }), "answer." + mime.split("/")[1]);
  form.append("voice_receipt", receipt);
  const result = await bffFetch(chatVoicePath(turn), { method: "POST", body: form, timeoutMs: 30_000 });
  return result.kind === "response" && result.ok;
}

/** Hear this recording once. Carry its authorised evidence with the outbox turn. */
export async function transcribeChatAnswer(
  audio: Blob, durationMs: number, take?: { arcId: string; takeId: string },
  attempt?: { turnId?: string; projectId?: string; snippetId?: string; practiceReplyId?: string },
): Promise<SpokenChatAnswer | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `follow-up.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  if (attempt?.turnId) form.append("voice_turn_id", attempt.turnId);
  if (attempt?.projectId) form.append("project_id", attempt.projectId);
  if (attempt?.snippetId) form.append("snippet_id", attempt.snippetId);
  if (attempt?.practiceReplyId) form.append("chat_practice_reply_id", attempt.practiceReplyId);
  const path = take
    ? `/api/v2/explore/arc/${encodeURIComponent(take.arcId)}/will-question/voice`
    : "/api/v2/chat/voice";
  if (take) {
    form.append("take_session_id", take.takeId);
    form.append("transcribe_only", "1");
  }
  try {
    const reply = await bffFetch(path, {
      method: "POST", cache: "no-store", timeoutMs: 60_000, body: form,
    });
    if (reply.kind !== "response" || !reply.ok) return null;
    const body = reply.body as { text?: unknown; duration_ms?: unknown; voice_receipt?: unknown } | null;
    return typeof body?.text === "string" && body.text.trim()
      ? {
        text: body.text, durationMs: typeof body.duration_ms === "number" ? body.duration_ms : durationMs,
        ...(attempt?.turnId ? { turnId: attempt.turnId } : {}),
        ...(typeof body.voice_receipt === "string" ? { receipt: body.voice_receipt } : {}),
      }
      : null;
  } catch {
    return null;
  }
}
