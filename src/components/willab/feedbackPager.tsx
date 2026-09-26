"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  /** Where the open bookmark sits ("Slide 2"), for the header. */
  label?: string | null;
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

/** ONE NAVIGATION, AT THE TOP (founder 2026-09-26, Ideal Text redesign B).
 *  It used to be an outlined Back and a black Next at the bottom of every
 *  sheet, under the step's own black button — two black buttons stacked, and
 *  the reader could not tell which one moved on. Now the step's button is
 *  the only black one, and the walk is a slim header: ‹ Slide 2 · moment 1
 *  of 4 ›. Back is off on the first; on the last the › is Done (Q32 A). */
export function FeedbackPagerBar({ pager }: { pager: Pager | null | undefined }) {
  if (!pager) return null;
  const last = pager.index >= pager.total - 1;
  const position = `${COPY.pagerMoment} ${pager.index + 1} ${COPY.pagerOf} ${pager.total}`;
  return (
    <nav
      data-testid="feedback-pager"
      aria-label={position}
      className="flex shrink-0 items-center justify-between gap-2 px-3 pt-1"
    >
      <button
        type="button"
        onClick={pager.onBack}
        disabled={pager.index === 0}
        aria-label={COPY.pagerBack}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
        {pager.label ? `${pager.label} · ${position}` : position}
      </p>
      <button
        type="button"
        onClick={pager.onNext}
        aria-label={last ? COPY.pagerDone : COPY.pagerNext}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </nav>
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
  /** Where a bookmark sits ("Slide 2"), shown in the header. */
  labelOf?: (bookmark: Bookmark) => string | null;
}): {
  pager: Pager | null;
  openAt: (index: number) => void;
  openPart: (partId: string) => boolean;
  stop: () => void;
} {
  const { bookmarks, open, closeAll, openFeedback, ready, labelOf } = args;
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
    const bookmark = bookmarks[at];
    return {
      index: at,
      total: bookmarks.length,
      label: bookmark && labelOf ? labelOf(bookmark) : null,
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
  }, [at, bookmarks, openAt, closeAll, labelOf]);

  return { pager, openAt, openPart, stop };
}
