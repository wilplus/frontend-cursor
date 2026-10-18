import { useEffect, useMemo, useState } from "react";
import { fetchPraiseReasons } from "@/services/api/praiseReasons";
import type { PraiseReason, WalkPraiseReasons } from "@/lib/willab/praiseReason";

/** How often, and how many times, the walk asks for a reason still being
 *  written. GPT writes one in a few seconds; past this the walk shows the
 *  praise it had before (founder 2026-10-18). */
const ASK_EVERY_MS = 2500;
const ASK_AT_MOST = 8;

/** The reasons for green clips that reached the page without one: asked for
 *  until each is written or the walk stops waiting. Nothing is asked when
 *  every green row already carries its reason. */
export function useGreenReasons(
  arcId: string | null,
  takeSessionId: string | null,
  snippetIds: readonly string[],
): WalkPraiseReasons {
  const key = snippetIds.join(",");
  const [reasons, setReasons] = useState<Readonly<Record<string, PraiseReason>>>({});
  const [pending, setPending] = useState<ReadonlySet<string> | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    setPending(null);
    setDone(false);
    if (!arcId || !takeSessionId || ids.length === 0) {
      setDone(true);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const ask = async () => {
      const read = await fetchPraiseReasons(arcId, takeSessionId, ids);
      if (stopped) return;
      tries += 1;
      // A failed read stops the wait at once: the praise the walk had
      // before stands, never an empty screen.
      if (!read) {
        setDone(true);
        return;
      }
      setReasons((had) => ({ ...had, ...read.reasons }));
      setPending(new Set(read.pending));
      if (read.pending.length === 0 || tries >= ASK_AT_MOST) {
        setDone(true);
        return;
      }
      timer = setTimeout(() => void ask(), ASK_EVERY_MS);
    };
    void ask();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [arcId, takeSessionId, key]);

  return useMemo(
    () => ({
      of: (id) => (id ? reasons[id] ?? null : null),
      waiting: (id) => {
        if (!id || done || reasons[id]) return false;
        const asked = key.split(",").includes(id);
        return asked && (pending === null || pending.has(id));
      },
    }),
    [reasons, pending, done, key],
  );
}
