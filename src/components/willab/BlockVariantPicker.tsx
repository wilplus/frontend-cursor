"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
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

/** The per-paragraph picker entry: a quiet chip beside the take badge. Drawn
 *  only when the block offers a real choice (§8.3 — a single-entry list gets
 *  no affordance); the host decides where it rides (PieceBadgeText trailing).
 *  Deliberately styled like the settled provenance pill, NOT like the glowing
 *  offer — the picker pulls, the offer pushes. */
export function VariantChip({
  block,
  onOpen,
}: {
  block: VariantBlock;
  onOpen: (block: VariantBlock) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(block)}
      className="ml-1.5 inline-flex -translate-y-px items-center rounded-full border border-border bg-background px-1.5 py-0.5 align-middle text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {BLOCK_VARIANT_COPY.entry}
    </button>
  );
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

/** The timeline entry button for an overlay header. The host renders it only
 *  when the timeline has rows (an empty list is a real state — pre-migration
 *  arc — and hides the timeline entirely, §4.3). */
export function TimelineEntryButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={BLOCK_VARIANT_COPY.timelineEntry}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <History className="h-4 w-4" aria-hidden />
    </button>
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

/** The revision timeline sheet: newest first as served, each row a
 *  qualitative reason line + a date — revision NUMBERS never render (they
 *  are restore keys, not progress). Tapping a non-head row unfolds the
 *  restore action with the reassurance line; restore repoints what that
 *  revision recorded and never deletes. */
export function RevisionTimelineSheet({
  open,
  revisions,
  onRestore,
  onClose,
}: {
  open: boolean;
  revisions: IdealTextRevision[];
  /** Resolves when the restore round-trip settles; false = show the retry
   *  line and stay open (the host closes on every other outcome). */
  onRestore: (revision: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The row unfolded to its restore action (a revision number — plumbing). */
  const [armed, setArmed] = useState<number | null>(null);
  useEffect(() => {
    setBusy(false);
    setFailed(false);
    setArmed(null);
  }, [open]);
  if (!open) return null;
  const close = () => {
    if (!busy) onClose();
  };
  const restore = (revision: number) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onRestore(revision).then((ok) => {
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
        aria-label={BLOCK_VARIANT_COPY.timelineTitle}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            {BLOCK_VARIANT_COPY.timelineTitle}
          </p>
          <OverlayCloseButton onClick={close} ariaLabel="Close history" />
        </div>
        <div className="scrollbar-none flex flex-col gap-2 overflow-y-auto">
          {revisions.map((r) => {
            const date = revisionDate(r.createdAt);
            const unfolded = armed === r.revision;
            return (
              <div
                key={r.revision}
                className={`rounded-xl border px-3 py-2.5 ${
                  unfolded ? "border-foreground/30" : "border-border"
                }`}
              >
                <button
                  type="button"
                  // The head row has nothing to bring back — it is what is
                  // live now — so it never unfolds.
                  onClick={() =>
                    r.isHead ? undefined : setArmed(unfolded ? null : r.revision)
                  }
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-[14px] text-foreground">
                      {BLOCK_VARIANT_COPY.reason[r.reason]}
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
                  <div className="mt-2 flex flex-col gap-2">
                    {/* The honest framing (§4.4): bring back that version's
                        CHOICES. Blocks added since stay; nothing deletes. */}
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      {BLOCK_VARIANT_COPY.restoreReassurance}
                    </p>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => restore(r.revision)}
                      className="h-9 rounded-full bg-foreground text-[13px] text-background hover:bg-foreground/90"
                    >
                      {BLOCK_VARIANT_COPY.restore}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              {BLOCK_VARIANT_COPY.restoreFailed}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
