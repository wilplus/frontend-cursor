import { useEffect, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import { WALK_VOICE_FEATURE, askWalkVoice, type WalkVoiceAsk } from "@/services/api/walkVoice";

/* Will's written messages in the walk (backend N565): their best, the
   moment to try, a good Take, and his reply after a try. Each is asked
   once per Take, step and moment in the page's life, so the screen and
   the chat say the same words. Off the `walk_voice` ring, or with nothing
   to ask, a message is settled at once with null and the walk says its
   signed line: nobody else waits. */

/** Whether Will's written messages reach this speaker (the walk_voice ring):
 *  null while the page's ring read is still on its way. For the walk's host,
 *  which hands it to the walk. */
export function useWalkVoiceOn(): boolean | null {
  const ring = useRingState();
  return ring === null ? null : ring.featuresOn.has(WALK_VOICE_FEATURE);
}

export type WalkVoiceSaid = { settled: boolean; text: string | null };

/** One message to ask for; `key` names it for the page's life. */
export type WalkVoiceRequest = WalkVoiceAsk & { key: string };

const asked = new Map<string, Promise<string | null>>();
const answered = new Map<string, string | null>();

/** What a message settled on, read without waiting: null until it has. */
export function walkVoiceSaidNow(key: string): WalkVoiceSaid | null {
  return answered.has(key) ? { settled: true, text: answered.get(key) ?? null } : null;
}

/** One of Will's written messages, as the walk draws and tells it.
 *  `voiceOn` null: the ring read is on its way, and the walk waits rather
 *  than draw the signed line and swap it. */
export function useWalkSaid(request: WalkVoiceRequest | null, voiceOn: boolean | null): WalkVoiceSaid {
  const known = voiceOn !== null;
  const key = voiceOn === true && request ? request.key : null;
  const [said, setSaid] = useState<WalkVoiceSaid>(() =>
    !known ? { settled: false, text: null } : key == null ? { settled: true, text: null } : (walkVoiceSaidNow(key) ?? { settled: false, text: null }),
  );
  useEffect(() => {
    if (!known) return;
    if (key == null || !request) {
      setSaid({ settled: true, text: null });
      return;
    }
    const now = walkVoiceSaidNow(key);
    if (now) {
      setSaid(now);
      return;
    }
    let live = true;
    setSaid({ settled: false, text: null });
    let pending = asked.get(key);
    if (!pending) {
      pending = askWalkVoice(request);
      asked.set(key, pending);
    }
    void pending.then((text) => {
      answered.set(key, text);
      if (live) setSaid({ settled: true, text });
    });
    return () => {
      live = false;
    };
    // The request is named by its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, key]);
  return said;
}

/** Will's written praise for their best (the first step he writes). */
export function useBestSaid(takeId: string | null, snippetId: string | null, voiceOn: boolean | null): WalkVoiceSaid {
  const request = takeId && snippetId ? { key: `${takeId}:praise:${snippetId}`, takeId, step: "praise" as const, snippetId } : null;
  return useWalkSaid(request, voiceOn);
}

/** For tests: forget what was asked. */
export function resetWalkVoice(): void {
  asked.clear();
  answered.clear();
}
