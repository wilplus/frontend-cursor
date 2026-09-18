"use client";

import { type ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackDismiss } from "./useBackDismiss";

export default function SnippetScreenShell({
  onClose,
  index,
  total,
  onPrev,
  onNext,
  nextLabel,
  nextTone = "primary",
  backDisabled,
  nextDisabled = false,
  /** Hide the Next button entirely (the coach wrap-up owns its own actions —
   *  "Open the ideal text" / Save / Publish — so there is no "next" there). */
  hideNext = false,
  /** When false the parent overlay's useBackDismiss handles back — avoids
   *  double history-entry registration. Pass managed={false} when embedded. */
  managed = true,
  /** Is there a SLIDE behind the floating chrome? The indicator, the close X
   *  and the dark gradient under them exist to stay legible over a slide
   *  image. With no slide there is nothing to dim, and the gradient renders as
   *  a grey smear across the top of a white card — so the whole block is
   *  dropped and closing happens via the bottom nav.
   *
   *  Was `isCoachMessage` (C5, the coach wrap-up). Renamed 2026-09-18 when the
   *  blind judgement pass hit the same problem for the same reason: the flag
   *  was never about coach messages, it was about whether a slide is behind. */
  hasSlideBehind = true,
  children,
}: {
  onClose: () => void;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextTone?: "primary" | "terminal";
  backDisabled?: boolean;
  nextDisabled?: boolean;
  hideNext?: boolean;
  managed?: boolean;
  hasSlideBehind?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {managed ? <BackDismissManager onClose={onClose} /> : null}

      {/* ── slide overlay: X + indicator floated over the slide. Rendered only
          when a slide is actually behind them — otherwise the gradient dims
          nothing and smears the top of the page (see hasSlideBehind). ── */}
      {hasSlideBehind ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <div className="mx-auto w-full max-w-2xl">
            <div className="pointer-events-auto flex items-start justify-between bg-gradient-to-b from-black/40 to-transparent px-3 pb-8 pt-2">
              <SlideIndicator index={index} total={total} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
              >
                <X className="h-[16px] w-[16px]" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── scrollable content — slide first (edge-to-edge), then padded body ── */}
      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>

      {/* ── pinned navbar: Back | Next ── */}
      <div className="shrink-0 border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={backDisabled ?? index === 0}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-[15px] text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="h-[17px] w-[17px]" aria-hidden />
            Back
          </button>

          {hideNext ? null : (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-medium disabled:opacity-40",
                nextTone === "terminal"
                  ? "bg-foreground text-background"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {nextLabel ?? "Next"}
              <ArrowRight className="h-[17px] w-[17px]" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideIndicator({ index, total }: { index: number; total: number }) {
  if (total <= 7) {
    return (
      <div className="flex items-center gap-1.5 py-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full",
              i === index ? "h-[7px] w-[7px] bg-white" : "h-[6px] w-[6px] bg-white/40"
            )}
          />
        ))}
      </div>
    );
  }
  return (
    <span className="py-1 tabular-nums text-[12px] text-white">
      {index + 1} / {total}
    </span>
  );
}

function BackDismissManager({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}
