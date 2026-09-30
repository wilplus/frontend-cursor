"use client";

/* -------------------------------------------------------------------------- */
/*  L2 · Pattern (founder 2026-09-30, A8; build plan P2-13). Outside a moment  */
/*  nothing fired, so the pattern is chosen first: a detected error (an       */
/*  exercise), a read or a cue (a praise line), or a move (a rewrite move).   */
/*  Named-only errors are locked: they cannot route an exercise yet.          */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import type { PatternOption } from "./CoachHomeSheet";
import { CUE_OPTIONS, REWRITE_MOVES } from "@/lib/willab/coachAnswer";
import type { MomentKind } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";

export interface PatternChoice {
  kind: MomentKind;
  patternKey: string;
}

function Group({ eyebrow, options, chosen, onPick, testid }: {
  eyebrow: string;
  options: PatternOption[];
  chosen: string | null;
  onPick: (key: string) => void;
  testid: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" data-testid={testid}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={o.locked}
            aria-pressed={chosen === o.key}
            onClick={() => onPick(o.key)}
            className={`rounded-full border px-3 py-1 text-[13px] transition-colors disabled:opacity-40 ${
              chosen === o.key ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted"}`}
          >
            {o.locked ? "🔒 " : ""}{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CoachPatternSheet({
  errors,
  onClose,
  onNext,
}: {
  errors: PatternOption[];
  onClose: () => void;
  onNext: (choice: PatternChoice) => void;
}) {
  const [choice, setChoice] = useState<PatternChoice | null>(null);
  const pager: Pager = { index: 0, total: 4, label: COPY.pillNew, onBack: onClose, onNext: () => choice && onNext(choice) };
  const detected = errors.filter((e) => !e.locked);
  const named = errors.filter((e) => e.locked);

  return (
    <SheetFrame
      title={COPY.patternTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={
        <button type="button" className={PILL} disabled={!choice} onClick={() => choice && onNext(choice)} data-testid="coach-pattern-next">
          {COPY.pillNextNoVideo}
        </button>
      }
    >
      <div className="flex flex-col gap-3" data-testid="coach-pattern-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{COPY.patternEyebrow}</span>
        <Group eyebrow={COPY.patternErrors} options={detected} testid="coach-pattern-errors"
          chosen={choice?.kind === "error" ? choice.patternKey : null}
          onPick={(key) => setChoice({ kind: "error", patternKey: key })} />
        <Group eyebrow={COPY.patternPraise} testid="coach-pattern-praise"
          options={[{ key: "confident_read", label: COPY.homeConfidentRead }, ...CUE_OPTIONS]}
          chosen={choice?.kind === "praise" ? choice.patternKey : null}
          onPick={(key) => setChoice({ kind: "praise", patternKey: key })} />
        <Group eyebrow={COPY.patternRewrite} testid="coach-pattern-rewrite"
          options={REWRITE_MOVES.map((m) => ({ key: m, label: COPY.homeMoves[m] }))}
          chosen={choice?.kind === "rewrite" ? choice.patternKey : null}
          onPick={(key) => setChoice({ kind: "rewrite", patternKey: key })} />
        <Group eyebrow={COPY.patternNamedOnly} options={named} chosen={null} onPick={() => {}} testid="coach-pattern-named" />
      </div>
    </SheetFrame>
  );
}
