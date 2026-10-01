"use client";

/* -------------------------------------------------------------------------- */
/*  Phase 1b · the coach's exercise preference (founder 2026-10-01, F8; the    */
/*  B1 wording exactly). On the Read screen, after the blind rating: the      */
/*  exercise the machine served and what it treats, with Keep it, Swap it    */
/*  and Make a new one. Keep is explicit; silence records nothing. The swap  */
/*  list is the pool the frozen trace ranked, shuffled by the backend, no    */
/*  rank or score shown, the served one marked. Draws nothing while the      */
/*  backend is dark (the read answers null).                                 */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  fetchExercisePreference,
  recordExercisePreference,
  type ExercisePreferenceView,
  type PreferenceAction,
} from "@/services/api/coachPanel";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const SMALL =
  "rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";
const DARK =
  "rounded-full bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";

export default function CoachPreferenceBox({
  sessionId,
  snippetId,
  onMakeNew,
}: {
  sessionId: string;
  snippetId: string;
  /** Opens the existing library authoring after "new" is recorded. */
  onMakeNew: () => void;
}) {
  const [view, setView] = useState<ExercisePreferenceView | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<PreferenceAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setRecorded(null);
    setSwapping(false);
    setChoice(null);
    void fetchExercisePreference(sessionId, snippetId).then((next) => {
      if (!cancelled) setView(next);
    });
    return () => { cancelled = true; };
  }, [sessionId, snippetId]);

  if (!view) return null;

  async function record(action: PreferenceAction, chosen?: string | null): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await recordExercisePreference(sessionId, snippetId, { action, chosenExerciseId: chosen ?? null });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRecorded(action);
    setSwapping(false);
    if (action === "new") onMakeNew();
  }

  const chosenTitle = recorded === "swapped" && choice
    ? view.pool.find((p) => p.exerciseId === choice)?.title ?? null
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5" data-testid="coach-preference-box">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {COPY.prefServed}
      </span>
      <span className="text-[15px] font-semibold text-foreground">{view.served.title ?? view.served.exerciseId}</span>
      {view.served.treats.length > 0 ? (
        <span className="text-[13px] text-muted-foreground">{COPY.prefTreats(view.served.treats)}</span>
      ) : null}
      {recorded ? (
        <span className="text-[13px] text-foreground" data-testid="coach-preference-recorded">
          {recorded === "kept" ? COPY.prefKeep : recorded === "new" ? COPY.prefNew : `${COPY.prefChosen}: ${chosenTitle ?? ""}`}
        </span>
      ) : swapping ? (
        <div className="flex flex-col gap-2" data-testid="coach-preference-pool">
          <span className="text-[12px] text-muted-foreground">{COPY.prefSwapHint}</span>
          {view.pool.map((p) => (
            <div key={p.exerciseId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] text-foreground">{p.title ?? p.exerciseId}</span>
                {p.served ? <span className="text-[11px] text-muted-foreground">{COPY.prefServedTag}</span> : null}
              </span>
              {p.served ? null : (
                <button type="button" className={choice === p.exerciseId ? DARK : SMALL}
                  disabled={busy} onClick={() => setChoice(p.exerciseId)}>
                  {choice === p.exerciseId ? COPY.prefChosen : COPY.prefChoose}
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={DARK} disabled={busy || !choice}
              onClick={() => void record("swapped", choice)}>
              {COPY.prefUseThisOne}
            </button>
            <button type="button" className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
              disabled={busy} onClick={() => void record("new")}>
              {COPY.prefNotHere}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={DARK} disabled={busy} onClick={() => void record("kept")}>{COPY.prefKeep}</button>
          <button type="button" className={SMALL} disabled={busy || view.pool.filter((p) => !p.served).length === 0}
            onClick={() => setSwapping(true)}>
            {COPY.prefSwap}
          </button>
          <button type="button" className={SMALL} disabled={busy} onClick={() => void record("new")}>{COPY.prefNew}</button>
        </div>
      )}
      {error ? <p role="alert" className="text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}
