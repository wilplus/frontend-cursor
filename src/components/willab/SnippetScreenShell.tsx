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
  contextStrip,
  /** When false the parent overlay's useBackDismiss handles back — avoids
   *  double history-entry registration. Pass managed={false} when embedded. */
  managed = true,
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
  contextStrip?: ReactNode;
  managed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Only mount the back-dismiss handler when this shell owns history. */}
      {managed ? <BackDismissManager onClose={onClose} /> : null}

      {/* ── ✕ — no bar, no title, no border ── */}
      <div className="flex shrink-0 justify-end px-3 pb-1 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-[17px] w-[17px]" aria-hidden />
        </button>
      </div>

      {/* ── optional sticky context strip (F3 only, ~24px) ── */}
      {contextStrip ? (
        <div className="flex shrink-0 items-center gap-1.5 truncate border-b border-border px-4 pb-2 text-[12px] text-muted-foreground">
          {contextStrip}
        </div>
      ) : null}

      {/* ── scrollable card body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-4">{children}</div>
      </div>

      {/* ── pinned navbar: Back | indicator | Next ── */}
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

          <PageIndicator index={index} total={total} />

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
        </div>
      </div>
    </div>
  );
}

function PageIndicator({ index, total }: { index: number; total: number }) {
  if (total <= 7) {
    return (
      <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full",
              i === index
                ? "h-[7px] w-[7px] bg-primary"
                : "h-[6px] w-[6px] bg-border"
            )}
          />
        ))}
      </div>
    );
  }
  return (
    <span className="shrink-0 tabular-nums text-[12px] text-muted-foreground">
      {index + 1} / {total}
    </span>
  );
}

function BackDismissManager({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}
