import { useEffect, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import { WALK_VOICE_FEATURE, askWalkVoice } from "@/services/api/walkVoice";

/** Whether Will's written messages reach this speaker (the walk_voice ring):
 *  null while the page's ring read is still on its way. For the walk's host,
 *  which hands it to the walk. */
export function useWalkVoiceOn(): boolean | null {
  const ring = useRingState();
  return ring === null ? null : ring.featuresOn.has(WALK_VOICE_FEATURE);
}

/** Will's written praise for their best (backend N565), as the walk draws
 *  and tells it: `settled` once the walk knows what to say, `text` his words
 *  or null for the signed line. Off the `walk_voice` ring, or with no Take
 *  or clip, it is settled at once with null: nobody else waits. Asked once
 *  per Take and clip in the page's life, so the screen and the chat say the
 *  same words. */
export type WalkVoiceSaid = { settled: boolean; text: string | null };

const asked = new Map<string, Promise<string | null>>();
const answered = new Map<string, string | null>();

export function useBestSaid(takeId: string | null, snippetId: string | null, voiceOn: boolean | null): WalkVoiceSaid {
  // The ring is read once per page load and is usually there already; while
  // it is not (null), the walk waits rather than draw the signed line and
  // swap it.
  const known = voiceOn !== null;
  const on = voiceOn === true;
  const key = on && takeId && snippetId ? `${takeId}:${snippetId}` : null;
  const [said, setSaid] = useState<WalkVoiceSaid>(() =>
    !known ? { settled: false, text: null } : key == null ? { settled: true, text: null } : answered.has(key) ? { settled: true, text: answered.get(key) ?? null } : { settled: false, text: null },
  );
  useEffect(() => {
    if (!known) return;
    if (key == null || !takeId) {
      setSaid({ settled: true, text: null });
      return;
    }
    if (answered.has(key)) {
      setSaid({ settled: true, text: answered.get(key) ?? null });
      return;
    }
    let live = true;
    setSaid({ settled: false, text: null });
    let pending = asked.get(key);
    if (!pending) {
      pending = askWalkVoice(takeId, "praise", snippetId);
      asked.set(key, pending);
    }
    void pending.then((text) => {
      answered.set(key, text);
      if (live) setSaid({ settled: true, text });
    });
    return () => {
      live = false;
    };
  }, [known, key, takeId, snippetId]);
  return said;
}

/** For tests: forget what was asked. */
export function resetWalkVoice(): void {
  asked.clear();
  answered.clear();
}
