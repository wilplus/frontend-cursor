"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { MomentStarText } from "./MomentStars";
import { RichText } from "./RichText";
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
  type IdealText,
  type SwapWhy,
} from "@/services/api/idealText";
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

/** The one fixed line behind each swap reason. Closed key set (BE-clamped);
 *  anything else renders NO line — never guess. Copy pending founder
 *  sign-off. */
export const WHY_COPY: Record<SwapWhy, string> = {
  energy: "This take carried more energy in the delivery.",
  steadiness: "This take gave the words more room to breathe.",
  coverage: "This take stayed tighter to your slide.",
  overall: "This take simply landed better overall.",
};

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
  suggestions,
  onDecideTracked,
  onMomentTap,
  foldFor,
  sdStars,
  textSizeClass,
  onOpenSwap,
  tint,
  deck,
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
  text: string;
  ideal: IdealText;
  pieces: IdealPiece[] | null;
  onMomentTap: (m: IdealKeyMomentLink) => void;
  foldFor?: (m: IdealKeyMomentLink) => LocalFold | null;
  sdStars?: boolean;
  textSizeClass?: string;
  onOpenSwap: (piece: IdealPiece) => void;
  /** The arc's deck PDF for the slide-per-paragraph read. null/absent = no
   *  deck → no slides, today's view exactly. */
  deck?: { presentationRef: string } | null;
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
  // D-2 (paragraph spacing) — even WITHOUT the piece-badge layer, split the
  // same "\n\n" paragraphs the BE joins on (offset-safe: no chars change) and
  // slice the document segments per paragraph, so the no-pieces fallback spaces
  // its paragraphs with `gap-4` like the badged path instead of one tight block.
  // Passing the pre-sliced `segments` avoids re-matching a recurring anchor's
  // star into every paragraph it textually appears in.
  const fbSpans = useMemo(() => splitBadgeParagraphSpans(text), [text]);
  const fbSlices = useMemo(
    () =>
      fbSpans.length > 1
        ? sliceSegmentsByParagraphs(
            segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
            fbSpans
          )
        : null,
    [fbSpans, text, ideal.keyPhrases, ideal.keyMoments]
  );
  // Which lane owns the WORDS. Two hard conditions (review R-lt6/R-lt1):
  //
  //  1. The tracked lane may never DELETE the star layer. key_moments carries
  //     the moment stars, approve folds, the moment sheet (the only entry to
  //     the moments unlock) and the delivery re-record. Under BE-C those
  //     lanes MERGE into `suggestions`, so the BE stops sending key_moments —
  //     which is exactly when this flips on. While both are served, today's
  //     view wins and the new lane simply is not drawn yet.
  //  2. Gate on what actually RESOLVES, not the raw list: an all-advice,
  //     all-stale or all-decided payload resolves to nothing, and rendering
  //     the tracked lane then would paint a bare paragraph with no stars,
  //     no pills and no affordances at all.
  const starsPresent = ideal.keyMoments.length > 0;
  const rendersTracked = (
    t: string,
    list: DocumentSuggestion[] | null | undefined
  ): boolean =>
    !!onDecideTracked &&
    !starsPresent &&
    (resolveTrackedSuggestions(t, list ?? null).length > 0 ||
      resolveAdviceSpans(t, list ?? null).length > 0);
  if (!pieces || !spans || !perParagraph) {
    // SLIDES without the piece layer: only the exact-count mapping is provable
    // (no per-piece slide_index to lean on).
    const fbPages = slideUrl
      ? slidePagesForParagraphs(fbSpans.length, null, pageCount)
      : null;
    if (rendersTracked(text, suggestions) && onDecideTracked) {
      // Tracked lane. With a provable slide mapping the document renders per
      // paragraph — suggestions rebased to each span exactly as the badged
      // path below does (a straddler is dropped, never guessed) — so every
      // paragraph can sit under its slide. No mapping → one block, today's
      // view exactly.
      if (fbPages) {
        return (
          <div className="flex flex-col gap-4">
            {fbSpans.map((span, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                {i === 0 || fbPages[i] !== fbPages[i - 1] ? (
                  <ParagraphSlide
                    url={slideUrl!}
                    pageIndex={fbPages[i]}
                    onError={onSlideError}
                  />
                ) : null}
                <TrackedText
                  text={span.text}
                  suggestions={rebaseSuggestionsToSpan(suggestions ?? null, span)}
                  onDecide={onDecideTracked}
                  textSizeClass={textSizeClass}
                  srcOffset={span.start}
                  tint={tint}
                />
              </div>
            ))}
          </div>
        );
      }
      return (
        <TrackedText
          text={text}
          suggestions={suggestions ?? null}
          onDecide={onDecideTracked}
          textSizeClass={textSizeClass}
          tint={tint}
        />
      );
    }
    if (fbSlices) {
      // D-2 — multi-paragraph doc without pieces: one MomentStarText per
      // paragraph in a gap-4 stack, so paragraphs read spaced (no pills).
      return (
        <div className="flex flex-col gap-4">
          {fbSpans.map((span, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              {fbPages && (i === 0 || fbPages[i] !== fbPages[i - 1]) ? (
                <ParagraphSlide
                  url={slideUrl!}
                  pageIndex={fbPages[i]}
                  onError={onSlideError}
                />
              ) : null}
              <MomentStarText
                text={span.text}
                segments={fbSlices[i]}
                ideal={ideal}
                onMomentTap={onMomentTap}
                foldFor={foldFor}
                sdStars={sdStars}
                textSizeClass={textSizeClass}
                srcOffset={span.start}
                tint={tint}
              />
            </div>
          ))}
        </div>
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
        const pill = (
          <PiecePill
            piece={piece}
            fresh={latest !== null && piece.takeIndex === latest}
            onOpenSwap={onOpenSwap}
          />
        );
        // FE-3+FE-4 compose: tracked changes render the words, the version
        // pill still rides at the paragraph's end. Suggestions are rebased to
        // paragraph-local offsets (one straddling a boundary is dropped), and
        // the decision is PER PARAGRAPH — a paragraph whose suggestions all
        // went stale keeps its stars instead of going bare.
        const local = rebaseSuggestionsToSpan(suggestions ?? null, span);
        const body =
          rendersTracked(span.text, local) && onDecideTracked ? (
            <TrackedText
              text={span.text}
              suggestions={local}
              onDecide={onDecideTracked}
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
