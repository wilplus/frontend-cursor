"use client";

import { useCallback, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Tap and go (founder 2026-09-28).                                          */
/*                                                                            */
/*  Three taps on the Ideal Text sheets used to wait for the server before    */
/*  the sheet moved on: the Confident Voice answer, "Use these helper words"  */
/*  and "Use this phrase". The server only acknowledges those writes; the    */
/*  next screen needs nothing from its reply. So the sheet moves on at once   */
/*  and the write runs here, in the deck, which outlives the sheet.           */
/*                                                                            */
/*  A failure cannot use the sheet's red box, because the sheet has gone. It */
/*  becomes one notice with Retry. Retry sends the SAME write again, so the   */
/*  speaker's answer is kept rather than thrown away. A refusal that another */
/*  try cannot fix (a newer Take replaced this one, a lock the server blocks) */
/*  shows the notice without Retry.                                           */
/* -------------------------------------------------------------------------- */

/** What one background write came to. `final` failed in a way a retry of the
 *  same request cannot change. */
export type BehindOutcome = "ok" | "failed" | "final";

export type SaveBehind = (
  task: () => Promise<BehindOutcome>,
  failText: string,
) => void;

export type BehindNotice = { text: string; retry: (() => void) | null };

export function useSaveBehind(): {
  saveBehind: SaveBehind;
  notice: BehindNotice | null;
  dismiss: () => void;
} {
  const [notice, setNotice] = useState<BehindNotice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  const saveBehind = useCallback<SaveBehind>((task, failText) => {
    const run = () => {
      void task()
        .catch((): BehindOutcome => "failed")
        .then((outcome) => {
          if (outcome === "ok") return;
          setNotice({
            text: failText,
            retry:
              outcome === "failed"
                ? () => {
                    setNotice(null);
                    run();
                  }
                : null,
          });
        });
    };
    run();
  }, []);
  return { saveBehind, notice, dismiss };
}

/** "Use this phrase" in the paragraph sheet, run behind it: the words and
 *  the lock together. A lock the server blocks cannot be retried away. */
export async function helperWordsBehind<
  C extends { part: { text: string } },
  S,
>(
  setRoot: (chunk: C, span: S) => Promise<boolean>,
  lock: (chunk: C, text: string) => Promise<{ outcome: string }>,
  chunk: C,
  span: S,
): Promise<BehindOutcome> {
  const [saved, result] = await Promise.all([
    setRoot(chunk, span),
    lock(chunk, chunk.part.text),
  ]);
  if (result.outcome === "blocked") return "final";
  return saved && result.outcome === "ok" ? "ok" : "failed";
}

/** Helper words from an earlier Take, then the lock (founder lock
 *  2026-09-30, B4, D5): the words go to the Slide, the lock to the
 *  paragraph as it is. A blocked lock is final. */
export async function helperWordsFromTakeBehind<
  C extends { part: { text: string } },
>(
  setFromTake: (chunk: C, phrase: string, takeIndex: number) => Promise<boolean>,
  lock: (chunk: C, text: string) => Promise<{ outcome: string }>,
  chunk: C,
  phrase: string,
  takeIndex: number,
): Promise<BehindOutcome> {
  const saved = await setFromTake(chunk, phrase, takeIndex);
  if (!saved) return "failed";
  const result = await lock(chunk, chunk.part.text);
  if (result.outcome === "blocked") return "final";
  return result.outcome === "ok" ? "ok" : "failed";
}

/** Delete the helper words (founder lock 2026-09-30, D4): the paragraph's
 *  span is cleared and the lock lifted. Without an unlock the words alone
 *  are cleared. */
export async function deleteHelperWordsBehind<C>(
  setRoot: (chunk: C, span: null) => Promise<boolean>,
  unlock: ((chunk: C) => Promise<boolean>) | null | undefined,
  chunk: C,
): Promise<BehindOutcome> {
  const cleared = await setRoot(chunk, null);
  const unlocked = unlock ? await unlock(chunk) : true;
  return cleared && unlocked ? "ok" : "failed";
}
