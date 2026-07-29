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
  /** C5 — this page is a coach text message, not a slide. Hide the slide-count
   *  indicator + close X + the dark gradient (there's no slide to dim, and the
   *  gradient overshadows the coach's text). Closing is via the bottom nav. */
  isCoachMessage = false,
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
  isCoachMessage?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {managed ? <BackDismissManager onClose={onClose} /> : null}

      {/* ── slide overlay: X + indicator floated over the slide (hidden for a
          coach message — no slide, and the gradient would overshadow the text) ── */}
      {!isCoachMessage ? (
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
