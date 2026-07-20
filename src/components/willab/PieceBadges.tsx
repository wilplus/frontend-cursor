"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { MomentStarText } from "./MomentStars";
import { RichText } from "./RichText";
import {
  latestTakeIndex,
  sliceSegmentsByParagraphs,
  splitBadgeParagraphSpans,
} from "@/lib/willab/pieceBadges";
import {
  segmentIdealText,
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
const WHY_COPY: Record<SwapWhy, string> = {
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

/** The badged reading view: MomentStarText per paragraph + its piece's pill.
 *  pieces null (flag off) or a paragraph/piece count mismatch → ONE plain
 *  MomentStarText, exactly today's view. The star lanes are untouched: stars
 *  own how to deliver, badges own which take (FE-5). */
export function PieceBadgeText({
  text,
  ideal,
  pieces,
  onMomentTap,
  foldFor,
  sdStars,
  textSizeClass,
  onOpenSwap,
}: {
  text: string;
  ideal: IdealText;
  pieces: IdealPiece[] | null;
  onMomentTap: (m: IdealKeyMomentLink) => void;
  foldFor?: (m: IdealKeyMomentLink) => LocalFold | null;
  sdStars?: boolean;
  textSizeClass?: string;
  onOpenSwap: (piece: IdealPiece) => void;
}) {
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
  if (!pieces || !spans || !perParagraph) {
    return (
      <MomentStarText
        text={text}
        ideal={ideal}
        onMomentTap={onMomentTap}
        foldFor={foldFor}
        sdStars={sdStars}
        textSizeClass={textSizeClass}
      />
    );
  }
  const latest = latestTakeIndex(pieces);
  return (
    <div className="flex flex-col gap-4">
      {spans.map((span, i) => {
        const piece = pieces[i];
        return (
          <MomentStarText
            key={piece.pieceKey}
            text={span.text}
            segments={perParagraph[i]}
            ideal={ideal}
            onMomentTap={onMomentTap}
            foldFor={foldFor}
            sdStars={sdStars}
            textSizeClass={textSizeClass}
            trailing={
              <PiecePill
                piece={piece}
                fresh={latest !== null && piece.takeIndex === latest}
                onOpenSwap={onOpenSwap}
              />
            }
          />
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
