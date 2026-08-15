"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import DeckChunkModal, {
  type LockOutcome,
} from "@/components/willab/DeckChunkModal";
import DeckLockMark from "@/components/willab/DeckLockMark";
import { RichText } from "@/components/willab/RichText";
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
  nearestChunkIndex,
  scrollEdge,
  stepPosition,
  type DeckPosition,
  type DeckScreenModel,
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
  onAccept,
  onKeepMine,
  onLockPart,
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
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
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
  useEffect(() => {
    setOptimisticLocked(new Set());
  }, [parts]);

  const chunks = useMemo(() => {
    const built = buildDeckChunks(doc, parts, suggestions);
    if (optimisticLocked.size === 0) return built;
    return built.map((c) =>
      c.status === "clean" && optimisticLocked.has(c.part.id)
        ? { ...c, status: "locked" as const }
        : c
    );
  }, [doc, parts, suggestions, optimisticLocked]);
  const groups = useMemo(
    () => groupChunksBySlide(chunks, pieceSlideIndexes),
    [chunks, pieceSlideIndexes]
  );
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
   * Within a slide, chunk scrolling stays NATIVE — chunks are ~4 lines
   * each and several fit a viewport, so a hard stop per chunk would fight
   * reading. The §11.3 contract is the boundary gate, and that is stepped.
   */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef<DeckPosition>({ slide: 0, chunk: 0 });
  const armedRef = useRef(true);
  const lastWheelAtRef = useRef(0);
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

  // Wheel: native inside the inner scroller until its edge; at the edge
  // the event is ours (preventDefault needs a non-passive listener, which
  // React's synthetic onWheel does not guarantee — hence the effect).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaY;
      if (Math.abs(dy) < 4) return;
      const now = performance.now();
      if (now - lastWheelAtRef.current > 160) armedRef.current = true;
      lastWheelAtRef.current = now;
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      if (!canBubble(edge, dir)) return; // chunks first — stay native
      e.preventDefault();
      if (!armedRef.current) return; // momentum tail, not a fresh gesture
      armedRef.current = false;
      tryBubble(dir);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
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

  // A reassembly can change the deck's shape under the reader; a resize
  // changes the slide geometry. Re-clamp and re-seat the outer track.
  useEffect(() => {
    const seat = () => {
      const clamped = clampPosition(counts, posRef.current);
      posRef.current = clamped;
      setAtSlide(clamped.slide);
      const outer = scrollerRef.current;
      if (outer) outer.scrollTo({ top: clamped.slide * outer.clientHeight });
    };
    seat();
    window.addEventListener("resize", seat);
    return () => window.removeEventListener("resize", seat);
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
        tabIndex={0}
        onKeyDown={(e) => {
          const fwd =
            e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
          const back = e.key === "ArrowUp" || e.key === "PageUp";
          if (!fwd && !back) return;
          e.preventDefault();
          goTo(stepPosition(counts, posRef.current, fwd ? 1 : -1));
        }}
        className="relative min-h-0 flex-1 outline-none"
      >
        <div
          ref={scrollerRef}
          // PROGRAMMATIC-ONLY (§11.3): native scroll on the slide track
          // would bypass the chunk gate through the kicker area, so the
          // track only moves via goTo/dots/keys.
          className="h-full overflow-hidden"
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
                        onClick={() => setOpenPartId(c.part.id)}
                        // THE COACH'S MESSAGE, VISIBLE FROM THE LOCK (founder
                        // 2026-08-11). The same join the modal already runs,
                        // now run per chunk so the page can say WHICH chunk
                        // carries it. Free: `coachMomentForChunk` is a pure
                        // anchor lookup over the served document, and the
                        // metered feedback read still fires only on the tap
                        // inside the modal.
                        hasCoach={
                          coachMomentForChunk(coachMoments, doc, c) !== null
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
        {screens.length > 1 || (counts[0] ?? 0) > 1 ? (
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

      {openChunk ? (
        <DeckChunkModal
          key={openChunk.part.id}
          chunk={openChunk}
          suggestion={openSuggestion}
          onAccept={onAccept}
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
          onClose={() => setOpenPartId(null)}
          styleSuggestion={styleFor(styleChanges, openChunk)}
          onApplyStyle={onApplyStyle}
          history={decisionHistory}
          coachSnippetId={
            coachMomentForChunk(coachMoments, doc, openChunk)?.snippetId ?? null
          }
          arcId={arcId}
        />
      ) : null}
    </div>
  );
}
