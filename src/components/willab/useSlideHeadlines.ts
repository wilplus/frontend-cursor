"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRecordingRoots,
  type RecordingRootsResult,
} from "@/services/api/idealText";
import { paragraphHeadlines } from "@/lib/willab/answeredBookmark";

/** Each paragraph's helper words as its headline (founder 2026-09-26: above
 *  the paragraph they came from, superseding one headline per Slide).
 *
 *  Read from the same locked roots the recording screen shows, so the page
 *  and the next Take can never disagree about which words are whose.
 *  Re-read whenever the document changes and whenever a sheet closes — the
 *  lock that sets them happens inside the sheet. A failed read draws no
 *  headline rather than a stale one. */
export function useParagraphHeadlines(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
): Map<string, string> {
  return useHeadlineRead(arcId, document, sheetOpen, 0).headlines;
}

/** The page's helper words for Presentation Mode and export (F1 Repair Plan
 *  Phase 5). LAST CONFIGURATION (founder 2026-10-05: "export should show the
 *  paragraphs that stayed, like the last configuration"): read with the page,
 *  not when Export opens, so a quick download has them; and null until a read
 *  has succeeded, so the caller knows when the map is the page's whole answer
 *  (a paragraph absent from it has no helper words) and when it must fall
 *  back to the document's own. */
export function useDeliveryHeadlines(
  arcId: string | null,
  document: string,
): Map<string, string> | null {
  const read = useHeadlineRead(arcId, document, false, 0);
  return read.ready ? read.headlines : null;
}

/* -------------------------------------------------------------------------- */
/*  ONE ROOTS READ PER ARC, SHARED (founder 2026-10-08, F4).                   */
/*                                                                            */
/*  The page and the deck each asked for the recording roots, and again on    */
/*  every document change. The deck mounts only after the core read lands, so  */
/*  its headlines started ~450 ms behind the text. Now the page's read starts  */
/*  at mount and the deck joins it: one read per arc at a time, kept with its  */
/*  answer, like paragraphSheetData's cache.                                   */
/*                                                                            */
/*  A read is shared only when it is still news:                              */
/*    "mount"   a first read (or the first text after an empty one) joins any */
/*              read of the arc started within SHARE_WINDOW_MS that has not   */
/*              failed;                                                       */
/*    "change"  a document change joins only a read started in the same      */
/*              effect flush (before a microtask passes), so the page and the */
/*              deck seeing one change ask once, and never adopt a read from  */
/*              before it;                                                    */
/*    "fresh"   a sheet closing or a refresh after a save always reads anew,  */
/*              so a confirmation only ever comes from a read that started    */
/*              after the save (2A).                                          */
/* -------------------------------------------------------------------------- */

export const SHARE_WINDOW_MS = 5_000;

export type RootsNeed = "mount" | "change" | "fresh";

interface SharedRootsRead {
  startedAt: number;
  /** True until a microtask passes: the effects of one commit run in one
   *  synchronous flush, so this is "started by this same commit". */
  sameFlush: boolean;
  promise: Promise<RecordingRootsResult>;
  result: RecordingRootsResult | null;
}

const sharedRootsReads = new Map<string, SharedRootsRead>();

/** Whether a read already started may answer this need. Pure. */
export function mayShareRootsRead(
  read:
    | { startedAt: number; sameFlush: boolean; result: { kind: string } | null }
    | undefined,
  need: RootsNeed,
  now: number,
): boolean {
  if (!read || need === "fresh") return false;
  if (read.result && read.result.kind !== "ready") return false;
  if (need === "change") return read.sameFlush;
  const age = now - read.startedAt;
  return age >= 0 && age <= SHARE_WINDOW_MS;
}

/** The arc's roots read for `need`: the shared one when it may answer,
 *  otherwise a new read that becomes the shared one. */
export function readRecordingRootsShared(
  arcId: string,
  need: RootsNeed,
  now: number = Date.now(),
): Promise<RecordingRootsResult> {
  const last = sharedRootsReads.get(arcId);
  if (last && mayShareRootsRead(last, need, now)) return last.promise;
  const read: SharedRootsRead = {
    startedAt: now,
    sameFlush: true,
    promise: fetchRecordingRoots(arcId),
    result: null,
  };
  queueMicrotask(() => {
    read.sameFlush = false;
  });
  read.promise = read.promise.then((result) => {
    read.result = result;
    return result;
  });
  sharedRootsReads.set(arcId, read);
  return read.promise;
}

