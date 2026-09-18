"use client";

import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { CoachEyebrow } from "./coachChrome";

/* -------------------------------------------------------------------------- */
/*  CoachJudgementQueue — the chrome every blind pass wears (2026-09-18).      */
/*                                                                            */
/*  There are three places the coach answers the same blind question with the  */
/*  same instrument: the corpus label queue, the take review's first pass, and */
/*  the Feedbacks review's first pass. They wore three different chromes — one */
/*  paged with progress dots, one floating over a dark gradient meant for a    */
/*  slide that is not there, one a single long scroll with no progress at all. */
/*                                                                            */
/*  This is the corpus queue's shape, extracted so the three cannot drift      */
/*  again. It is CHROME ONLY, like coachChrome beside it: no direction labels, */
/*  no star families, no verdicts, and it imports neither lane. What goes in   */
/*  the body is the caller's business.                                        */
/*                                                                            */
/*  AC-9: the count is progress — how much is done, never how well. A filled   */
/*  dot means only "answered".                                                 */
/*  N2: `items` renders in the order given. The queue is band-shuffled         */
/*  server-side so position is not a tell; re-sorting here rebuilds the tell.  */
/* -------------------------------------------------------------------------- */

export interface JudgementQueueItem {
  /** Stable identity for the dot, and what `savingId` is compared against. */
  id: string;
  answered: boolean;
}

export default function CoachJudgementQueue({
  title,
  eyebrow,
  items,
  index,
  savingId = null,
  onJump,
  onBack,
  onClose,
  forward,
  children,
}: {
  title: string;
  eyebrow?: string;
  items: readonly JudgementQueueItem[];
  index: number;
  /** The piece with a write in flight — its dot pulses amber. */
  savingId?: string | null;
  onJump: (index: number) => void;
  onBack: () => void;
  onClose: () => void;
  /** The one forward control. `tone: "primary"` is the black action the coach
   *  is meant to take next; "quiet" is the bordered Skip on an unanswered
   *  piece. Absent → no forward control (nowhere left to go). */
  forward?: {
    label: string;
    onClick: () => void;
    tone?: "primary" | "quiet";
    disabled?: boolean;
    busy?: boolean;
  };
  children: ReactNode;
}) {
  const answered = items.filter((i) => i.answered).length;
  const all = items.length > 0 && answered === items.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
          {eyebrow ? <CoachEyebrow>{eyebrow}</CoachEyebrow> : null}
        </span>
        <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {items.map((item, i) => {
            const saving = savingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Piece ${i + 1}${
                  saving ? ", saving" : item.answered ? ", answered" : ""
                }`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => onJump(i)}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                  i === index
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                    : ""
                }`}
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full border transition-colors ${
                    saving
                      ? "animate-pulse border-amber-500 bg-amber-400"
                      : item.answered
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/50 bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
        {savingId ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Saving…
          </span>
        ) : all ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            All labelled
          </span>
        ) : (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {answered} / {items.length} labelled
          </span>
        )}
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-4 py-4">
          {children}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-[15px] text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="h-[17px] w-[17px]" aria-hidden />
            Back
          </button>
          {forward ? (
            <button
              type="button"
              onClick={forward.onClick}
              disabled={forward.disabled || forward.busy}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-40 ${
                forward.tone === "quiet"
                  ? "border border-border font-normal text-foreground"
                  : "bg-foreground text-background"
              }`}
            >
              {forward.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {forward.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
