"use client";

import { useState } from "react";
import { LadderCard, useLifeGoals } from "@/components/willab/LoungeLifeGoals";
import { LIFE_GOALS_COPY as COPY, dayLabel, type Rung } from "@/lib/willab/lifeGoals";
import type { GoalVersion, LifeGoal } from "@/services/api/lifeGoals";

/* -------------------------------------------------------------------------- */
/*  Life goals on the Goals screen (backend N172 M15, N196; rules              */
/*  docs/flows/principles.md §1 M15; prototype                                 */
/*  https://claude.ai/artifact/BeKgTGi1KXvF5ruvMEiA33).                        */
/*                                                                            */
/*  The top layer, above the three bets: one ladder per set goal, the same     */
/*  ladder as the Lounge's. A tapped step opens the lens over the panel to     */
/*  change it; the panel only shows. Before the first goal, nothing at all     */
/*  (the panel shows only what exists). Founder only: the backend says.        */
/* -------------------------------------------------------------------------- */

const STEP_NAME: Record<GoalVersion["step"], string> = {
  goal: "Life goal",
  want: "A want, held knowingly",
  give: "Giving up",
  y10: "In ten years",
  y3: "In three years",
  y1: "In a year",
  quarter: "This quarter",
  talk: "Talk goal",
  clash: "When they clash",
  quarter_review: "This quarter",
};

function VersionLine({ version }: { version: GoalVersion }) {
  const outcome = COPY.outcomes.find((o) => o.key === version.outcome);
  return (
    <li>
      <span className="block text-xs text-muted-foreground">{dayLabel(version.on)}</span>
      <b className="font-semibold">{STEP_NAME[version.step]}</b>:{" "}
      {version.step === "quarter_review" ? (
        <>
          {version.before} {outcome ? `${outcome.emoji} ${outcome.label}` : null}
        </>
      ) : (
        <>
          {version.after}{" "}
          {version.before ? (
            <span className="text-muted-foreground">
              {COPY.earlier} {version.before}
            </span>
          ) : null}
        </>
      )}
    </li>
  );
}

function LadderPanelCard({ goal, onPick }: { goal: LifeGoal; onPick: (rung: Rung) => void }) {
  const [open, setOpen] = useState(false);
  const history = goal.history ?? [];
  return (
    <div className="mb-3 rounded-2xl border border-border px-4 py-3 text-[15px] leading-[1.4]">
      <LadderCard goal={goal} small onPick={onPick} />
      <div className="mt-1.5 flex items-center justify-between border-t border-foreground/10 pt-2 text-sm text-muted-foreground">
        <span>{goal.set_on ? COPY.setOn(dayLabel(goal.set_on)) : null}</span>
        <button type="button" onClick={() => setOpen((now) => !now)} className="font-semibold text-foreground">
          {open ? COPY.hideHistory : COPY.history}
        </button>
      </div>
      {open ? (
        <ul className="mt-2 flex flex-col gap-2 text-sm leading-[1.4]">
          {history.map((version, i) => (
            <VersionLine key={`${version.on}-${version.step}-${i}`} version={version} />
          ))}
          {goal.set_on ? (
            <li>
              <span className="block text-xs text-muted-foreground">{dayLabel(goal.set_on)}</span>
              {COPY.setOn(dayLabel(goal.set_on))}.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export default function LifeGoalsLadders() {
  const lifeGoals = useLifeGoals({ signedIn: true, reload: async () => undefined, lounge: false });
  if (!lifeGoals.enabled || !lifeGoals.goals.length) return null;
  return (
    <section className="mb-8" aria-label={COPY.bar}>
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">{COPY.bar}</h2>
      {lifeGoals.goals.map((goal) => (
        <LadderPanelCard
          key={goal.id}
          goal={goal}
          onPick={(rung) => lifeGoals.openLens({ mode: "see", goalId: goal.id, step: rung.step, with: rung.with })}
        />
      ))}
      <button
        type="button"
        onClick={() => lifeGoals.openLens({ mode: "add" })}
        className="flex h-11 w-full items-center justify-center rounded-2xl border-[1.5px] border-dashed border-border text-[15px] font-semibold text-foreground"
      >
        {COPY.addGoal}
      </button>
      {lifeGoals.lens}
    </section>
  );
}
