"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TrainingArc, TrainingTake } from "@/services/api/trainings";
import { readReviewRuns, type ReviewRuns } from "@/services/api/takeReview";
import { REVIEW_STEPS, type TakeReviewTarget } from "./TakeReview";

const readyForReview = (take: TrainingTake) => take.reviewAvailable ?? take.feedbackAvailable;

export function CoachProjectUpdate({ projects, onOpen }: {
  projects: TrainingArc[];
  onOpen: (project: TrainingArc, target: TakeReviewTarget) => void;
}) {
  const project = projects
    .flatMap((arc) => arc.practiceCoverage ? arc.takes.filter(readyForReview)
      .map((take) => ({ arc, date: take.createdAt ?? arc.createdAt ?? "" })) : [])
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.arc;
  const id = project?.arcId;
  const [result, setResult] = useState<{ id: string; runs: ReviewRuns } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void readReviewRuns(id).then((runs) => { if (active && runs) setResult({ id, runs }); }).catch(() => undefined);
    return () => { active = false; };
  }, [id]);
  if (!project) return null;
  return <div className="max-w-[88%] rounded-2xl bg-muted px-3 py-2.5">
    <TakeReviewMessage key={project.arcId} project={project} runs={result?.id === id ? result?.runs ?? {} : {}}
      onOpen={(target) => onOpen(project, target)} />
  </div>;
}

export default function TakeReviewMessage({ project, runs, onOpen }: {
  project: TrainingArc;
  runs: ReviewRuns;
  onOpen: (target: TakeReviewTarget) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const takes = [...project.takes].sort((a, b) => b.takeIndex - a.takeIndex);
  const ready = takes.filter(readyForReview);
  const latest = ready[0];
  const take = ready.find((item) => item.sessionId === selected) ?? latest;
  const coverage = project.practiceCoverage;
  if (!take) return null;

  const totalRuns = takes.reduce((sum, item) => sum + (runs[item.sessionId]?.length ?? 0), 0);
  const selectedRuns = [...(runs[take.sessionId] ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const label = (item: TrainingTake) => `Take ${item.takeIndex}`;
  return (
    <section data-take-review-message className="space-y-2 text-[15px]">
      <p className="font-semibold">{project.topic}</p>
      <p>
        {label(take)} is ready.
        {coverage?.total ? <> You’ve practised <strong>{coverage.practised} of {coverage.total} {coverage.unit}</strong>.</> : null}
      </p>
      <div className="grid max-w-[320px] grid-cols-3 gap-1.5" aria-label={`Review ${label(take)}`}>
        {REVIEW_STEPS.map(({ step, label: button }) => (
          <button key={step} type="button" className="min-h-11 rounded-lg border border-border px-1 text-sm hover:bg-muted"
            onClick={() => onOpen({ take, focus: { step } })}>{button}</button>
        ))}
      </div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}
        className="flex min-h-10 items-center gap-1 text-[13px] text-muted-foreground">
        {takes.length} {takes.length === 1 ? "Take" : "Takes"}
        {totalRuns > 0 ? ` · ${totalRuns} practice ${totalRuns === 1 ? "run" : "runs"}` : null}
        <ChevronDown aria-hidden className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
        <ul className="space-y-1 text-sm">
          {takes.map((item) => (
            <li key={item.sessionId}>
              <button type="button" aria-pressed={item.sessionId === take.sessionId} disabled={!readyForReview(item)}
                className="min-h-10 rounded-md px-2 text-left hover:bg-muted aria-pressed:bg-muted"
                onClick={() => setSelected(item.sessionId)}>
                {label(item)}
                {runs[item.sessionId]?.length ? ` · ${runs[item.sessionId].length} practice ${runs[item.sessionId].length === 1 ? "run" : "runs"}` : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {expanded && selectedRuns.length ? <details className="text-sm">
        <summary className="cursor-pointer py-2 text-muted-foreground">Practice history for {label(take)}</summary>
        <ul className="space-y-1 pb-2 pl-3">
          {selectedRuns.map((run) => <li key={run.id}>
            {run.kind === "tempo" ? "Sniper" : "Voice practice"} · <time dateTime={run.at}>{new Date(run.at).toLocaleString()}</time>
          </li>)}
        </ul>
      </details> : null}
    </section>
  );
}
