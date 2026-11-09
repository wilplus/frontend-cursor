import { bffFetch } from "@/lib/api/bffFetch";

/* Will's voice in the walk (backend N565; services/walk_voice.py; rules:
   docs/flows/feedback-walk-and-chat.md K). For a speaker the `walk_voice`
   ring reaches, Will's message for a step is written from what is known
   about the Take, by the rules the founder sets. Any failure, a late answer
   or an answer refused by the server's check is null: the walk says its
   signed line, and never waits longer than the step's wait. */

/** The ring feature that turns Will's written messages on. */
export const WALK_VOICE_FEATURE = "walk_voice";
/** How long the walk waits for Will's words before its signed line. */
export const WALK_VOICE_WAIT_MS = 4_000;
/** After a try the walk has already waited on the check: less. */
export const WALK_VOICE_AFTER_TRY_WAIT_MS = 3_000;

export type WalkVoiceStep = "praise" | "try" | "after_try" | "good_take" | "reply";
/** How a try went, as the walk read it. */
export type WalkVoiceTry = { outcome: "landed" | "once_more" | "last"; moved?: string };

export type WalkVoiceAsk = {
  takeId: string;
  step: WalkVoiceStep;
  snippetId: string | null;
  /** The moment to try's tool. */
  tool?: "clearer" | "voice";
  /** After a try: how it went. */
  theirTry?: WalkVoiceTry;
};

export async function askWalkVoice(ask: WalkVoiceAsk): Promise<string | null> {
  const waitMs = ask.step === "after_try" ? WALK_VOICE_AFTER_TRY_WAIT_MS : WALK_VOICE_WAIT_MS;
  const call = (async () => {
    try {
      const result = await bffFetch("/api/v2/walk-voice", {
        method: "POST",
        cache: "no-store",
        json: {
          take_id: ask.takeId,
          step: ask.step,
          ...(ask.snippetId ? { snippet_id: ask.snippetId } : {}),
          ...(ask.tool ? { tool: ask.tool } : {}),
          ...(ask.theirTry ? { their_try: ask.theirTry } : {}),
        },
      });
      if (result.kind !== "response" || !result.ok) return null;
      const text = (result.body as { text?: unknown } | null)?.text;
      return typeof text === "string" && text.trim() ? text.trim() : null;
    } catch {
      return null;
    }
  })();
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs));
  return Promise.race([call, late]);
}
