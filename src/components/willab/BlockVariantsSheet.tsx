"use client";

import { useEffect, useRef, useState } from "react";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import {
  blockHasChoice,
  type BlockVariant,
  type BlockVariantsPayload,
  type VariantBlock,
} from "@/services/api/blockVariants";
import { VARIANT_PICKER_COPY as COPY } from "./variantPickerCopy";

/* -------------------------------------------------------------------------- */
/*  BlockVariantsSheet — the PICKER (BE spec §4.1/§8, FE-HANDOFF-2026-08-03-   */
/*  variant-picker): per block, every text it has ever had — each take's       */
/*  version plus the student's latest edit — current flagged, pick freely.     */
/*                                                                            */
/*  THE PULL LANE. The offer lane (glowing pending pill → PieceSwapSheet)      */
/*  recommends; this sheet is deliberately NEUTRAL: chronological order,       */
/*  provenance badges only, no why lines, no ranking of any kind (AC-9,        */
/*  spec §6 — merging the two lanes into one ranked list is the exact fence    */
/*  breach to avoid).                                                          */
/*                                                                            */
/*  The sheet STAYS OPEN across selections — mixing several blocks in one      */
/*  sitting is the point (fear #3). The host refetches on every successful     */
/*  select and passes the fresh payload back down; is_current moves, the       */
/*  row's busy state clears, the student keeps going.                          */
/* -------------------------------------------------------------------------- */

/** Mount-scoped back-dismiss (same pattern as the moment sheet). */
function SheetBackDismiss({
  onClose,
  consume,
}: {
  onClose: () => void;
  consume: () => boolean;
}) {
  useBackDismiss(onClose, consume);
  return null;
}

function variantBadge(v: BlockVariant): string {
  if (v.source === "user_edit") return COPY.editBadge;
  return v.takeIndex !== null ? COPY.takeBadge(v.takeIndex) : COPY.takeBadgeUnknown;
}

function VariantRow({
  variant,
  busy,
  onPick,
}: {
  variant: BlockVariant;
  /** True while THIS row's selection round-trip is in flight. */
  busy: boolean;
  /** Absent = not selectable (current, or a pre-pool row with no id). */
  onPick?: () => void;
}) {
  const selectable = !!onPick && !variant.isCurrent && variant.variantId !== null;
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 ${
        variant.isCurrent
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
            variant.isCurrent
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {variantBadge(variant)}
        </span>
        {variant.isCurrent ? (
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
            {COPY.currentMarker}
          </span>
        ) : null}
      </div>
      <p className="text-[15px] leading-relaxed text-foreground">
        {/* Baked folds ({{orange:…}}, **bold**) render as formatting, never
            as raw marker syntax — same rule as the swap sheet (R-db2). */}
        <RichText text={variant.text} />
      </p>
      {selectable ? (
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          className="self-start rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {busy ? COPY.saving : COPY.useVersion}
        </button>
      ) : null}
    </div>
  );
}

function BlockSection({
  block,
  index,
  expanded,
  onToggle,
  busyVariantId,
  onPick,
  anchorRef,
}: {
  block: VariantBlock;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  busyVariantId: string | null;
  onPick: (variantId: string) => void;
  anchorRef?: (el: HTMLDivElement | null) => void;
}) {
  const label = block.label ?? COPY.blockFallbackLabel(index + 1);
  const current = block.variants.find((v) => v.isCurrent) ?? null;
  const openable = blockHasChoice(block);
  return (
    <div ref={anchorRef} className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openable ? onToggle : undefined}
        aria-expanded={expanded}
        className={`flex items-center justify-between gap-2 text-left ${
          openable ? "" : "cursor-default"
        }`}
      >
        <span className="text-[13px] font-semibold text-foreground">
          {label}
        </span>
        {openable ? (
          <span className="text-[12px] text-muted-foreground">
            {expanded ? "–" : "+"}
          </span>
        ) : null}
      </button>
      {expanded && openable ? (
        <div className="flex flex-col gap-2">
          {block.variants.map((v, i) => (
            <VariantRow
              key={v.variantId ?? `current-${i}`}
              variant={v}
              busy={busyVariantId !== null && busyVariantId === v.variantId}
              onPick={
                v.variantId !== null && !v.isCurrent
                  ? () => onPick(v.variantId as string)
                  : undefined
              }
            />
          ))}
        </div>
      ) : current ? (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {current.text}
        </p>
      ) : null}
    </div>
  );
}

export function BlockVariantsSheet({
  payload,
  initialBlockKey,
  onSelect,
  onClose,
}: {
  payload: BlockVariantsPayload;
  /** Deep link from a paragraph's version pill (keyed on block_key, spec
   *  §4.1) — the sheet opens with this block expanded and scrolled into
   *  view. null/absent = the header entry, first choiceful block expands. */
  initialBlockKey?: number | null;
  /** Resolves true when the select round-trip settled (saved OR silently
   *  stale — the host refetched either way); false = show the retry line. */
  onSelect: (blockKey: number, variantId: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const firstChoice =
    initialBlockKey ??
    payload.blocks.find((b) => blockHasChoice(b))?.blockKey ??
    null;
  const [expandedKey, setExpandedKey] = useState<number | null>(firstChoice);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const anchorRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // The deep-linked block scrolls into view once, on mount.
  useEffect(() => {
    if (initialBlockKey === null || initialBlockKey === undefined) return;
    const el = anchorRefs.current.get(initialBlockKey);
    if (el) el.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = busyVariantId !== null;
  const close = () => {
    if (!busy) onClose();
  };
  const pick = (blockKey: number, variantId: string) => {
    if (busy) return;
    setBusyVariantId(variantId);
    setFailed(false);
    void onSelect(blockKey, variantId).then((ok) => {
      setBusyVariantId(null);
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
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={COPY.sheetTitle}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-foreground">
              {COPY.sheetTitle}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {COPY.sheetSubtitle}
            </p>
          </div>
          <OverlayCloseButton onClick={close} ariaLabel="Close versions" />
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
          {payload.blocks
            .filter((b) => b.variants.length > 0)
            .map((b, i) => (
              <BlockSection
                key={b.blockKey}
                block={b}
                index={i}
                expanded={expandedKey === b.blockKey}
                onToggle={() =>
                  setExpandedKey((k) => (k === b.blockKey ? null : b.blockKey))
                }
                busyVariantId={busyVariantId}
                onPick={(variantId) => pick(b.blockKey, variantId)}
                anchorRef={(el) => {
                  if (el) anchorRefs.current.set(b.blockKey, el);
                  else anchorRefs.current.delete(b.blockKey);
                }}
              />
            ))}
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              {COPY.saveFailed}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
