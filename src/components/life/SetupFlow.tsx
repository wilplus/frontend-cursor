"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { SETUP, STATUS } from "@/lib/life/copy";
import { LIFE_BETS } from "@/lib/life/types";
import {
  coerceSetupAnswers,
  LIFE_SETUP_STEPS,
  pruneAnswers,
  stepIndex,
  type LifeSetupAnswers,
  type LifeSetupGoal,
} from "@/lib/life/setupSteps";
import { completeSetup, fetchSetup, putSetup } from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";
import { Eyebrow, ErrorLine, LoadingLine, PanelCard } from "./primitives";
import { StepHead, WizardChip, WizardProgress } from "@/components/ui/wizard";
import { duePresets } from "@/lib/life/duePresets";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  FE-3 — setup. Once, but editable forever.                                  */
/*                                                                            */
/*  SAVE-AND-RESUME IS LOAD-BEARING, not a nicety, and it got MORE load-       */
/*  bearing on 2026-07-26. A `#` typed before this form is finished now falls  */
/*  through as ordinary chat and stores nothing at all (BE, superseding §6.2:  */
/*  a half-working tag teaches that it costs something louder than a redirect  */
/*  does, because it answers, looks like it understood, and produces nothing). */
/*  So an interruption partway through eight horizons is the ONLY thing        */
/*  standing between a user and the feature, and resume is the only door back. */
/*  Every step writes (PUT /v2/life/setup), and the step the user stopped on   */
/*  comes back from `/state.setup.resume_step`.                                */
/*                                                                            */
/*  Consequence worth holding while reading this file: this form is the only   */
/*  entrance to the feature, so its completion rate IS the feature's adoption  */
/*  rate. Nothing here is allowed to be clever at the cost of being finishable.*/
/*                                                                            */
/*  On completion the backend generates the document set. There is no replay   */
/*  step, because nothing was held back to replay.                             */
/* -------------------------------------------------------------------------- */

