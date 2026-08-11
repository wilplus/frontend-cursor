"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import type { IdealPiece } from "@/services/api/idealText";
import { WHY_COPY } from "@/lib/willab/trackedChangeWhy";

/* -------------------------------------------------------------------------- */
/*  PieceBadges — what is LEFT of the discernment layer: the pending-swap      */
/*  comparison sheet.                                                          */
/*                                                                            */
/*  The badged reading view (PieceBadgeText — per-paragraph version pills,     */
/*  the star text, the tracked-change layer) is GONE: the transcript review    */
/*  deck (founder 2026-08-11) is the reading surface now, and its chunks carry */
/*  the decisions the pills and stars used to. What survives here is the       */
/*  cross-take comparison the deck still opens by other means.                 */
/*                                                                            */
/*  AC-9: no percentages, no counts, no scores — version numbers only.         */
/* -------------------------------------------------------------------------- */

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

