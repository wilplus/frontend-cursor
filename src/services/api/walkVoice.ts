import { bffFetch } from "@/lib/api/bffFetch";

/* Will's voice in the walk (backend N565; services/walk_voice.py; rules:
   docs/flows/feedback-walk-and-chat.md K). For a speaker the `walk_voice`
   ring reaches, Will's message for a step is written from what is known
   about the Take, by the rules the founder sets. Any failure, a late answer
   or an answer refused by the server's check is null: the walk says its
   signed line, and never waits longer than `WALK_VOICE_WAIT_MS`. */

/** The ring feature that turns Will's written messages on. */
export const WALK_VOICE_FEATURE = "walk_voice";
/** How long the walk waits for Will's words before its signed line. */
export const WALK_VOICE_WAIT_MS = 4_000;

export type WalkVoiceStep = "praise" | "try" | "after_try" | "good_take" | "reply";

export async function askWalkVoice(
  takeId: string,
  step: WalkVoiceStep,
  snippetId: string | null,
  waitMs: number = WALK_VOICE_WAIT_MS,
): Promise<string | null> {
  const ask = (async () => {
    try {
      const result = await bffFetch("/api/v2/walk-voice", {
        method: "POST",
        cache: "no-store",
        json: { take_id: takeId, step, ...(snippetId ? { snippet_id: snippetId } : {}) },
      });
      if (result.kind !== "response" || !result.ok) return null;
      const text = (result.body as { text?: unknown } | null)?.text;
      return typeof text === "string" && text.trim() ? text.trim() : null;
    } catch {
      return null;
    }
  })();
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs));
  return Promise.race([ask, late]);
}