/** The arc's last answered read, when it may still seed a first render. */
function sharedRootsSeed(arcId: string | null): Map<string, string> | null {
  const last = arcId ? sharedRootsReads.get(arcId) : undefined;
  if (!last?.result || last.result.kind !== "ready") return null;
  if (!mayShareRootsRead(last, "mount", Date.now())) return null;
  return paragraphHeadlines(last.result.roots);
}

/** Test fence: forget every shared read. */
export function forgetHeadlineReads(): void {
  sharedRootsReads.clear();
}

/** What this run of the read effect needs, from what changed since the last
 *  run of the same hook. Pure. */
export function rootsNeedFor(
  prev: { document: string | null; sheetOpen: boolean; refresh: number },
  next: { document: string; sheetOpen: boolean; refresh: number },
): RootsNeed {
  if (next.refresh !== prev.refresh) return "fresh";
  if (prev.sheetOpen && !next.sheetOpen) return "fresh";
  if (prev.document && prev.document !== next.document) return "change";
  return "mount";
}

/** The read itself. `refresh` asks for a fresh read; `readOf` says which
 *  refresh the current map answers, so a read that started before a save
 *  landed is never taken as confirming it. */
function useHeadlineRead(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
  refresh: number,
): { headlines: Map<string, string>; readOf: number; ready: boolean } {
  const [read, setRead] = useState<{ headlines: Map<string, string>; readOf: number; ready: boolean }>(
    () => {
      const seed = sharedRootsSeed(arcId);
      return { headlines: seed ?? new Map(), readOf: -1, ready: seed !== null };
    },
  );
  const lastRunRef = useRef<{
    arcId: string | null;
    document: string | null;
    sheetOpen: boolean;
    refresh: number;
  }>({ arcId, document: null, sheetOpen: false, refresh });
  useEffect(() => {
    const prev = lastRunRef.current;
    lastRunRef.current = { arcId, document, sheetOpen, refresh };
    if (!arcId || sheetOpen) return;
    const need =
      prev.arcId === arcId
        ? rootsNeedFor(prev, { document, sheetOpen, refresh })
        : "mount";
    let alive = true;
    void readRecordingRootsShared(arcId, need).then((result) => {
      if (!alive) return;
      // A read that failed or met the document mid-change (a lock landing)
      // keeps the words already shown rather than wiping every headline.
      setRead((prev) => ({
        headlines: result.kind === "ready" ? paragraphHeadlines(result.roots) : prev.headlines,
        readOf: refresh,
        ready: prev.ready || result.kind === "ready",
      }));
    });
    return () => {
      alive = false;
    };
  }, [arcId, document, sheetOpen, refresh]);
  return read;
}

type Pending = { text: string; settledAt: number | null; tries: number };

/** How often a read after the save may still come back without the words,
 *  and how long to wait before asking again. */
export const CONFIRM_TRIES = 5;
export const CONFIRM_RETRY_MS = 700;

/** The server's headline for the paragraph already carries the words. */
function confirms(headline: string | undefined, text: string): boolean {
  return Boolean(headline && headline.toLowerCase().includes(text.toLowerCase()));
}

/** What a read does to the stand-ins: those it carries go; those a read
 *  after their save came back without ask again while tries remain, and
 *  then go too. */
export function afterRead(
  pending: ReadonlyMap<string, Pending>,
  read: { headlines: Map<string, string>; readOf: number },
): { next: ReadonlyMap<string, Pending>; again: boolean } {
  let changed = false;
  let again = false;
  const next = new Map<string, Pending>();
  for (const [partId, p] of pending) {
    const answered = p.settledAt !== null && p.settledAt <= read.readOf;
    if (answered && confirms(read.headlines.get(partId), p.text)) {
      changed = true;
      continue;
    }
    if (answered && p.tries < CONFIRM_TRIES) {
      changed = true;
      again = true;
      next.set(partId, { ...p, settledAt: read.readOf + 1, tries: p.tries + 1 });
      continue;
    }
    if (answered) {
      // Out of tries: the server's answer stands.
      changed = true;
      continue;
    }
    next.set(partId, p);
  }
  return { next: changed ? next : pending, again };
}

