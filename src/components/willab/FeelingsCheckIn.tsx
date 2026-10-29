"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { StepHead, WizardCancel, WizardProgress } from "@/components/ui/wizard";
import { feelingsAllowed } from "@/services/api/plan";
import { clearFeeling, recordFeeling, type Feeling } from "./willabFeelings";

/* -------------------------------------------------------------------------- */
/*  FeelingsCheckIn — "How do you feel?" before a Take (U10)                   */
/*                                                                            */
/*  The set-up's first step in the set-up's own chrome (founder 2026-10-29,    */
/*  backend N271): its dots and ✕, its heading with the mic, then the four     */
/*  feelings and a faded Skip under Calm. Naming the state is the point — it   */
/*  takes the edge off the mic. The pick is kept for the coach; nothing is     */
/*  said back. Only a signed-in speaker is asked; a guest goes straight on.    */
/* -------------------------------------------------------------------------- */

const FEELINGS: { key: Feeling; label: string }[] = [
  { key: "nervous", label: "Nervous" },
  { key: "excited", label: "Excited" },
  { key: "calm", label: "Calm" },
  { key: "unsure", label: "Not sure" },
];

/** The pick shows for a beat, then the set-up opens. Short enough to stay
 *  inside the tap's activation window, which the mic start after it needs. */
const ADVANCE_MS = 450;

export default function FeelingsCheckIn({
  ask,
  setupSteps,
  onReady,
  onCancel,
}: {
  /** Signed in. A guest is never asked (backend N271). */
  ask: boolean;
  /** The set-up's steps that follow this one; 0 when the project's setup is
   *  restored, and the bar then holds the ✕ alone. */
  setupSteps: number;
  /** `shown`: the screen was on screen (a feeling or Skip), so the set-up
   *  counts it as its first step. */
  onReady: (shown: boolean) => void;
  onCancel: () => void;
}) {
  // A speaker on a plan is asked only after the plan's own yes (backend
  // N211, N217); a guest never (N271). Otherwise the check is passed by at
  // once and keeps nothing.
  const [allowed] = useState(() => ask && feelingsAllowed());
  useEffect(() => {
    if (allowed) return;
    clearFeeling();
    onReady(false);
    // Once, on open: the flow goes on as a Skip does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // FE-3 — nothing is pre-selected; the user names how they feel fresh every
  // time.
  const [picked, setPicked] = useState<Feeling | null>(null);
  const advanceRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    },
    []
  );

  function pick(feeling: Feeling) {
    if (picked) return; // first tap wins
    setPicked(feeling);
    recordFeeling(feeling);
    advanceRef.current = window.setTimeout(() => onReady(true), ADVANCE_MS);
  }

  if (!allowed) return null;
  return (
    <div className="flex flex-1 flex-col">
      <WizardProgress
        count={setupSteps > 0 ? setupSteps + 1 : 0}
        current={0}
        trailing={<WizardCancel onClick={onCancel} ariaLabel="Close" />}
      />
      <StepHead icon={Mic} question="How do you feel?" helper="Before you step on stage" />

      <div className="grid grid-cols-2 gap-2.5">
        {FEELINGS.map((f) => {
          const active = picked === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => pick(f.key)}
              disabled={picked !== null && !active}
              aria-pressed={active}
              className={`h-[52px] rounded-full border text-[16px] font-medium transition-colors disabled:opacity-40 ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-foreground/40"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        {/* Skip, under Calm: the feelings' own pill, faded, so it reads as the
            way past them and not a fifth feeling (founder 2026-10-29). How a
            speaker feels is theirs to share; skipping keeps nothing (N211). */}
        <button
          type="button"
          onClick={() => onReady(true)}
          disabled={picked !== null}
          data-feelings-skip
          className="h-[52px] rounded-full border border-border/50 bg-background/50 text-[16px] font-medium text-muted-foreground/80 transition-colors hover:text-muted-foreground disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
