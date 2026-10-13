"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import { BLOCK_VARIANT_COPY } from "./blockVariantCopy";
import type {
  BlockVariant,
  IdealTextRevision,
  VariantBlock,
} from "@/services/api/blockVariants";

/* -------------------------------------------------------------------------- */
/*  BlockVariantPicker — the per-block variant picker + the revision timeline  */
/*  (BLOCK_VARIANTS_ENABLED, BE handoff 2026-08-03)                            */
/*                                                                            */
/*  Three user fears this surfaces the answer to: nothing recorded is ever     */
/*  lost (the pool is append-only), a worse next take can be walked back       */
/*  (restore), and takes can be MIXED per block (select). Granularity is       */
/*  BLOCK-LEVEL by founder decision — no sentence-level expansion in v1.       */
/*                                                                            */
/*  AC-9 fences (load-bearing, §6):                                            */
/*   · The picker is NEUTRAL — variants render in served (chronological)       */
/*     order, presented as time, never quality. No "best", no sorting, no      */
/*     stars, no comparative copy anywhere in here. The offer lane (glowing    */
/*     pill → comparison sheet) keeps the recommendation and stays a           */
/*     visually distinct surface.                                              */
/*   · take_index renders as the existing provenance badge convention          */
/*     ("Take N"), never a score or count of improvements.                     */
/*   · revision numbers are plumbing — used as restore keys, never featured    */
/*     as progress numbers (timeline rows show reason copy + a date only).     */
/* -------------------------------------------------------------------------- */

/** D-3 — a mount-scoped back-dismiss entry (same pattern as the swap sheet:
 *  the conditional mount does the pushing). */
function SheetBackDismiss({
  onClose,
  consume,
}: {
  onClose: () => void;
  /** Return true to swallow a Back (a write in flight) — the hook re-arms
   *  its history entry so the next Back still works. */
  consume: () => boolean;
}) {
  useBackDismiss(onClose, consume);
  return null;
}

/** One variant's provenance badge line. Provenance only — never judgment. */
function variantBadge(v: BlockVariant): string {
  if (v.source === "user_edit") return BLOCK_VARIANT_COPY.userEditBadge;
  return v.takeIndex !== null
    ? BLOCK_VARIANT_COPY.takeBadge(v.takeIndex)
    : BLOCK_VARIANT_COPY.takeBadgeUnknown;
}

/** The picker bottom sheet: the block's pool in served (chronological) order,
 *  current highlighted, full text readable (block texts can be long — the
 *  sheet scrolls), tap the select button → the host POSTs, refetches and
 *  closes. A `variantId: null` entry is display-only current (a pre-pool
 *  incumbent): it renders, it is flagged current, it is never selectable. */
export function BlockVariantSheet({
  block,
  onSelect,
  onClose,
}: {
  block: VariantBlock | null;
  /** Resolves when the select round-trip settles; false = show the retry
   *  line and stay open (the host closes on every other outcome). */
  onSelect: (block: VariantBlock, variant: BlockVariant) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setBusy(false);
    setFailed(false);
  }, [block]);
  if (!block) return null;
  // Every dismissal routes through the busy guard — a select in flight must
  // not lose its result handling mid-POST.
  const close = () => {
    if (!busy) onClose();
  };
  const select = (variant: BlockVariant) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onSelect(block, variant).then((ok) => {
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
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={BLOCK_VARIANT_COPY.entry}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            {/* The block's label when the BE serves one; the neutral entry
                word otherwise. */}
            {block.label || BLOCK_VARIANT_COPY.entry}
          </p>
          <OverlayCloseButton onClick={close} ariaLabel="Close versions" />
        </div>
        <div className="scrollbar-none flex flex-col gap-3 overflow-y-auto">
          {/* Served order IS the render order: take variants by take order,
              then the student's latest edit last. Chronology, not ranking
              (AC-9) — nothing here may re-sort. */}
          {block.variants.map((v, i) => (
            <div
              key={v.variantId ?? `current-${i}`}
              className={`rounded-xl border border-border px-3 py-2.5 ${
                v.isCurrent ? "bg-muted/40" : ""
              }`}
            >
              <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {variantBadge(v)}
                {v.isCurrent ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
                    {BLOCK_VARIANT_COPY.currentMarker}
                  </span>
                ) : null}
              </p>
              <p className="text-[15px] leading-relaxed text-foreground">
                {/* Baked folds render as formatting, never raw marker syntax
                    (same rule as the swap sheet, R-db2). */}
                <RichText text={v.text} />
              </p>
              {/* Selectable = carries an id and is not already live. The
                  select is non-destructive always (the displaced text goes
                  back to the pool), so there is deliberately NO
                  confirmation-of-loss step here — there is no loss. */}
              {v.variantId !== null && !v.isCurrent ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => select(v)}
                  variant="outline"
                  className="mt-2 h-9 w-full rounded-full text-[13px]"
                >
                  {BLOCK_VARIANT_COPY.select}
                </Button>
              ) : null}
            </div>
          ))}
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              {BLOCK_VARIANT_COPY.selectFailed}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A revision's date line. null/unparseable → no line (never guess). */
function revisionDate(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The History under ⋯ (lock 2026-10-12, section 4): every version of the
 *  document, newest first as served, each row its Take and a date — revision
 *  NUMBERS never render. Tapping an older row unfolds its words. Read only:
 *  rule 5 — the Ideal Text is what the latest Take said, so an old version
 *  is shown, never brought back. */
export function RevisionTimelineSheet({
  open,
  revisions,
  onClose,
}: {
  open: boolean;
  revisions: IdealTextRevision[];
  onClose: () => void;
}) {
  /** The row unfolded to its words (a revision number — plumbing). */
  const [unfoldedAt, setUnfoldedAt] = useState<number | null>(null);
  useEffect(() => {
    setUnfoldedAt(null);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <SheetBackDismiss onClose={onClose} consume={() => false} />
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={BLOCK_VARIANT_COPY.timelineTitle}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            {BLOCK_VARIANT_COPY.timelineTitle}
          </p>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close history" />
        </div>
        <div className="scrollbar-none flex flex-col gap-2 overflow-y-auto">
          {revisions.map((r) => {
            const date = revisionDate(r.createdAt);
            const unfolded = unfoldedAt === r.revision;
            return (
              <div
                key={r.revision}
                className={`rounded-xl border px-3 py-2.5 ${
                  unfolded ? "border-foreground/30" : "border-border"
                }`}
              >
                <button
                  type="button"
                  // The head row is what is on the page now, so it never
                  // unfolds.
                  onClick={() =>
                    r.isHead ? undefined : setUnfoldedAt(unfolded ? null : r.revision)
                  }
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-[14px] text-foreground">
                      {r.takeIndex !== null
                        ? BLOCK_VARIANT_COPY.takeBadge(r.takeIndex)
                        : BLOCK_VARIANT_COPY.takeBadgeUnknown}
                    </span>
                    {date ? (
                      <span className="text-[12px] text-muted-foreground">
                        {date}
                      </span>
                    ) : null}
                  </span>
                  {r.isHead ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {BLOCK_VARIANT_COPY.currentMarker}
                    </span>
                  ) : null}
                </button>
                {unfolded && !r.isHead ? (
                  <div className="mt-2 flex flex-col gap-3 text-[14px] leading-relaxed text-foreground">
                    {r.text.split("\n\n").map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
