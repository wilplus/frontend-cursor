"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { MomentStarText } from "./MomentStars";
import { RichText } from "./RichText";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { PdfPage, useDeckPageCount } from "./pdfSlides";
import {
  latestTakeIndex,
  sliceSegmentsByParagraphs,
  slidePagesForParagraphs,
  splitBadgeParagraphSpans,
} from "@/lib/willab/pieceBadges";
import {
  rebaseSuggestionsToSpan,
  resolveAdviceSpans,
  resolveTrackedSuggestions,
} from "@/lib/willab/trackedChanges";
import { TrackedText, type TrackedDecision } from "./TrackedText";
import {
  segmentIdealText,
  type DocumentSuggestion,
  type IdealKeyMomentLink,
  type IdealPiece,
  type IdealSegment,
  type IdealText,
} from "@/services/api/idealText";
import { WHY_COPY } from "@/lib/willab/trackedChangeWhy";
import {
  pickerBlockForParagraph,
  type VariantBlock,
} from "@/services/api/blockVariants";
import { VariantChip } from "./BlockVariantPicker";
import type { LocalFold } from "./MomentStars";

/* -------------------------------------------------------------------------- */
/*  PieceBadges — the discernment layer (founder 2026-07-20)                   */
/*                                                                            */
/*  The master text is a per-piece mix of takes with visible provenance.       */
/*  Each paragraph of the TOP-LEVEL text gets a subtle "vN.0" pill from its    */
/*  piece's take_index. Badges are provenance, not buttons — except a          */
/*  pending_swap pill, which glows and opens the comparison sheet (incumbent   */
/*  vs challenger + one fixed why line + Use this version / Keep mine).        */
/*                                                                            */
/*  ANCHORING RULE (BE-pinned): the reading text is the top-level `text`,      */
/*  never a reconstruction from pieces. Pills attach by zipping the text's     */
/*  paragraphs with `pieces` in slot order — the BE assembles the master       */
/*  text by joining piece texts with "\n\n", so the counts match on the        */
/*  machine lane. When they don't (a user edit reshaped paragraphs, a coach    */
/*  snapshot, a lagging piece row), the badges HIDE and the view is exactly    */
/*  today's — never a misattributed pill.                                      */
/*                                                                            */
/*  AC-9: no percentages, no counts, no scores — version numbers only.         */
/* -------------------------------------------------------------------------- */

/** Re-exported for import compatibility. The copy itself moved to
 *  lib/willab/trackedChangeWhy — one auditable home for every string a
 *  reason line can say, and a plain module so the fence is testable (vitest
 *  cannot parse this project's .tsx). */
export { WHY_COPY };

/** The version pill. Settled: quiet provenance — tap shows a transient
 *  "Kept from Take N." tooltip (FE-4), nothing else. Pending: the glow — tap
 *  opens the comparison sheet. Fresh (take == latest) wears the tint. */
