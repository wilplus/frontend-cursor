"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  BACK / NEXT ACROSS THE BOOKMARKS (founder 2026-09-25, Q29 A–Q32 A).        */
/*                                                                            */
/*  Every bookmark of the latest Take, in text order (Q30 A): a paragraph     */
/*  with feedback still waiting, feedback already answered, or a coach        */
/*  moment. The sheets draw their own content; this owns only the walk and   */
/*  the bar, which is copied from the coach panel's footer so the two read    */
/*  as one product: an outlined "← Back" and a black right-hand button.       */
/*                                                                            */
/*  Q31 B: the right-hand button always reads "Next" (never "Skip").          */
/*  Q32 A: on the last bookmark it reads "Done" and closes the sheet.         */
/*  Q28 A: the email and the chat bubble land on the first coach-reviewed     */
/*  bookmark, in text order — never on one that only waits for a judgement.  */
/* -------------------------------------------------------------------------- */

export interface Bookmark {
  partId: string;
  chunk: DeckChunk;
  /** The coach's moment on this paragraph, when there is one. */
  bundleId: string | null;
  /** The coach reviewed this moment. */
  coach: boolean;
}

export interface Pager {
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
}

type MarkerLite = { bundleId: string; hasCoachUpdate: boolean };

/** The bookmarks, one per paragraph, in text order. Pure. */
export function buildBookmarks(
  chunks: readonly DeckChunk[],
  feedbackOf: (chunk: DeckChunk) => { pending: number; decided: number },
  markersOf: (partId: string) => readonly MarkerLite[] | undefined,
): Bookmark[] {
  const seen = new Set<string>();
  const out: Bookmark[] = [];
  for (const chunk of chunks) {
    const id = chunk.part.id;
    if (seen.has(id)) continue;
    const markers = markersOf(id) ?? [];
    const { pending, decided } = feedbackOf(chunk);
    if (markers.length === 0 && pending === 0 && decided === 0) continue;
    seen.add(id);
    out.push({
      partId: id,
      chunk,
      bundleId: markers[0]?.bundleId ?? null,
      coach: markers.some((m) => m.hasCoachUpdate),
    });
  }
  return out;
}

/** Where the email and the chat bubble land (Q28 A, Q29): the first coach-
 *  reviewed bookmark in text order; failing that, the first coach moment.
 *  Never a bookmark that only waits for a judgement. -1 when there is none. */
export function landingIndex(bookmarks: readonly Bookmark[]): number {
  const coach = bookmarks.findIndex((b) => b.coach);
  return coach >= 0 ? coach : bookmarks.findIndex((b) => b.bundleId !== null);
}

/** The bar, copied from the coach panel's footer (CoachJudgementQueue). */
export function FeedbackPagerBar({ pager }: { pager: Pager | null | undefined }) {
  if (!pager) return null;
  const last = pager.index >= pager.total - 1;
  return (
    <div
      data-testid="feedback-pager"
      className="shrink-0 border-t border-border px-4 py-3"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
        <button
          type="button"
          onClick={pager.onBack}
          disabled={pager.index === 0}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-[15px] text-foreground disabled:opacity-40"
        >
          <ArrowLeft className="h-[17px] w-[17px]" aria-hidden />
          {COPY.pagerBack}
        </button>
        <button
          type="button"
          onClick={pager.onNext}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background"
        >
          {last ? COPY.pagerDone : COPY.pagerNext}
        </button>
      </div>
    </div>
  );
}

/** The walk: which bookmark is open, and how Back / Next move it. The host
 *  says how to open one bookmark and how to close every sheet. */
export function useFeedbackPager(args: {
  bookmarks: readonly Bookmark[];
  open: (bookmark: Bookmark) => void;
  closeAll: () => void;
  /** Land on the coach's feedback once the deck is ready (the email link and
   *  the chat bubble). */
  openFeedback: boolean;
  ready: boolean;
}): {
  pager: Pager | null;
  openAt: (index: number) => void;
  openPart: (partId: string) => boolean;
  stop: () => void;
} {
  const { bookmarks, open, closeAll, openFeedback, ready } = args;
  const [at, setAt] = useState<number | null>(null);
  const landed = useRef(false);

  const openAt = useCallback(
    (index: number) => {
      const bookmark = bookmarks[index];
      if (!bookmark) return;
      setAt(index);
      open(bookmark);
    },
    [bookmarks, open],
  );

  const stop = useCallback(() => setAt(null), []);

  /** A tap on a mark or a paragraph joins the walk at that bookmark. */
  const openPart = useCallback(
    (partId: string) => {
      const index = bookmarks.findIndex((b) => b.partId === partId);
      if (index < 0) return false;
      openAt(index);
      return true;
    },
    [bookmarks, openAt],
  );

  useEffect(() => {
    if (!openFeedback || landed.current || !ready) return;
    const index = landingIndex(bookmarks);
    if (index < 0) return;
    landed.current = true;
    openAt(index);
  }, [openFeedback, ready, bookmarks, openAt]);

  const pager = useMemo<Pager | null>(() => {
    if (at === null || bookmarks.length === 0) return null;
    return {
      index: at,
      total: bookmarks.length,
      onBack: () => openAt(Math.max(0, at - 1)),
      onNext: () => {
        if (at >= bookmarks.length - 1) {
          setAt(null);
          closeAll();
          return;
        }
        openAt(at + 1);
      },
    };
  }, [at, bookmarks.length, openAt, closeAll]);

  return { pager, openAt, openPart, stop };
}