/** Helper words shown the moment they are chosen (founder 2026-09-28, "2A").
 *
 *  The save runs behind the sheet, and the headline used to wait for a
 *  fresh read of the locked roots after it. Now the tapped words stand in
 *  at once: they are exactly the words being saved. When the save lands, a
 *  fresh read is asked for, and the stand-in goes as soon as a read started
 *  after the save arrives. A failed save takes the stand-in back at once;
 *  the existing failure notice says so. Choosing new words replaces the
 *  paragraph's old ones (clause 13), so the stand-in replaces, never joins.
 *
 *  The stand-in goes only when a read CARRIES the words (founder 2026-09-29,
 *  "tap and go"). The words and the lock are two writes sent together, and
 *  the server shows helper words only on a locked paragraph. When the words
 *  landed first, the read after them came back without them, the stand-in
 *  went, and the words vanished until some later read. Now a read without
 *  them asks again shortly (CONFIRM_TRIES × CONFIRM_RETRY_MS), long enough
 *  for the lock to land; after that the server's answer stands. */
export function useHeadlinesWithPending(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
): {
  headlines: Map<string, string>;
  expect: (partId: string, text: string) => void;
  settle: (partId: string, saved: boolean) => void;
} {
  const [refresh, setRefresh] = useState(0);
  const refreshRef = useRef(0);
  const [pending, setPending] = useState<ReadonlyMap<string, Pending>>(new Map());
  const read = useHeadlineRead(arcId, document, sheetOpen, refresh);

  useEffect(() => {
    const { next, again } = afterRead(pending, read);
    if (next !== pending) setPending(next);
    if (!again) return;
    const timer = setTimeout(() => {
      refreshRef.current = Math.max(refreshRef.current, read.readOf) + 1;
      setRefresh(refreshRef.current);
    }, CONFIRM_RETRY_MS);
    return () => clearTimeout(timer);
    // Runs per read only: `pending` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read]);

  const expect = useCallback((partId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPending((prev) => new Map(prev).set(partId, { text: trimmed, settledAt: null, tries: 0 }));
  }, []);

  const settle = useCallback((partId: string, saved: boolean) => {
    if (!saved) {
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(partId);
        return next;
      });
      return;
    }
    refreshRef.current += 1;
    const at = refreshRef.current;
    setPending((prev) => {
      const p = prev.get(partId);
      return p ? new Map(prev).set(partId, { ...p, settledAt: at }) : prev;
    });
    setRefresh(at);
  }, []);

  const headlines = useMemo(() => {
    if (pending.size === 0) return read.headlines;
    const merged = new Map(read.headlines);
    for (const [partId, p] of pending) merged.set(partId, p.text);
    return merged;
  }, [read.headlines, pending]);

  return { headlines, expect, settle };
}

/** The headline above a paragraph — on its first slice only, when a long
 *  paragraph runs across screens. */
export function headlineFor(
  headlines: Map<string, string>,
  partId: string,
  sliceIndex: number | undefined,
): string | null {
  if ((sliceIndex ?? 0) > 0) return null;
  return headlines.get(partId) ?? null;
}

/** A DELETED SET LEAVES THE PAGE AT ONCE (founder lock 2026-09-30, D4).
 *  The delete runs behind the sheet; until a read after it comes back
 *  without the words, the page would still draw the old headline. The
 *  dropped paragraph is withheld from the shown map until a read arrives
 *  that no longer carries it. */
export function useDroppedHeadlines(
  headlines: Map<string, string>,
): { headlines: Map<string, string>; drop: (partId: string) => void } {
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (dropped.size === 0) return;
    const still = new Set([...dropped].filter((id) => headlines.has(id)));
    if (still.size !== dropped.size) setDropped(still);
    // Runs per read: `dropped` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlines]);
  const shown = useMemo(() => {
    if (dropped.size === 0) return headlines;
    const out = new Map(headlines);
    for (const id of dropped) out.delete(id);
    return out;
  }, [headlines, dropped]);
  const drop = useCallback((partId: string) => {
    setDropped((prev) => new Set(prev).add(partId));
  }, []);
  return { headlines: shown, drop };
}
