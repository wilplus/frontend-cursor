"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import DeckChunkModal, {
  type LockOutcome,
} from "@/components/willab/DeckChunkModal";
import DeckLockMark from "@/components/willab/DeckLockMark";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { RichText } from "@/components/willab/RichText";
import { PdfPage } from "@/components/willab/pdfSlides";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import {
  buildDeckChunks,
  coachMomentForChunk,
  groupChunksBySlide,
  styleFor,
  type CoachMomentLite,
  type DeckChunk,
} from "@/lib/willab/deckChunks";
import {
  buildScreens,
  canBubble,
  chunkCounts,
  clampPosition,
  IDLE_WHEEL_GESTURE,
  nearestChunkIndex,
  scrollEdge,
  stepPosition,
  wheelGestureStep,
  type DeckPosition,
  type DeckScreenModel,
  type WheelGestureState,
} from "@/lib/willab/deckScroll";
import type { Part } from "@/lib/willab/documentParts";
import type {
  DecisionHistoryEntry,
  DocumentSuggestion,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  TranscriptReviewDeck — the ideal text as a slide deck (founder 2026-08-11, */
/*  Lovable spec §4). One slide per viewport, scroll-snap, a dots rail, and    */
/*  every chunk wearing exactly one always-clickable lock.                     */
/*                                                                            */
/*  The deck is presentation + routing only. The HOST owns the fetch and the   */
/*  three decide lanes + the lock PUT — passed in as callbacks — so this       */
/*  surface cannot fork the serve/decide/lock contract it renders.             */
/*                                                                            */
/*  VISUAL GRAMMAR (founder 2026-08-11, rewritten): THE TEXT IS NEVER          */
/*  PAINTED. No underline, no wash, no tint — in any state. The three states   */
/*  live entirely in the chunk's icon, and the words stay clean.               */
/*                                                                            */
/*  The underline had to go because of what it did at scale rather than what   */
/*  it meant: it marks the chunk a suggestion sits in, and when a whole talk   */
/*  arrived as ONE chunk it striped all 233 words amber over a single pending  */
/*  note. Even now that chunks are per-slide, a paragraph-wide underline is    */
/*  the wrong grain for a phrase-sized remark, and it makes the one thing the  */
/*  screen exists for — reading your own speech — harder.                      */
/*                                                                            */
/*  Chrome is stripped to match: no frame, no height cap, no footer. The text  */
/*  gets the room.                                                             */
/* -------------------------------------------------------------------------- */

export default function TranscriptReviewDeck({
  title = "",
  statusChip = null,
  chrome = "full",
  document: doc,
  parts,
  suggestions,
  pieceSlideIndexes,
  slideTitles,
  presentationRef = null,
  onAccept,
  onUndoAccept,
  onKeepMine,
  onLockPart,
  onEditSlide,
  onUnlockPart = null,
  onClose,
  styleChanges = null,
  onApplyStyle,
  decisionHistory = null,
  coachMoments = null,
  arcId = null,
}: {
  title?: string;
  /** Optional right-of-title chip (e.g. "Verified"). Qualitative only. */
  statusChip?: string | null;
  /** "full" renders the deck's own header (title · copy · close — Lovable
   *  §4). "stage" renders stage + dots + footer only, for a host that keeps
   *  its own header (the notebook overlay does — its Present/edit/timeline
   *  entries are load-bearing and live outside the deck's scope). */
  chrome?: "full" | "stage";
  document: string;
  parts: readonly Part[] | null;
  suggestions: readonly DocumentSuggestion[];
  pieceSlideIndexes: readonly (number | null)[] | null;
  /** Slide titles by slide index, when the host knows them. Absent → the
   *  kicker says "Slide N" and no title line renders — never a guess. */
  slideTitles?: readonly (string | null)[];
  /** The actual attached/default PDF. When present, Ideal Text and its
   *  slide-scoped editor show the real slide rather than a text substitute. */
  presentationRef?: string | null;
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  onUndoAccept?: (s: DocumentSuggestion) => Promise<boolean>;
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit `newText` for the chunk (when changed) and lock it.
   *
   *  The whole CHUNK goes back, not just its part: the host addresses a lock
   *  by POSITION + WORDS, never by the part id. Identity is derived in two
   *  places — here from the served parts, and in the host from whatever it
   *  last held — and when the backend has no stored parts (any document
   *  never manually edited) both sides mint their own uuids and no id can
   *  ever match. That mismatch is what made every lock fail with
   *  "Couldn't lock this in" on a fresh arc. Position + words is the claim
   *  the lock endpoint verifies anyway. */
  onLockPart: (chunk: DeckChunk, newText: string) => Promise<LockOutcome>;
  /** Save only the current slide's changed paragraphs in one atomic document
   *  edit; all other slides remain byte-for-byte unchanged. */
  onEditSlide: (
    edits: Array<{ chunk: DeckChunk; text: string }>
  ) => Promise<boolean>;
  /** UNDO a lock (founder 2026-08-15). "Discard" on a locked chunk is the
   *  inverse of "Lock in", not a close — see DeckChunkModal. Optional so a
   *  host without the capability shows no button rather than a dead one. */
  onUnlockPart?: ((chunk: DeckChunk) => Promise<LockOutcome>) | null;
  onClose?: () => void;
  /** THE STYLE LANE (slice 2) — post-lock bold proposals, outside the ≤3.
   *  Modal-only; the page never re-marks locked text. */
  styleChanges?: readonly DocumentSuggestion[] | null;
  onApplyStyle?: (s: DocumentSuggestion) => Promise<boolean>;
  /** PROPOSAL HISTORY (slice 2) — decided proposals, texts included. */
  decisionHistory?: readonly DecisionHistoryEntry[] | null;
  /** THE COACH (slice 4) — the arc's key moments, joined to a chunk by their
   *  anchor so the modal can offer the coach's own note/video on those
   *  words. The message itself loads on demand (that read is metered). */
  coachMoments?: readonly CoachMomentLite[] | null;
  arcId?: string | null;
}) {
  /* §11.7.1 — INSTANT LOCK FEEDBACK (founder 2026-08-14). The modal
   * already closes on a successful lock; what lagged was the PAGE — the
   * lock icon waited for the host's refetch. A confirmed lock is marked
   * optimistically by part id and cleared the moment fresh parts arrive
   * (the server's truth always takes over). Only a "clean" chunk is
   * promoted — pending work still beats the lock (2026-08-11 rule). */
  const [optimisticLocked, setOptimisticLocked] = useState<
    ReadonlySet<string>
  >(new Set());
  /* The same instant feedback for the INVERSE (2026-08-15). Without it a
   * confirmed unlock leaves the mark green until the host refetches, which is
   * the same lag §11.7.1 was written to remove — just in the other
   * direction. Cleared on fresh parts; the server's truth always takes over. */
  const [optimisticUnlocked, setOptimisticUnlocked] = useState<
    ReadonlySet<string>
  >(new Set());
  useEffect(() => {
    setOptimisticLocked(new Set());
    setOptimisticUnlocked(new Set());
  }, [parts]);

  const chunks = useMemo(() => {
    const built = buildDeckChunks(doc, parts, suggestions);
    if (optimisticLocked.size === 0 && optimisticUnlocked.size === 0) {
      return built;
    }
    return built.map((c) => {
      if (c.status === "clean" && optimisticLocked.has(c.part.id)) {
        return { ...c, status: "locked" as const };
      }
      // An unlock never overrides PENDING work — the 2026-08-11 rule that a
      // pending proposal beats the lock cuts both ways, and a chunk with
      // feedback outstanding must keep saying so.
      if (c.status === "locked" && optimisticUnlocked.has(c.part.id)) {
        return {
          ...c,
          status: "clean" as const,
          part: { ...c.part, locked: false },
        };
      }
      return c;
    });
  }, [doc, parts, suggestions, optimisticLocked, optimisticUnlocked]);
  const slideCount = slideTitles?.length ?? null;
  const grouping = useMemo(
    () =>
      groupChunksBySlide(chunks, pieceSlideIndexes, slideCount),
    [chunks, pieceSlideIndexes, slideCount]
  );
  const groups = grouping.ok ? grouping.groups : [];
  /* §11.7.2/§11.7.3 — THE SCREEN GRAIN: the deck's sections are SCREENS
   * (≤3 chunks ≈ 9 lines), and a slide with more chunks CONTINUES on the
   * next screen. The nested scroll steps between screens; the rail shows
   * slide → screen (the chunk grain was cut 2026-08-15 — see the rail). */
  const screens = useMemo(() => buildScreens(groups), [groups]);
  const railSlides = useMemo(() => {
    const out: { slideIndex: number | null; first: number; count: number }[] =
      [];
    screens.forEach((s, i) => {
      const last = out[out.length - 1];
      if (last && last.slideIndex === s.slideIndex) last.count += 1;
      else out.push({ slideIndex: s.slideIndex, first: i, count: 1 });
    });
    return out;
  }, [screens]);

  // The open modal is addressed by PART ID, not by object: an accept
  // reassembles the document underneath the modal, and re-deriving the chunk
  // on every render is what carries the fresh words in.
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const [editingSlideIndex, setEditingSlideIndex] = useState<
    number | null | undefined
  >(undefined);
  useEffect(() => {
    if (grouping.ok) return;
    setOpenPartId(null);
    setEditingSlideIndex(undefined);
  }, [grouping.ok]);
  const openChunk = openPartId
    ? (chunks.find((c) => c.part.id === openPartId) ?? null)
    : null;
  const openSuggestion =
    openChunk && openChunk.pendingIds.length > 0
      ? (suggestions.find((s) => s.id === openChunk.pendingIds[0]) ?? null)
      : null;

  /* ── NESTED SCROLL (SPEC §11.3, founder 2026-08-14) ──────────────────────
   *
   * The chunk is the step, the slide is the section. Each slide keeps its
   * own INNER chunk scroller (overscroll-contained, so reaching the last
   * chunk never auto-chains mid-gesture); the OUTER slide track is
   * programmatic-only (overflow-hidden — native scroll on it would bypass
   * the gate through the kicker area). A gesture bubbles up to a slide
   * change ONLY when the inner scroller already stands at the edge the
   * gesture pushes against — `canBubble` — and each bubble needs a FRESH
   * gesture (the armed/re-arm latch below), so trackpad momentum cannot
   * fly through a slide the reader never saw. Backwards entry lands on
   * the previous slide's LAST chunk, exactly where the reader left it.
   *
   * Within a slide, chunk scrolling stays continuous — chunks are ~4 lines
   * each and several fit a viewport, so a hard stop per chunk would fight
   * reading. Touch stays native; desktop wheel deltas are applied directly
   * so the complete overlay can behave as one surface. The §11.3 contract is
   * the boundary gate, and that is stepped.
   */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef<DeckPosition>({ slide: 0, chunk: 0 });
  const wheelGestureRef = useRef<WheelGestureState>(IDLE_WHEEL_GESTURE);
  const touchRef = useRef<{ y: number; consumed: boolean } | null>(null);
  const [atSlide, setAtSlide] = useState(0);
  // NO `atChunk` STATE (2026-08-15). It existed only to re-render the rail's
  // per-chunk ticks, which are gone. The live position stays in `posRef` —
  // the scroll gate, the boundary bubble and the backwards-entry landing all
  // read it there and always did. Keeping a write-only useState would be a
  // re-render on every chunk scrolled, for nothing on screen.
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => chunkCounts(screens), [screens]);

  const setPosition = useCallback((next: DeckPosition) => {
    posRef.current = next;
    setAtSlide(next.slide);
  }, []);

  const chunkOffsetsOf = (inner: HTMLElement): number[] =>
    Array.from(inner.querySelectorAll<HTMLElement>("[data-chunk]")).map(
      (el) => el.offsetTop
    );

  const goTo = useCallback(
    (raw: DeckPosition) => {
      const next = clampPosition(counts, raw);
      const outer = scrollerRef.current;
      if (outer) {
        outer.scrollTo({
          top: next.slide * outer.clientHeight,
          behavior: "smooth",
        });
      }
      const inner = innerRefs.current[next.slide];
      if (inner) {
        const offsets = chunkOffsetsOf(inner);
        inner.scrollTo({
          top: offsets[next.chunk] ?? 0,
          behavior: "smooth",
        });
      }
      setPosition(next);
    },
    [counts, setPosition]
  );

  // The bubble gate, shared by wheel and touch: may this gesture advance
  // the SLIDE, and if so, from which chunk does the step depart? (From the
  // final chunk going forward, the first going back — so `stepPosition`
  // bubbles rather than stepping within the slide.)
  const tryBubble = useCallback(
    (dir: 1 | -1): boolean => {
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      if (!canBubble(edge, dir)) return false;
      const from: DeckPosition = {
        slide,
        chunk: dir === 1 ? (counts[slide] ?? 1) - 1 : 0,
      };
      const next = stepPosition(counts, from, dir);
      if (next.slide === slide) return true; // the deck's end absorbs it
      goTo(next);
      return true;
    },
    [counts, goTo]
  );

  // Wheel: the complete Ideal Text surface owns one gesture. Trackpad wheel
  // events are applied immediately to the active paragraph scroller; at its
  // edge they accumulate into one slide transition, whose momentum tail is
  // swallowed. This avoids both page leakage and queued smooth animations.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const owner =
      stage.closest<HTMLElement>("[data-ideal-text-wheel-owner]") ?? stage;
    const onWheel = (e: WheelEvent) => {
      // Preserve browser pinch-to-zoom and native scrolling inside a modal,
      // Presentation Mode, export preview or another explicitly native area.
      if (e.ctrlKey) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest('[role="dialog"], [data-ideal-text-wheel-native]')
      ) {
        return;
      }
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1;
      const dy = e.deltaY * unit;
      if (dy === 0) return;
      // Cancel EVERY vertical delta, including the sub-4px momentum tail that
      // previously escaped into the page at an inner edge.
      e.preventDefault();
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      const outcome = wheelGestureStep(wheelGestureRef.current, {
        deltaY: dy,
        now: performance.now(),
        innerCanScroll: !canBubble(edge, dir),
      });
      wheelGestureRef.current = outcome.state;
      if (outcome.action === "scroll-inner" && inner) {
        // Direct assignment follows the trackpad one-for-one. `scroll-smooth`
        // used to turn every wheel event into a competing animation, so edge
        // detection lagged behind the user's fingers on long gestures.
        inner.scrollTop += dy;
        return;
      }
      if (outcome.action === "advance-screen") tryBubble(dir);
    };
    owner.addEventListener("wheel", onWheel, { passive: false });
    return () => owner.removeEventListener("wheel", onWheel);
  }, [tryBubble]);

  // Touch: one slide step per gesture, only past a deliberate pull at the
  // edge. Native chunk scrolling is untouched (no preventDefault — the
  // inner scroller's overscroll containment already stops the chain).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onStart = (e: TouchEvent) => {
      touchRef.current = { y: e.touches[0]?.clientY ?? 0, consumed: false };
    };
    const onMove = (e: TouchEvent) => {
      const t = touchRef.current;
      if (!t || t.consumed) return;
      const dy = t.y - (e.touches[0]?.clientY ?? t.y);
      if (Math.abs(dy) < 48) return;
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      if (!canBubble(edge, dir)) return;
      t.consumed = true;
      tryBubble(dir);
    };
    const onEnd = () => {
      touchRef.current = null;
    };
    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: true });
    stage.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
    };
  }, [tryBubble]);

  // A reassembly can change the deck's shape under the reader; a rotation
  // changes the slide geometry. Re-clamp and re-seat the outer track.
  //
  // ⚠️ WIDTH-GATED (founder 2026-08-15: "the screen zooms weirdly, the
  // structure doesn't hold"). This re-seated on EVERY window resize, and on
  // iOS the software keyboard IS a resize: opening the chunk editor shrinks
  // the viewport, `seat()` runs, and the track is scrolled to
  // `slide * clientHeight` measured against the SHRUNKEN height — so the deck
  // lands mid-slide. Closing the modal fires it again at yet another height.
  // The structure was not failing to hold; it was being re-seated twice
  // against two wrong measurements.
  //
  // A keyboard changes the height only. A rotation changes the width. So the
  // width is what re-seating keys on, and a height-only resize is ignored —
  // the track's own layout absorbs it, which is what it did before the
  // keyboard ever appeared.
  const seatWidthRef = useRef(-1);
  useEffect(() => {
    const seat = () => {
      const clamped = clampPosition(counts, posRef.current);
      posRef.current = clamped;
      setAtSlide(clamped.slide);
      const outer = scrollerRef.current;
      if (outer) outer.scrollTo({ top: clamped.slide * outer.clientHeight });
    };
    seatWidthRef.current = window.innerWidth;
    seat();
    const onResize = () => {
      if (window.innerWidth === seatWidthRef.current) return;  // keyboard
      seatWidthRef.current = window.innerWidth;
      seat();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [counts]);


  const kickerFor = (slideIndex: number | null, ord: number): string =>
    slideIndex === null ? "Your talk" : `Slide ${slideIndex + 1}`;
  const titleFor = (slideIndex: number | null): string | null =>
    slideIndex === null ? null : (slideTitles?.[slideIndex] ?? null);

  async function copyDeck() {
    // The whole deck: kicker/title + paragraphs, slides separated by a rule
    // (Lovable §4's copy tool).
    const textOut = groups
      .map((g, i) => {
        const head = [kickerFor(g.slideIndex, i), titleFor(g.slideIndex)]
          .filter(Boolean)
          .join(" — ");
        const body = g.chunks.map((c) => c.part.text).join("\n\n");
        return `${head}\n\n${body}`;
      })
      .join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(textOut);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (permissions) — the button simply doesn't confirm.
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Header — title, status chip, copy and close ONLY (Lovable §4). */}
      {chrome === "full" ? (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
          {statusChip ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {statusChip}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {grouping.ok ? (
            <button
              type="button"
              onClick={() => void copyDeck()}
              aria-label="Copy the whole text"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {onClose ? (
            <OverlayCloseButton onClick={onClose} ariaLabel="Close the deck" />
          ) : null}
        </span>
      </div>
      ) : null}

      {/* Stage — one slide per viewport; chunks scroll INSIDE the slide
          first, the slide advances only from its final chunk (§11.3). The
          stage is keyboard-navigable: arrows/PageUp/PageDown step one
          CHUNK, bubbling across slides by the same rule as the gestures. */}
      <div
        ref={stageRef}
        tabIndex={grouping.ok ? 0 : -1}
        onKeyDown={(e) => {
          if (!grouping.ok) return;
          const fwd =
            e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
          const back = e.key === "ArrowUp" || e.key === "PageUp";
          if (!fwd && !back) return;
          e.preventDefault();
          goTo(stepPosition(counts, posRef.current, fwd ? 1 : -1));
        }}
        className="relative min-h-0 flex-1 outline-none"
      >
        {!grouping.ok ? (
          <div
            className="flex h-full items-center justify-center px-6 text-center"
            role="alert"
          >
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Couldn&apos;t load your ideal text. Try again in a moment.
            </p>
          </div>
        ) : null}
        <div
          ref={scrollerRef}
          // PROGRAMMATIC-ONLY (§11.3): native scroll on the slide track
          // would bypass the chunk gate through the kicker area, so the
          // track only moves via goTo/dots/keys.
          className={grouping.ok ? "h-full overflow-hidden" : "hidden"}
        >
          {screens.map((g, gi) => (
            <section
              key={`${g.slideIndex ?? "untitled"}-${g.screenOfSlide}`}
              // NO RULE BETWEEN SLIDES (founder 2026-08-11: "the screen has
              // a stroke around the text, please delete that all"). One
              // slide fills the viewport; a dashed line under each one drew
              // a box around the words for a boundary the scroll already
              // makes.
              className="flex h-full flex-col gap-4 px-6 py-8 sm:px-10"
            >
              <div className="shrink-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {kickerFor(g.slideIndex, gi)}
                </p>
                {g.screenOfSlide === 0 && titleFor(g.slideIndex) ? (
                  <h2 className="mt-2 font-heading text-[clamp(1.5rem,4vw,2.1rem)] leading-tight tracking-[-0.035em] text-foreground">
                    {titleFor(g.slideIndex)}
                  </h2>
                ) : null}
                {g.screenOfSlide === 0 &&
                presentationRef &&
                g.slideIndex !== null ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted">
                    <PdfPage
                      url={presentationRef}
                      pageIndex={g.slideIndex}
                      onError={() => undefined}
                      className="w-full"
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditingSlideIndex(g.slideIndex)}
                  className="mt-3 text-[13px] font-medium text-primary transition-opacity hover:opacity-70"
                >
                  Edit this slide
                </button>
              </div>
              {/* The INNER chunk scroller: overscroll-contained so the
                  last chunk never chains into a slide flip mid-gesture —
                  the bubble is a deliberate step, taken above. `my-auto`
                  centres a short slide exactly as the old layout did and
                  collapses to 0 the moment the chunks overflow (the old
                  justify-center CLIPPED overflowing text — screenshot #1's
                  second defect). */}
              <div
                ref={(el) => {
                  innerRefs.current[gi] = el;
                }}
                onScroll={(e) => {
                  if (gi !== posRef.current.slide) return;
                  const el = e.currentTarget;
                  const chunk = nearestChunkIndex(
                    chunkOffsetsOf(el),
                    el.scrollTop
                  );
                  if (chunk !== posRef.current.chunk) {
                    // REF ONLY — no setState (2026-08-15). This tracking is
                    // load-bearing: the boundary gate and the backwards-entry
                    // landing both read `posRef.current.chunk`. What it no
                    // longer needs to do is RE-RENDER, because the rail
                    // stopped drawing a tick per chunk. Scrolling a screen
                    // used to re-render the whole deck on every paragraph
                    // crossed, to move a dot the reader was not looking at.
                    posRef.current = { slide: gi, chunk };
                  }
                }}
                className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              >
                <div className="my-auto flex min-h-full flex-col justify-center gap-4">
                  {g.chunks.map((c) => (
                    <p
                      key={c.part.id}
                      data-chunk
                      className="text-[clamp(1.02rem,2.5vw,1.22rem)] leading-[1.8] text-foreground"
                    >
                      <RichText text={c.part.text} />
                      <DeckLockMark
                        status={c.status}
                        flagship={parseRichSpans(c.part.text).some(
                          (span) => span.highlight && span.text.trim().length > 0
                        )}
                        onClick={() => setOpenPartId(c.part.id)}
                        // THE COACH'S MESSAGE, VISIBLE FROM THE LOCK (founder
                        // 2026-08-11). The same join the modal already runs,
                        // now run per chunk so the page can say WHICH chunk
                        // carries it. Free: `coachMomentForChunk` is a pure
                        // anchor lookup over the served document, and the
                        // metered feedback read still fires only on the tap
                        // inside the modal.
                        hasCoach={
                          coachMomentForChunk(coachMoments, doc, c)
                            ?.hasExplanation === true
                        }
                        reviewStatus={
                          coachMomentForChunk(coachMoments, doc, c)
                            ?.reviewStatus ?? null
                        }
                        // THE STYLE LANE'S HANDLE (founder 2026-08-12). Same
                        // shape as the coach dot, and for the same reason: the
                        // proposal lives only inside the modal, so without a
                        // mark on the page the only way to find it is to open
                        // every locked chunk in turn. `styleFor` is the pure
                        // overlap the modal already runs on the open chunk —
                        // run per chunk here, it costs one span comparison.
                        hasStyle={styleFor(styleChanges, c) !== null}
                      />
                    </p>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* THE RAIL — TWO GRAINS, PAGES PER SLIDE (§11.4, re-cut
            2026-08-15). The pill is the SLIDE; each mark inside it is one
            SCREEN of that slide, the current one stretched. A slide that
            runs onto a second screen therefore shows two marks — which is
            the whole read: where am I, and how much of this slide is left.
            The former third grain (a tick per chunk inside the active
            screen) is gone; see the mark below for why.
            POSITION ONLY — "slide 3, second of two screens" is navigation;
            the rail must never grade (AC-9). */}
        {grouping.ok &&
        (screens.length > 1 || (counts[0] ?? 0) > 1) ? (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2.5">
            {railSlides.map((rs, ord) => {
              const slideScreens = screens.slice(rs.first, rs.first + rs.count);
              const marks = slideScreens.map((scr, k) => {
                const si = rs.first + k;
                const label =
                  scr.screensInSlide > 1
                    ? `Go to ${kickerFor(rs.slideIndex, ord)}, screen ${
                        scr.screenOfSlide + 1
                      } of ${scr.screensInSlide}`
                    : `Go to ${kickerFor(rs.slideIndex, ord)}`;
                // ONE MARK PER SCREEN — no chunk ticks (founder 2026-08-15:
                // "just the pages per slide … one level of hierarchy can be
                // removed, this deepest one").
                //
                // The active screen used to expand into a capsule holding one
                // tick per chunk, which made the rail read at three grains at
                // once: pill = slide, mark = screen, tick = chunk. Two of
                // those answer "where am I"; the third answered "which
                // paragraph is under my thumb", which the reader can already
                // see — the paragraphs are RIGHT THERE on the screen it was
                // describing. It cost the rail its glanceability to restate
                // what the page already showed.
                //
                // Nothing is lost from navigation: chunk scrolling inside a
                // screen is native and continuous (§11.3), so there was never
                // a step for those ticks to be the control for. The live
                // chunk position stays in `posRef`, where the scroll gate and
                // the backwards-entry landing already read it.
                return (
                  <button
                    key={`scr-${si}`}
                    type="button"
                    aria-label={label}
                    aria-current={atSlide === si ? "true" : undefined}
                    onClick={() => goTo({ slide: si, chunk: 0 })}
                    className={`rounded-full transition-all ${
                      atSlide === si
                        ? "h-[1.1rem] w-2 bg-foreground"
                        : "h-2 w-2 bg-muted-foreground/40 hover:bg-muted-foreground"
                    }`}
                  />
                );
              });
              // §11.7.3: a multi-screen slide's marks share one pill — the
              // continuation is VISIBLE on the rail. The pill is the SLIDE,
              // its marks are that slide's SCREENS, and that is now the whole
              // rail. Position only, never a grade (AC-9).
              return rs.count > 1 ? (
                <div
                  key={rs.slideIndex ?? `rail-${ord}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 px-[3px] py-1.5"
                >
                  {marks}
                </div>
              ) : (
                <div
                  key={rs.slideIndex ?? `rail-${ord}`}
                  className="flex flex-col items-center"
                >
                  {marks}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* NO FOOTER (founder 2026-08-11). The review count, the slide
          position and the word count are all gone: the dots rail already
          says where you are, and a running word count is a number about
          your speech sitting under your speech. */}

      {grouping.ok && openChunk ? (
        <DeckChunkModal
          key={openChunk.part.id}
          chunk={openChunk}
          suggestion={openSuggestion}
          onAccept={onAccept}
          onUndoAccept={onUndoAccept}
          onKeepMine={onKeepMine}
          onLockIn={async (text: string): Promise<LockOutcome> => {
            const outcome = await onLockPart(openChunk, text);
            if (outcome === "ok") {
              // §11.7.1: the page shows the lock the instant the server
              // confirms it — the modal closes itself on "ok".
              setOptimisticLocked((prev) =>
                new Set(prev).add(openChunk.part.id)
              );
            }
            return outcome;
          }}
          onUnlockPart={
            onUnlockPart
              ? async (): Promise<LockOutcome> => {
                  const outcome = await onUnlockPart(openChunk);
                  if (outcome === "ok") {
                    // Mirror of the lock's optimism: the mark greys the
                    // instant the server confirms, instead of waiting on the
                    // host's refetch. Clearing the id is enough — the base
                    // status is derived from the served part, which the
                    // refetch will report unlocked anyway.
                    setOptimisticLocked((prev) => {
                      const next = new Set(prev);
                      next.delete(openChunk.part.id);
                      return next;
                    });
                    setOptimisticUnlocked((prev) =>
                      new Set(prev).add(openChunk.part.id)
                    );
                  }
                  return outcome;
                }
              : null
          }
          onClose={() => setOpenPartId(null)}
          styleSuggestion={styleFor(styleChanges, openChunk)}
          onApplyStyle={onApplyStyle}
          history={decisionHistory}
          coachSnippetId={
            coachMomentForChunk(coachMoments, doc, openChunk)
              ?.hasExplanation === true
              ? coachMomentForChunk(coachMoments, doc, openChunk)?.snippetId ?? null
              : null
          }
          coachReviewStatus={
            coachMomentForChunk(coachMoments, doc, openChunk)?.reviewStatus ?? null
          }
          arcId={arcId}
        />
      ) : null}
      {grouping.ok && editingSlideIndex !== undefined ? (
        <SlideEditor
          key={editingSlideIndex ?? "unlinked"}
          title={titleFor(editingSlideIndex) || kickerFor(editingSlideIndex, 0)}
          presentationRef={presentationRef}
          slideIndex={editingSlideIndex}
          chunks={
            groups.find((group) => group.slideIndex === editingSlideIndex)
              ?.chunks ?? []
          }
          onCancel={() => setEditingSlideIndex(undefined)}
          onSave={async (edits) => {
            const saved = await onEditSlide(edits);
            if (saved) setEditingSlideIndex(undefined);
            return saved;
          }}
        />
      ) : null}
    </div>
  );
}

function SlideEditor({
  title,
  presentationRef,
  slideIndex,
  chunks,
  onCancel,
  onSave,
}: {
  title: string;
  presentationRef: string | null;
  slideIndex: number | null;
  chunks: readonly DeckChunk[];
  onCancel: () => void;
  onSave: (edits: Array<{ chunk: DeckChunk; text: string }>) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState(() => chunks.map((chunk) => chunk.part.text));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Edit this slide"
    >
      <div className="flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Edit this slide
          </p>
          <h2 className="mt-1 text-[17px] font-semibold text-foreground">{title}</h2>
        </div>
        <div className="scrollbar-none flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {presentationRef && slideIndex !== null ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <PdfPage
                url={presentationRef}
                pageIndex={slideIndex}
                onError={() => undefined}
                className="w-full"
              />
            </div>
          ) : null}
          {chunks.map((chunk, index) => (
            <MarkedEditor
              key={chunk.part.id}
              value={drafts[index] ?? ""}
              onChange={(next) =>
                setDrafts((current) =>
                  current.map((value, at) =>
                    at === index ? next : value
                  )
                )
              }
              toolbar={false}
              textSizeClass="text-[16px]"
              frameClass="min-h-32 border border-border bg-background focus-within:border-primary"
            />
          ))}
          {failed ? (
            <p className="text-[12px] text-destructive">
              Couldn&apos;t save this slide. Your edits are still here.
            </p>
          ) : null}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="rounded-full">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || drafts.some((draft) => !draft.trim())}
            onClick={() => {
              setSaving(true);
              setFailed(false);
              void onSave(
                chunks.flatMap((chunk, index) =>
                  drafts[index]?.trim() !== chunk.part.text.trim()
                    ? [{ chunk, text: drafts[index].trim() }]
                    : []
                )
              ).then((ok) => {
                setSaving(false);
                setFailed(!ok);
              });
            }}
            className="rounded-full"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
