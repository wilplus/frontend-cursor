import { outcomeCall as call, type Outcome } from "@/lib/api/bffCall";

/* The AI version of your voice (founder lock 2026-10-12, N71). What the walk
   may know: video or AI clip on the Exercise screen, the clip's state and
   short-lived link, and with a ready clip the server's one signed sentence
   on what it does differently and why (WIL-82, founder 2026-10-16). No id,
   setting or check result (AC-9). */

export type AiVoiceDemo = "video" | "ai_voice" | "none";

export interface AiVoiceState {
  demo: AiVoiceDemo;
  clip: { state: "pending" | "ready" | "unavailable"; url: string | null; durationMs: number | null; why: string | null } | null;
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
          why: typeof raw.why === "string" && raw.why.trim() ? raw.why : null,
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

/* What this page already knows of each practice's clip: the walk's host asks
   as its AI bubble is shown, so the chat's bubble is drawn whole at once,
   not its lines first and the player a round trip later. */
const known = new Map<string, AiVoiceState>();
const asking = new Map<string, Promise<AiVoiceState | null>>();

export function knownAiVoice(practiceId: string): AiVoiceState | undefined {
  return known.get(practiceId);
}

/** An expired link: the next ask goes to the server again. */
export function forgetAiVoice(practiceId: string): void {
  known.delete(practiceId);
  asking.delete(practiceId);
}

/** The clip's state, asked once per practice per page. */
export function readAiVoiceOnce(practiceId: string): Promise<AiVoiceState | null> {
  // Only a ready clip is final; one still being made is asked again.
  const have = known.get(practiceId);
  if (have?.clip?.state === "ready") return Promise.resolve(have);
  let got = asking.get(practiceId);
  if (!got) {
    got = readAiVoice(practiceId)
      .then((r) => {
        if (!r.ok) return null;
        known.set(practiceId, r.data);
        return r.data;
      })
      .catch(() => null);
    asking.set(practiceId, got);
  }
  return got;
}

export function noteAiVoicePlay(practiceId: string): Promise<Outcome<null>> {
  return call(path(practiceId, "/play"), { method: "POST", body: {} }, () => null);
}

/* The Data & consent card (L6-L11): on or off, and nothing else. "deleting"
   is a Delete the provider has not confirmed yet; Delete again retries it. */
export interface AiVoiceCard {
  available: boolean;
  state: "on" | "off" | "deleting";
}

export function mapAiVoiceCard(data: Record<string, unknown>): AiVoiceCard {
  const state = data.state === "off" || data.state === "deleting" ? data.state : "on";
  return { available: data.available === true, state };
}

const CARD = "/api/v2/user/ai-voice";

export function readAiVoiceCard(): Promise<Outcome<AiVoiceCard>> {
  return call(CARD, { method: "GET" }, mapAiVoiceCard);
}

export function turnOnAiVoice(): Promise<Outcome<AiVoiceCard>> {
  return call(CARD, { method: "POST", body: {} }, mapAiVoiceCard);
}

export function deleteAiVoice(): Promise<Outcome<AiVoiceCard>> {
  return call(CARD, { method: "DELETE" }, mapAiVoiceCard);
}
