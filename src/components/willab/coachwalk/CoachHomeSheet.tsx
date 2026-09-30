"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 6 · Home (founder 2026-09-30, A6; build plan P2-11, P2-4).           */
/*                                                                            */
/*  Where the answer lives. For an exercise: its name, the one main target    */
/*  (required), what else it treats. For a praise line: the cue or the read   */
/*  it is filed under, or "keep it to this speaker". For a clearer version:   */
/*  the move, for the learning record only (a version never joins the shelf). */
/*  One primary (Share with the speaker, or Save outside a moment) and the    */
/*  way out (Save to the library only, or Share without the library).         */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import { REWRITE_MOVES, type AnswerPlan, type HomeState } from "@/lib/willab/coachAnswer";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

export interface PatternOption {
  key: string;
  label: string;
  /** Named only; cannot route (the chip is shown locked). */
  locked?: boolean;
}

function Box({ eyebrow, tone = "plain", children }: {
  eyebrow: string; tone?: "plain" | "orange"; children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 ${
      tone === "orange" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <span className={`text-[11px] font-medium uppercase tracking-[0.12em] ${
        tone === "orange" ? "text-primary" : "text-muted-foreground"}`}>{eyebrow}</span>
      {children}
    </div>
  );
}

function Chips({ options, selected, onToggle, single = false, testid }: {
  options: PatternOption[];
  selected: string[];
  onToggle: (key: string) => void;
  single?: boolean;
  testid?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testid} role={single ? "radiogroup" : "group"}>
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            disabled={o.locked}
            aria-pressed={on}
            onClick={() => onToggle(o.key)}
            className={`rounded-full border px-3 py-1 text-[13px] transition-colors disabled:opacity-40 ${
              on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted"}`}
          >
            {o.locked ? "🔒 " : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CoachHomeSheet({
  plan,
  pager,
  pseudonym,
  errors,
  cues,
  home,
  onChange,
  problem,
  busy,
  error,
  onClose,
  onPrimary,
  onSecondary,
}: {
  plan: AnswerPlan;
  pager: Pager;
  /** null outside a moment (the library): the primary is Save. */
  pseudonym: string | null;
  /** The error library (detected first; named-only locked). */
  errors: PatternOption[];
  /** The delivery cues a praise line may be filed under. */
  cues: PatternOption[];
  home: HomeState;
  onChange: (next: HomeState) => void;
  /** Why it cannot go on yet, or null. */
  problem: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** Share with the speaker (in a moment) or Save (the library). */
  onPrimary: () => void;
  /** The way out: library only (in a moment), or share without the library. */
  onSecondary: () => void;
}) {
  const inMoment = pseudonym !== null;
  const eyebrow = inMoment ? COPY.homeEyebrowShare(pseudonym) : COPY.homeEyebrowLibrary;
  const also = errors.filter((e) => e.key !== home.mainTarget);

  return (
    <SheetFrame
      title={COPY.homeTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={
        <div className="flex flex-col gap-0.5">
          <button type="button" className={PILL} disabled={busy || problem !== null} onClick={onPrimary} data-testid="coach-home-primary">
            {inMoment ? COPY.pillShare(pseudonym) : COPY.pillSaveLibrary}
          </button>
          {inMoment ? (
            <button type="button" className={LINK} disabled={busy} onClick={onSecondary} data-testid="coach-home-secondary">
              {plan.home === "exercise" ? COPY.linkLibraryOnly : COPY.linkShareOnly}
            </button>
          ) : null}
          {problem ? <p className="text-center text-[13px] text-muted-foreground">{problem}</p> : null}
          {error ? <p role="alert" className="text-center text-[13px] text-destructive">{error}</p> : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-testid="coach-home-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</span>
        {plan.home === "exercise" ? (
          <>
            <Box eyebrow={COPY.homeName}>
              <input
                value={home.name}
                onChange={(e) => onChange({ ...home, name: e.target.value })}
                placeholder={COPY.homeNamePlaceholder}
                data-testid="coach-home-name"
                className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none"
              />
            </Box>
            <Box eyebrow={COPY.homeMainTarget} tone="orange">
              <Chips single testid="coach-home-target" options={errors}
                selected={home.mainTarget ? [home.mainTarget] : []}
                onToggle={(key) => onChange({
                  ...home, mainTarget: key, alsoTreats: home.alsoTreats.filter((t) => t !== key),
                })} />
            </Box>
            <Box eyebrow={COPY.homeAlsoTreats}>
              <Chips options={also} selected={home.alsoTreats}
                onToggle={(key) => onChange({
                  ...home,
                  alsoTreats: home.alsoTreats.includes(key)
                    ? home.alsoTreats.filter((t) => t !== key) : [...home.alsoTreats, key],
                })} />
            </Box>
          </>
        ) : plan.home === "line" ? (
          <>
            <Box eyebrow={COPY.homePatternPraise} tone="orange">
              <Chips single testid="coach-home-pattern"
                options={[{ key: "confident_read", label: COPY.homeConfidentRead }, ...cues]}
                selected={home.patternKey ? [home.patternKey] : []}
                onToggle={(key) => onChange({ ...home, patternKey: key })} />
            </Box>
            <label className="flex items-center gap-2 text-[14px] text-foreground">
              <input type="checkbox" checked={home.keepToSpeaker}
                onChange={(e) => onChange({ ...home, keepToSpeaker: e.target.checked })} />
              {COPY.homeKeepToSpeaker}
            </label>
          </>
        ) : plan.home === "version" ? (
          <Box eyebrow={COPY.homePatternRewrite} tone="orange">
            <Chips single testid="coach-home-pattern"
              options={REWRITE_MOVES.map((m) => ({ key: m, label: COPY.homeMoves[m] }))}
              selected={home.patternKey ? [home.patternKey] : []}
              onToggle={(key) => onChange({ ...home, patternKey: key })} />
          </Box>
        ) : null}
      </div>
    </SheetFrame>
  );
}
