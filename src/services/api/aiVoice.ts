import { outcomeCall as call, type Outcome } from "@/lib/api/bffCall";

/* The AI version of your voice (founder lock 2026-10-12, N71). What the walk
   may know: video or AI clip on the Exercise screen, and the clip's state
   and short-lived link. No id, setting or check result (AC-9). */

export type AiVoiceDemo = "video" | "ai_voice" | "none";

export interface AiVoiceState {
  demo: AiVoiceDemo;
  clip: { state: "pending" | "ready" | "unavailable"; url: string | null; durationMs: number | null } | null;
}

export function mapAiVoice(data: Record<string, unknown>): AiVoiceState {
  const demo = data.demo === "ai_voice" || data.demo === "video" ? data.demo : "none";
  const raw = data.clip !== null && typeof data.clip === "object" ? (data.clip as Record<string, unknown>) : null;
  const state = raw?.state === "ready" || raw?.state === "pending" ? raw.state : "unavailable";
  return {
    demo,
    clip: raw
      ? {
          state,
          url: typeof raw.url === "string" ? raw.url : null,
          durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : null,
        }
      : null,
  };
}

const path = (practiceId: string, tail = "") =>
  `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/ai-voice${tail}`;

/** Enter the lane: the clip is made once for this practice. */
export function ensureAiVoice(practiceId: string): Promise<Outcome<AiVoiceState>> {
  return call(path(practiceId), { method: "POST", body: {} }, mapAiVoice);
}

export function readAiVoice(practiceId: string): Promise<Outcome<AiVoiceState>> {
  return call(path(practiceId), { method: "GET" }, mapAiVoice);
}

export function noteAiVoicePlay(practiceId: string): Promise<Outcome<null>> {
  return call(path(practiceId, "/play"), { method: "POST", body: {} }, () => null);
}
