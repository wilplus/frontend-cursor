"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchRecordingRoots } from "@/services/api/idealText";
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

/** The read itself. `refresh` asks for a fresh read; `readOf` says which
 *  refresh the current map answers, so a read that started before a save
 *  landed is never taken as confirming it. */
function useHeadlineRead(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
  refresh: number,
): { headlines: Map<string, string>; readOf: number } {
  const [read, setRead] = useState<{ headlines: Map<string, string>; readOf: number }>(
    () => ({ headlines: new Map(), readOf: -1 }),
  );
  useEffect(() => {
    if (!arcId || sheetOpen) return;
    let alive = true;
    void fetchRecordingRoots(arcId).then((result) => {
      if (!alive) return;
      setRead({
        headlines: result.kind === "ready" ? paragraphHeadlines(result.roots) : new Map(),
        readOf: refresh,
      });
    });
    return () => {
      alive = false;
    };
  }, [arcId, document, sheetOpen, refresh]);
  return read;
}

type Pending = { text: string; settledAt: number | null };

/** Helper words shown the moment they are chosen (founder 2026-09-28, "2A").
 *
 *  The save runs behind the sheet, and the headline used to wait for a
 *  fresh read of the locked roots after it. Now the tapped words stand in
 *  at once: they are exactly the words being saved. When the save lands, a
 *  fresh read is asked for, and the stand-in goes as soon as a read started
 *  after the save arrives. A failed save takes the stand-in back at once;
 *  the existing failure notice says so. Choosing new words replaces the
 *  paragraph's old ones (clause 13), so the stand-in replaces, never joins. */
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
    setPending((prev) => {
      const next = new Map(
        [...prev].filter(([, p]) => p.settledAt === null || p.settledAt > read.readOf),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [read]);

  const expect = useCallback((partId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPending((prev) => new Map(prev).set(partId, { text: trimmed, settledAt: null }));
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