export default function SetupFlow({
  resumeStep,
  onComplete,
}: {
  resumeStep: string | null;
  onComplete: () => void;
}) {
  const [answers, setAnswers] = useState<LifeSetupAnswers | null>(null);
  const [index, setIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSetup()
      .then((draft) => {
        if (cancelled) return;
        setAnswers(coerceSetupAnswers(draft.answers));
        if (!resumedRef.current) {
          resumedRef.current = true;
          setIndex(stepIndex(draft.step ?? resumeStep));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resumeStep]);

  const save = useCallback(
    async (stepKey: string, next: LifeSetupAnswers) => {
      setSaveState("saving");
      try {
        await putSetup(stepKey, pruneAnswers(next) as unknown as Record<string, unknown>);
        setSaveState("saved");
      } catch {
        // A failed save is not fatal mid-form: the answers are still in state
        // and the next step's write retries the whole draft.
        setSaveState("idle");
      }
    },
    []
  );

  if (loadFailed) return <ErrorLine />;
  if (!answers) return <LoadingLine />;

  if (done) return <SetupComplete onDone={onComplete} />;

  const step = LIFE_SETUP_STEPS[index];
  const isLast = index === LIFE_SETUP_STEPS.length - 1;

  async function goNext() {
    await save(step.key, answers!);
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    try {
      await completeSetup();
      invalidateLifeState();
      setDone(true);
    } catch {
      setFinishing(false);
      setSaveState("idle");
    }
  }

  const status = finishing
    ? SETUP.workingLabel
    : saveState === "saving"
      ? STATUS.saving
      : saveState === "saved"
        ? SETUP.savedNote
        : "";

  // Founder 2026-07-27 — this flow now wears the recording onboarding's chrome:
  // the dot row with Back, the eyebrow + question + helper head, and one
  // full-width rounded CTA. Same components, so the two onboardings cannot
  // drift apart again.
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col">
      <WizardProgress
        count={LIFE_SETUP_STEPS.length}
        current={index}
        onBack={() => setIndex((i) => Math.max(0, i - 1))}
      />

      <div className="flex-1">
        {/* STEP n OF 9 stays — it is the one piece of chrome that tells the
            user how much is left, and this form's completion rate is the
            feature's adoption rate. It is the head's eyebrow now, which is
            where the recording flow puts the same information.
            FE-10 — the grey "Eight horizons…" paragraph is gone: it rendered on
            screen 1 only, which is exactly what made screen 1 the odd one out.
            With it gone all nine steps render through this one path. */}
        <StepHead
          eyebrow={`Step ${index + 1} of ${LIFE_SETUP_STEPS.length}`}
          question={step.title}
          helper={step.hint || undefined}
        />

        {step.kind === "bets" ? (
          <BetsStep answers={answers} onChange={(next) => setAnswers(next)} />
        ) : (
          <GoalsStep
            stepKey={step.key}
            duePlaceholder={step.duePlaceholder ?? ""}
            answers={answers}
            onChange={(next) => setAnswers(next)}
          />
        )}
      </div>

      <div className="mt-8">
        {status ? (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {status}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={() => void goNext()}
          disabled={finishing}
          className="w-full rounded-full"
        >
          {isLast ? SETUP.completeLabel : SETUP.nextLabel}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- steps ---------------------------------- */

function BetsStep({
  answers,
  onChange,
}: {
  answers: LifeSetupAnswers;
  onChange: (next: LifeSetupAnswers) => void;
}) {
  function move(from: number, to: number) {
    if (to < 0 || to >= answers.bets.length) return;
    const bets = [...answers.bets];
    const [moved] = bets.splice(from, 1);
    bets.splice(to, 0, moved);
    onChange({ ...answers, bets: bets.map((b, i) => ({ ...b, rank: i + 1 })) });
  }

  return (
    <ol className="space-y-3">
      {answers.bets.map((bet, i) => {
        const meta = LIFE_BETS.find((b) => b.key === bet.key);
        return (
          <li key={bet.key}>
            <PanelCard>
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none" aria-hidden>
                  {meta?.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {i + 1}. {meta?.label ?? bet.key}
                  </p>
                  <textarea
                    value={bet.meaning}
                    onChange={(e) => {
                      const bets = [...answers.bets];
                      bets[i] = { ...bet, meaning: e.target.value };
                      onChange({ ...answers, bets });
                    }}
                    rows={2}
                    placeholder="What this one covers, in your words"
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${meta?.label ?? bet.key} up`}
                    onClick={() => move(i, i - 1)}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${meta?.label ?? bet.key} down`}
                    onClick={() => move(i, i + 1)}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </PanelCard>
          </li>
        );
      })}
    </ol>
  );
}

/** Row ids only have to be unique within one draft, and stable across renders
 *  so React does not remount an input the user is typing into. A counter is
 *  enough; these are never persisted as identity. */
let goalIdSeq = 0;
function nextGoalId(stepKey: string): string {
  goalIdSeq += 1;
  return `${stepKey}-${goalIdSeq}`;
}

function GoalsStep({
  stepKey,
  duePlaceholder,
  answers,
  onChange,
}: {
  stepKey: string;
  duePlaceholder: string;
  answers: LifeSetupAnswers;
  onChange: (next: LifeSetupAnswers) => void;
}) {
  const goals = answers.horizons[stepKey] ?? [];
  // Computed once per render from today's date — "[Aug]" has to mean the month
  // the user is actually in, not one baked in at build time.
  const presets = duePresets(stepKey, new Date());

  function write(next: LifeSetupGoal[]) {
    onChange({
      ...answers,
      horizons: { ...answers.horizons, [stepKey]: next },
    });
  }

  function update(i: number, patch: Partial<LifeSetupGoal>) {
    const next = [...goals];
    next[i] = { ...next[i], ...patch };
    write(next);
  }

  return (
    <div className="space-y-3">
      {goals.map((goal, i) => (
        <PanelCard key={goal.id}>
          <div className="flex items-start justify-between gap-3">
            <input
              value={goal.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="The goal, in one line"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
            />
            <button
              type="button"
              aria-label="Remove this goal"
              onClick={() => write(goals.filter((_, j) => j !== i))}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Due, as you write it">
              <input
                value={goal.dueLabel}
                onChange={(e) => update(i, { dueLabel: e.target.value })}
                placeholder={duePlaceholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
              {/* Chips, not a date picker (spec §3.2): the label is the source
                  of truth, and a picker would normalise "[Jul '27]" into a
                  concrete day nobody chose. Tapping writes the label VERBATIM
                  and the field stays typeable, so the common answers cost one
                  tap and every other answer still fits. Same affordance as the
                  recording flow's length presets. */}
              {presets.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <WizardChip
                      key={preset}
                      size="sm"
                      active={goal.dueLabel === preset}
                      onClick={() =>
                        update(i, {
                          // Tapping the active chip clears it — otherwise a
                          // mis-tap can only be undone by selecting the text.
                          dueLabel: goal.dueLabel === preset ? "" : preset,
                        })
                      }
                    >
                      {preset}
                    </WizardChip>
                  ))}
                </div>
              ) : null}
            </Field>
            <Field label="How much">
              <input
                value={goal.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                placeholder="3 talks, 10kg, one draft"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="How you will know it happened">
              <input
                value={goal.measure}
                onChange={(e) => update(i, { measure: e.target.value })}
                placeholder="What you would point at"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
            </Field>
            <Field label="Which bet it serves">
              <select
                value={goal.betKey ?? ""}
                onChange={(e) =>
                  update(i, {
                    betKey: (e.target.value || null) as LifeSetupGoal["betKey"],
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              >
                <option value="">Pick one</option>
                {answers.bets.map((b) => {
                  const meta = LIFE_BETS.find((x) => x.key === b.key);
                  return (
                    <option key={b.key} value={b.key}>
                      {meta?.glyph} {meta?.label}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
        </PanelCard>
      ))}

      <button
        type="button"
        onClick={() =>
          write([
            ...goals,
            {
              id: nextGoalId(stepKey),
              title: "",
              dueLabel: "",
              quantity: "",
              measure: "",
              betKey: null,
            },
          ])
        }
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a goal
      </button>

      {goals.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          You can leave a horizon empty and come back to it.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------- completion ------------------------------- */

/** No replay section (BE, 2026-07-26, superseding §6.2): a `#` typed before
 *  onboarding finished stored nothing, so there is nothing waiting to show. */
function SetupComplete({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {SETUP.doneTitle}
      </h1>
      <button
        type="button"
        onClick={onDone}
        className="mt-8 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
      >
        {SETUP.doneLabel}
      </button>
    </div>
  );
}
