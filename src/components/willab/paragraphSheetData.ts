"use client";

import { useEffect, useState } from "react";
import {
  fetchOwnerAnswers,
  fetchParagraphHistory,
  type OwnerAnswer,
  type ParagraphHistory,
} from "@/services/api/bookmarkHistory";

/* -------------------------------------------------------------------------- */
/*  The paragraph sheet opens complete (founder 2026-09-28, "1A").            */
/*                                                                            */
/*  The sheet needs two reads: the owner's answers for the Take, and the      */
/*  paragraph's history. It used to fetch both on opening, so it appeared     */
/*  with "Now" and no answer, then "Take 1 · Now", the answer and "Choose     */
/*  your helper words" popped in. Now the Ideal Text page reads them ahead,   */
/*  while the speaker reads, for every paragraph that opens this sheet, and   */
/*  the sheet takes them from here.                                           */
/*                                                                            */
/*  When a read is still in flight at the tap, the sheet waits for it and     */
/*  opens complete, never half-drawn. OPEN_WAIT_MS bounds that wait on a      */
/*  very slow connection; after it, the sheet opens with what it has.         */
/*                                                                            */
/*  A refresh never throws a read away (founder 2026-09-29, "tap and go").   */
/*  Each close reads everything ahead again, so the last sheet's answer or    */
/*  lock shows in the next one. It used to replace every finished read with  */
/*  an unfinished one, so a sheet opened right after a close drew only "Now" */
/*  and filled in "Take 2 · Now" and the earlier Takes a moment later. Now   */
/*  the last finished read keeps serving until the new one lands; only what  */
/*  actually changed updates, in place.                                       */
/*                                                                            */
/*  Timing only. What the sheet shows, and where, is the locked design's.     */
/* -------------------------------------------------------------------------- */

/** `done` means `value` can be shown: the read landed, or an earlier read of
 *  the same thing did and still stands in while this one is in flight. */
type Entry<T> = { promise: Promise<T>; done: boolean; value: T | undefined };

const histories = new Map<string, Entry<ParagraphHistory | null>>();
const answersByTake = new Map<string, Entry<OwnerAnswer[]>>();

export const OPEN_WAIT_MS = 2000;

function historyKey(arcId: string, partId: string): string {
  return `${arcId}:${partId}`;
}

function remember<T>(map: Map<string, Entry<T>>, key: string, load: () => Promise<T>): Entry<T> {
  const before = map.get(key);
  const entry: Entry<T> = {
    promise: Promise.resolve(undefined as T),
    done: before?.done ?? false,
    value: before?.done ? before.value : undefined,
  };
  entry.promise = load().then((value) => {
    entry.value = value;
    entry.done = true;
    return value;
  });
  map.set(key, entry);
  return entry;
}

/** Read ahead, replacing whatever was cached: the page calls this whenever
 *  no sheet is open, so an answer or a lock made in the last sheet is read
 *  fresh before the next one opens. */
export function prefetchParagraphSheets(
  arcId: string | null,
  takeSessionId: string | null,
  partIds: readonly string[],
): void {
  if (takeSessionId) remember(answersByTake, takeSessionId, () => fetchOwnerAnswers(takeSessionId));
  if (!arcId) return;
  for (const partId of partIds) {
    remember(histories, historyKey(arcId, partId), () => fetchParagraphHistory(arcId, partId));
  }
}

/** THE ANSWER JUST GIVEN STANDS IN THE READ AT ONCE (founder QA1 A,
 *  D-FW-9). The answer saves behind the sheet (tap and go), and the next
 *  read ahead runs only once every sheet is closed; until then ‹ back to the
 *  moment must show the answer the speaker gave, not the one before it. The
 *  cached read takes it in place, and a read still in flight takes it when
 *  it lands. The next read ahead replaces it with the server's. */
export function noteOwnAnswer(
  takeSessionId: string,
  feedbackId: string,
  response: string,
): void {
  const entry = answersByTake.get(takeSessionId);
  if (!entry) return;
  const withAnswer = (answers: OwnerAnswer[] | undefined): OwnerAnswer[] => [
    ...(answers ?? []).filter((a) => a.feedbackId !== feedbackId),
    { feedbackId, response },
  ];
  if (entry.done) entry.value = withAnswer(entry.value);
  entry.promise = entry.promise.then((answers) => {
    entry.value = withAnswer(answers);
    return entry.value;
  });
}

export interface SheetData {
  history: ParagraphHistory | null;
  answers: OwnerAnswer[];
}

function historyEntry(arcId: string | null, partId: string) {
  if (!arcId) return null;
  const key = historyKey(arcId, partId);
  return histories.get(key) ?? remember(histories, key, () => fetchParagraphHistory(arcId, partId));
}

function answersEntry(takeSessionId: string | null) {
  if (!takeSessionId) return null;
  return answersByTake.get(takeSessionId)
    ?? remember(answersByTake, takeSessionId, () => fetchOwnerAnswers(takeSessionId));
}

/** What the sheet can show right now, or null while a read is in flight. */
export function readySheetData(
  arcId: string | null,
  takeSessionId: string | null,
  partId: string,
): SheetData | null {
  const h = arcId ? histories.get(historyKey(arcId, partId)) : null;
  const a = takeSessionId ? answersByTake.get(takeSessionId) : null;
  if ((arcId && !h?.done) || (takeSessionId && !a?.done)) return null;
  return { history: h?.value ?? null, answers: a?.value ?? [] };
}

/** The sheet's data: at once when read ahead, else once both reads land
 *  (or OPEN_WAIT_MS passes). `null` means "don't draw the sheet yet". */
export function useParagraphSheetData(
  arcId: string | null,
  takeSessionId: string | null,
  partId: string,
): SheetData | null {
  const [data, setData] = useState<SheetData | null>(() =>
    readySheetData(arcId, takeSessionId, partId));
  useEffect(() => {
    let alive = true;
    const h = historyEntry(arcId, partId);
    const a = answersEntry(takeSessionId);
    const timer = setTimeout(() => {
      if (alive) setData((prev) => prev ?? { history: h?.value ?? null, answers: a?.value ?? [] });
    }, OPEN_WAIT_MS);
    void Promise.all([h?.promise ?? null, a?.promise ?? []]).then(([history, answers]) => {
      if (alive) setData({ history: history ?? null, answers: answers ?? [] });
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [arcId, takeSessionId, partId]);
  return data;
}

/** True while `waiting`, for at most OPEN_WAIT_MS from the first render.
 *  Lets a sheet hold for the Take's feedback, which arrives a moment after
 *  the text (founder 2026-09-28), without ever holding a tap indefinitely. */
export function useBoundedWait(waiting: boolean): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setExpired(true), OPEN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  return waiting && !expired;
}

/** The page's side: read ahead for every paragraph that opens this sheet,
 *  each time no sheet is open. */
export function usePrefetchParagraphSheets(
  arcId: string | null,
  takeSessionId: string | null,
  partIds: readonly string[],
  sheetOpen: boolean,
): void {
  const key = partIds.join("|");
  useEffect(() => {
    if (sheetOpen) return;
    prefetchParagraphSheets(arcId, takeSessionId, key ? key.split("|") : []);
  }, [arcId, takeSessionId, key, sheetOpen]);
}

/** Tests only: forget every cached read. */
export function forgetParagraphSheetData(): void {
  histories.clear();
  answersByTake.clear();
}