function PiecePill({
  piece,
  fresh,
  onOpenSwap,
}: {
  piece: IdealPiece;
  fresh: boolean;
  onOpenSwap: (piece: IdealPiece) => void;
}) {
  const [tip, setTip] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
    },
    []
  );
  if (piece.takeIndex === null) return null;
  const label = `v${piece.takeIndex}.0`;
  const pending = piece.status === "pending_swap" && piece.challenger;
  if (pending) {
    return (
      <button
        type="button"
        onClick={() => onOpenSwap(piece)}
        className="ml-1.5 inline-flex -translate-y-px animate-pulse items-center rounded-full bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-medium tabular-nums text-primary ring-2 ring-primary/30"
      >
        {label}
        <span className="sr-only">, a newer take is waiting</span>
      </button>
    );
  }
  return (
    <span className="relative inline-block align-middle">
      {tip ? (
        <span className="absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] text-background">
          Kept from Take {piece.takeIndex}.
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setTip(true);
          if (tipTimer.current) clearTimeout(tipTimer.current);
          tipTimer.current = setTimeout(() => setTip(false), 1800);
        }}
        className={`ml-1.5 inline-flex -translate-y-px items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
          fresh ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {label}
      </button>
    </span>
  );
}

/** One deck page interleaved above its paragraph in the reading view. The
 *  document text is the floor: any render failure hides the image (via the
 *  host's onError → every slide unmounts), never a placeholder card. */
function ParagraphSlide({
  url,
  pageIndex,
  onError,
}: {
  url: string;
  pageIndex: number;
  onError: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted">
      <PdfPage url={url} pageIndex={pageIndex} onError={onError} className="w-full" />
    </div>
  );
}

/** The badged reading view: MomentStarText per paragraph + its piece's pill.
 *  pieces null (flag off) or a paragraph/piece count mismatch → ONE plain
 *  MomentStarText, exactly today's view. The star lanes are untouched: stars
 *  own how to deliver, badges own which take (FE-5).
 *
 *  SLIDES (founder 2026-08-03) — with `deck` set, each paragraph reads under
 *  the slide it was delivered on: slide → its text → next slide → next text.
 *  Only when the slide↔paragraph mapping is provable (slidePagesForParagraphs);
 *  otherwise, and for every deckless arc, exactly today's view. */
export function PieceBadgeText({
  text,
  ideal,
  pieces,
  showPills = true,
  suggestions,
  onDecideTracked,
  onLockParagraph,
  onMomentTap,
  foldFor,
  sdStars,
  textSizeClass,
  onOpenSwap,
  tint,
  deck,
  variantBlocks,
  onOpenPicker,
}: {
  /** FE-7 — document-absolute key-point ranges to accent in the full read.
   *  Paragraphs carry their own `start`, so each one resolves the cues that
   *  fall inside it and ignores the rest. */
  tint?: Array<[number, number]>;
  /** LIVING TRANSCRIPT — span-anchored tracked changes over `text`. When
   *  present this lane owns the text rendering (strikes, proposals, advice
   *  stars) and the version pills still compose on top; absent → today's
   *  star/quote view. */
  suggestions?: DocumentSuggestion[] | null;
  onDecideTracked?: (
    s: DocumentSuggestion,
    d: TrackedDecision
  ) => Promise<boolean>;
  /** SPEC-lockin-loop §2 — lock the part behind rendered paragraph
   *  `paragraphIndex`. The HOST resolves index → part (lockTargetAt verifies
   *  the words) and persists; this component owns the armed/busy/locked chip
   *  state, because IT knows which paragraph each accept happened in — the
   *  index is bound in the closure, no span arithmetic anywhere. Absent →
   *  accepts behave exactly as today (no chip). */
  onLockParagraph?: (
    paragraphIndex: number,
    paragraphText: string
  ) => Promise<"ok" | "blocked" | "failed">;
  text: string;
  ideal: IdealText;
  pieces: IdealPiece[] | null;
  /** Founder 2026-08-10 (slides-per-chunk): the take PILLS and the SLIDE
   *  mapping both ride `pieces`, but they are different decisions. "After a
   *  save the script is clean" retires the pills — it must NOT retire the
   *  slides, which is exactly what nulling `pieces` did: the saved document
   *  lost its slide→chunk separation along with the badges. False hides the
   *  pills (and their swap sheet) while every piece-driven slide keeps
   *  rendering. Default true — every existing call is unchanged. */
  showPills?: boolean;
  onMomentTap: (m: IdealKeyMomentLink) => void;
  foldFor?: (m: IdealKeyMomentLink) => LocalFold | null;
  sdStars?: boolean;
  textSizeClass?: string;
  onOpenSwap: (piece: IdealPiece) => void;
  /** The arc's deck PDF for the slide-per-paragraph read. null/absent = no
   *  deck → no slides, today's view exactly. */
  deck?: { presentationRef: string } | null;
  /** BLOCK_VARIANTS — the picker pool, zipped to paragraphs by the SAME
   *  slot-order rule as the pieces (count mismatch hides every chip, never a
   *  misattributed one). null/absent (flag off / 404) → no chips, today's
   *  view exactly. INDEPENDENT of `pieces` on purpose: a saved document
   *  hides its take pills but the picker must still open (handoff §10). */
  variantBlocks?: VariantBlock[] | null;
  onOpenPicker?: (block: VariantBlock) => void;
}) {
  // SLIDES — the deck the paragraphs may read under. One failure hides every
  // slide (the text is the floor); a new deck source gets a fresh chance.
  const deckUrl = deck?.presentationRef ?? null;
  const pageCount = useDeckPageCount(deckUrl);
  const [slidesFailed, setSlidesFailed] = useState(false);
  useEffect(() => setSlidesFailed(false), [deckUrl]);
  const onSlideError = useCallback(() => setSlidesFailed(true), []);
  const slideUrl = deckUrl && !slidesFailed ? deckUrl : null;
  // ONE document-level segmentation (review R-db1): anchors match at their
  // single first-occurrence-in-document position, exactly as the un-badged
  // view, then the segments are SLICED at paragraph boundaries. Re-running
  // the matcher per paragraph would duplicate a recurring anchor's star in
  // every paragraph containing its text, and paint an approved fold there
  // too.
  const spans = useMemo(
    () => (pieces && pieces.length > 0 ? splitBadgeParagraphSpans(text) : null),
    [pieces, text]
  );
  const perParagraph = useMemo(() => {
    if (!pieces || !spans || spans.length !== pieces.length) return null;
    return sliceSegmentsByParagraphs(
      segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
      spans
    );
  }, [pieces, spans, text, ideal.keyPhrases, ideal.keyMoments]);
  // BLOCK_VARIANTS — the picker chip for paragraph i of a count-paragraph
  // view. Gated inside pickerBlockForParagraph: blocks must zip 1:1 with the
  // paragraphs AND the block must offer a real choice (§8.3), else nothing
  // renders. The chip rides `trailing` beside (never instead of) the pill —
  // the pill stays provenance/offer, the chip is the neutral picker entry.
  const chipAt = (i: number, count: number) => {
    if (!onOpenPicker) return null;
    const b = pickerBlockForParagraph(variantBlocks ?? null, count, i);
    return b ? <VariantChip block={b} onOpen={onOpenPicker} /> : null;
  };
  // D-2 (paragraph spacing) — even WITHOUT the piece-badge layer, split the
  // same "\n\n" paragraphs the BE joins on (offset-safe: no chars change) and
  // slice the document segments per paragraph, so the no-pieces fallback spaces
  // its paragraphs with `gap-4` like the badged path instead of one tight block.
  // Passing the pre-sliced `segments` avoids re-matching a recurring anchor's
  // star into every paragraph it textually appears in.
  const fbSpans = useMemo(() => splitBadgeParagraphSpans(text), [text]);
  const fbSegments = useMemo(
    () => segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
    [text, ideal.keyPhrases, ideal.keyMoments]
  );
  const fbSlices = useMemo(
    () =>
      fbSpans.length > 1 ? sliceSegmentsByParagraphs(fbSegments, fbSpans) : null,
    [fbSpans, fbSegments]
  );
  // ── SPEC-lockin-loop §2 — the Accept → "Lock it" state machine, per
  // paragraph. Accept ARMS the lock (it does not lock); the chip appears at
  // the paragraph's end and locking is the student's explicit second tap.
  //
  // The state lives HERE and not in TrackedText for one load-bearing reason:
  // an accept triggers a refetch, the decided suggestion stops being served,
  // and any chip keyed to the suggestion's span vanishes with it — exactly
  // when the founder's flow says the button must appear. Keyed by paragraph
  // INDEX (stable across an in-place accept); cleared when the paragraph
  // COUNT changes, because then the indices name different paragraphs. A
  // survived-but-shifted index cannot lock the wrong words regardless: the
  // host verifies index → part against the words on screen (lockTargetAt)
  // and the server verifies the echo — a tap only ever locks what is
  // visibly at that position. ──
  const [lockArmed, setLockArmed] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const [lockDone, setLockDone] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const [lockBusyAt, setLockBusyAt] = useState<number | null>(null);
  const [lockBlockedAt, setLockBlockedAt] = useState<number | null>(null);
  const paraCount = useMemo(
    () => splitBadgeParagraphSpans(text).length,
    [text]
  );
  const prevCountRef = useRef(paraCount);
  useEffect(() => {
    if (prevCountRef.current === paraCount) return;
    prevCountRef.current = paraCount;
    setLockArmed(new Set());
    setLockDone(new Set());
    setLockBusyAt(null);
    setLockBlockedAt(null);
  }, [paraCount]);

  const decideAndArm = useCallback(
    async (
      s: DocumentSuggestion,
      d: TrackedDecision,
      at: number
    ): Promise<boolean> => {
      if (!onDecideTracked) return false;
      const ok = await onDecideTracked(s, d);
      if (ok) {
        // Any decision on this paragraph shrinks its pending set, so the
        // R3 "decide everything first" note is stale the moment one lands.
        setLockBlockedAt((prev) => (prev === at ? null : prev));
        if (d === "accept" && onLockParagraph) {
          setLockArmed((prev) => new Set(prev).add(at));
        }
      }
      return ok;
    },
    [onDecideTracked, onLockParagraph]
  );

  const lockNow = useCallback(
    (at: number, paragraphText: string) => {
      if (!onLockParagraph || lockBusyAt !== null) return;
      setLockBusyAt(at);
      setLockBlockedAt(null);
      void onLockParagraph(at, paragraphText).then((r) => {
        setLockBusyAt(null);
        if (r === "ok") {
          setLockDone((prev) => new Set(prev).add(at));
          setLockArmed((prev) => {
            const next = new Set(prev);
            next.delete(at);
            return next;
          });
          return;
        }
        if (r === "blocked") setLockBlockedAt(at);
        // "failed" → the chip stays, so the student can simply try again.
      });
    },
    [onLockParagraph, lockBusyAt]
  );

  /** The chip for paragraph `i`, riding the SAME trailing slot as the picker
   *  chip — and on BOTH text lanes, because the post-accept refetch can flip
   *  a paragraph from the tracked lane back to the star lane and the armed
   *  button must survive that flip. */
  const lockChipAt = (i: number, paragraphText: string): React.ReactNode => {
    if (!onLockParagraph) return null;
    if (lockDone.has(i)) {
      return (
        <span className="ml-1.5 inline-flex -translate-y-0.5 items-center rounded-full bg-muted px-1.5 py-0.5">
          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="sr-only">Locked</span>
        </span>
      );
    }
    if (!lockArmed.has(i)) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => lockNow(i, paragraphText)}
          disabled={lockBusyAt !== null}
          className="ml-1.5 inline-flex -translate-y-0.5 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[12px] font-medium text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Lock className="h-3 w-3" aria-hidden />
          {IDEAL_EDIT_COPY.lockIt}
        </button>
        {lockBlockedAt === i ? (
          <span className="ml-1.5 text-[12px] text-muted-foreground">
            {IDEAL_EDIT_COPY.lockBlocked}
          </span>
        ) : null}
      </>
    );
  };

  // Which lane owns the WORDS — decided PER PARAGRAPH (SPEC-lockin-loop §3;
  // this retired the document-level `starsPresent` kill switch). Two hard
  // conditions (review R-lt6/R-lt1), the first now scoped to the paragraph:
  //
  //  1. The tracked lane may never DELETE the star layer. key_moments carries
  //     the moment stars, approve folds, the moment sheet (the only entry to
  //     the moments unlock) and the delivery re-record — so a paragraph WITH
  //     a star anchor inside it keeps the star lane, always. But one star
  //     anywhere no longer silences every other paragraph's chips: stars and
  //     chips coexist ACROSS the document, which is the founder's spec (the
  //     rendering registry serves both through one budget). Where the
  //     per-paragraph star read is impossible (slicing refused), the WHOLE
  //     document's anchors decide — the old behavior exactly.
  //  2. Gate on what actually RESOLVES, not the raw list: an all-advice,
  //     all-stale or all-decided payload resolves to nothing, and rendering
  //     the tracked lane then would paint a bare paragraph with no stars,
  //     no pills and no affordances at all.
  const starsIn = (segs: IdealSegment[] | null | undefined): boolean =>
    !!segs && segs.some((s) => s.moment !== undefined);
  const rendersTracked = (
    t: string,
    list: DocumentSuggestion[] | null | undefined,
    segs: IdealSegment[] | null | undefined
  ): boolean =>
    !!onDecideTracked &&
    !starsIn(segs) &&
    (resolveTrackedSuggestions(t, list ?? null).length > 0 ||
      resolveAdviceSpans(t, list ?? null).length > 0);
  if (!pieces || !spans || !perParagraph) {
    // SLIDES without the piece layer: only the exact-count mapping is provable
    // (no per-piece slide_index to lean on).
    const fbPages = slideUrl
      ? slidePagesForParagraphs(fbSpans.length, null, pageCount)
      : null;
    if (fbSlices) {
      // Multi-paragraph, sliceable: ONE gap-4 stack, each paragraph choosing
      // its own lane. A paragraph whose suggestions resolve (and which holds
      // no star anchor) renders tracked — rebased to its span, a straddler
      // dropped, never guessed — the rest keep the star view. This replaces
      // BOTH the all-tracked and the all-star stacks that used to sit here.
      return (
        <div className="flex flex-col gap-4">
          {fbSpans.map((span, i) => {
            const local = rebaseSuggestionsToSpan(suggestions ?? null, span);
            const chips = (
              <>
                {chipAt(i, fbSpans.length)}
                {lockChipAt(i, span.text)}
              </>
            );
            return (
              <div key={i} className="flex flex-col gap-2.5">
                {fbPages && (i === 0 || fbPages[i] !== fbPages[i - 1]) ? (
                  <ParagraphSlide
                    url={slideUrl!}
                    pageIndex={fbPages[i]}
                    onError={onSlideError}
                  />
                ) : null}
                {rendersTracked(span.text, local, fbSlices[i]) &&
                onDecideTracked ? (
                  <TrackedText
                    text={span.text}
                    suggestions={local}
                    onDecide={(s, d) => decideAndArm(s, d, i)}
                    textSizeClass={textSizeClass}
                    trailing={chips}
                    srcOffset={span.start}
                    tint={tint}
                  />
                ) : (
                  <MomentStarText
                    text={span.text}
                    segments={fbSlices[i]}
                    ideal={ideal}
                    onMomentTap={onMomentTap}
                    foldFor={foldFor}
                    sdStars={sdStars}
                    textSizeClass={textSizeClass}
                    trailing={chips}
                    srcOffset={span.start}
                    tint={tint}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }
    // One paragraph, or a document whose slicing was refused (a styled
    // segment straddles a boundary) — the whole-document segments decide,
    // which for the refused case is the old document-level gate exactly.
    if (rendersTracked(text, suggestions, fbSegments) && onDecideTracked) {
      const single = (
        <TrackedText
          text={text}
          suggestions={suggestions ?? null}
          onDecide={
            fbSpans.length === 1
              ? (s, d) => decideAndArm(s, d, 0)
              : onDecideTracked
          }
          textSizeClass={textSizeClass}
          // One paragraph rendered as one block can still zip (1:1); a
          // multi-paragraph doc rendered as ONE block cannot anchor a
          // per-block chip honestly, so none renders — the lock chip follows
          // the same rule.
          trailing={
            fbSpans.length === 1 ? (
              <>
                {chipAt(0, 1)}
                {lockChipAt(0, text)}
              </>
            ) : undefined
          }
          tint={tint}
        />
      );
      return fbSpans.length === 1 && fbPages ? (
        <div className="flex flex-col gap-2.5">
          <ParagraphSlide
            url={slideUrl!}
            pageIndex={fbPages[0]}
            onError={onSlideError}
          />
          {single}
        </div>
      ) : (
        single
      );
    }
    const single = (
      <MomentStarText
        text={text}
        ideal={ideal}
        onMomentTap={onMomentTap}
        foldFor={foldFor}
        sdStars={sdStars}
        textSizeClass={textSizeClass}
        // Same honest-anchor rule as the tracked single block above.
        trailing={
          fbSpans.length === 1 ? (
            <>
              {chipAt(0, 1)}
              {lockChipAt(0, text)}
            </>
          ) : undefined
        }
        tint={tint}
      />
    );
    // A one-paragraph document under a one-page deck still earns its slide.
    // (fbSlices needs 2+ paragraphs, so a single paragraph lands here.)
    return fbSpans.length === 1 && fbPages ? (
      <div className="flex flex-col gap-2.5">
        <ParagraphSlide
          url={slideUrl!}
          pageIndex={fbPages[0]}
          onError={onSlideError}
        />
        {single}
      </div>
    ) : (
      single
    );
  }
  const latest = latestTakeIndex(pieces);
  // SLIDES — the pieces' own slide_index wins when the BE serves it; else the
  // exact-count zip. Both provable; anything else renders no slides.
  const piecePages = slideUrl
    ? slidePagesForParagraphs(spans.length, pieces, pageCount)
    : null;
  return (
    <div className="flex flex-col gap-4">
      {spans.map((span, i) => {
        const piece = pieces[i];
        // The picker chip rides BESIDE the pill: the pill keeps its two jobs
        // (provenance tooltip / the glowing OFFER) and the chip stays the
        // neutral picker entry — the two lanes never merge into one ranked
        // affordance (§6).
        const pill = (
          <>
            {showPills ? (
              <PiecePill
                piece={piece}
                fresh={latest !== null && piece.takeIndex === latest}
                onOpenSwap={onOpenSwap}
              />
            ) : null}
            {chipAt(i, spans.length)}
            {lockChipAt(i, span.text)}
          </>
        );
        // FE-3+FE-4 compose: tracked changes render the words, the version
        // pill still rides at the paragraph's end. Suggestions are rebased to
        // paragraph-local offsets (one straddling a boundary is dropped), and
        // the decision is PER PARAGRAPH — a paragraph whose suggestions all
        // went stale keeps its stars instead of going bare.
        const local = rebaseSuggestionsToSpan(suggestions ?? null, span);
        const body =
          rendersTracked(span.text, local, perParagraph[i]) &&
          onDecideTracked ? (
            <TrackedText
              text={span.text}
              suggestions={local}
              onDecide={(s, d) => decideAndArm(s, d, i)}
              textSizeClass={textSizeClass}
              trailing={pill}
              srcOffset={span.start}
              tint={tint}
            />
          ) : (
            <MomentStarText
              text={span.text}
              segments={perParagraph[i]}
              ideal={ideal}
              onMomentTap={onMomentTap}
              foldFor={foldFor}
              sdStars={sdStars}
              textSizeClass={textSizeClass}
              trailing={pill}
              srcOffset={span.start}
              tint={tint}
            />
          );
        return (
          <div key={piece.pieceKey} className="flex flex-col gap-2.5">
            {/* Two pieces on one slide show it once, above the first. */}
            {piecePages && (i === 0 || piecePages[i] !== piecePages[i - 1]) ? (
              <ParagraphSlide
                url={slideUrl!}
                pageIndex={piecePages[i]}
                onError={onSlideError}
              />
            ) : null}
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** D-3 — a mount-scoped back-dismiss entry (same pattern as the moment
 *  sheet: the conditional mount does the pushing). */
function SheetBackDismiss({
  onClose,
  consume,
}: {
  onClose: () => void;
  /** Return true to swallow a Back (busy decision in flight) — the hook
   *  re-arms its history entry so the next Back still works. */
  consume: () => boolean;
}) {
  useBackDismiss(onClose, consume);
  return null;
}

/** FE-2/FE-3 — the pending-swap comparison sheet: incumbent vs challenger,
 *  one fixed why line, two buttons. The host owns the POST + the silent-409
 *  refetch; this sheet only reports the tap and shows busy/failure. */
export function PieceSwapSheet({
  piece,
  onDecide,
  onClose,
}: {
  piece: IdealPiece | null;
  /** Resolves when the decision round-trip settles; false = show the retry
   *  line and stay open (the host closes on every other outcome). */
  onDecide: (action: "accept" | "reject") => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setBusy(false);
    setFailed(false);
  }, [piece]);
  if (!piece || !piece.challenger) return null;
  const ch = piece.challenger;
  // Every dismissal routes through the busy guard — a decision in flight
  // must not lose its result handling mid-POST.
  const close = () => {
    if (!busy) onClose();
  };
  const decide = (action: "accept" | "reject") => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onDecide(action).then((ok) => {
      setBusy(false);
      if (!ok) setFailed(true);
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <SheetBackDismiss onClose={onClose} consume={() => busy} />
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Compare takes"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            Compare takes
          </p>
          <OverlayCloseButton onClick={close} ariaLabel="Close comparison" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Your current version
              {piece.takeIndex !== null ? ` · v${piece.takeIndex}.0` : ""}
            </p>
            <p className="text-[15px] leading-relaxed text-foreground">
              {/* Baked folds ({{orange:…}}, **bold**) render as formatting,
                  never as raw marker syntax (review R-db2). */}
              <RichText text={piece.text} />
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-primary">
              {ch.takeIndex !== null ? `Take ${ch.takeIndex}` : "A newer take"}
            </p>
            <p className="text-[15px] leading-relaxed text-foreground">
              <RichText text={ch.text} />
            </p>
          </div>
          {ch.why ? (
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {WHY_COPY[ch.why]}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => decide("accept")}
              className="h-10 flex-1 rounded-full bg-foreground text-[14px] text-background hover:bg-foreground/90"
            >
              Use this version
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => decide("reject")}
              variant="outline"
              className="h-10 flex-1 rounded-full text-[14px]"
            >
              Keep mine
            </Button>
          </div>
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              Couldn&apos;t save that just now. Give it another go.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
