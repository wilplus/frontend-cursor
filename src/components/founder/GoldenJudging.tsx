"use client";

/* -------------------------------------------------------------------------- */
/*  The golden set (founder 2026-09-30, L6; ML-7): the founder judges fifty    */
/*  moments per surface on the one instrument the coach uses, then seals the  */
/*  set with a hash. The moment carries a passage and a clip, no label and    */
/*  no machine read; the judgement is the founder's alone (L3) and is what    */
/*  ML-10's evaluation reads instead of the engineering seeds.                */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import CoachJudgeInstrument from "@/components/willab/coachwalk/CoachJudgeInstrument";
import { founderLearning, type GoldenCounts, type GoldenMoment } from "@/services/api/founderLearning";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { Meter } from "./FounderFrame";

export default function GoldenJudging({ surface, counts, onChange }: { surface: string; counts: GoldenCounts; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [moment, setMoment] = useState<GoldenMoment | null | "exhausted">(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);

  const next = useCallback(async () => {
    const result = await founderLearning.nextMoment(surface);
    if (!result.ok) {
      setError(`Could not read the next moment (${result.code}).`);
      return;
    }
    setMoment(result.value ?? "exhausted");
  }, [surface]);

  useEffect(() => {
    if (open && moment === null) void next();
  }, [open, moment, next]);

  async function pick(value: ConfidenceRatingValue) {
    if (!moment || moment === "exhausted") return;
    setSaving(true);
    setError(null);
    const result = await founderLearning.judge(surface, { snippet_id: moment.snippetId, take_session_id: moment.takeSessionId, value });
    setSaving(false);
    if (!result.ok) {
      setError(result.code === "SEALED" ? "This set is sealed." : `Could not save (${result.code}).`);
      return;
    }
    onChange();
    setMoment(null);
  }

  async function seal() {
    setSealing(true);
    const result = await founderLearning.seal(surface);
    setSealing(false);
    setError(result.ok ? null : result.code === "GOLDEN_SET_INCOMPLETE" ? `Fifty are needed; ${counts.count} so far.` : `Could not seal (${result.code}).`);
    onChange();
  }

  const done = counts.sealed !== null;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{surface}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {counts.count} / {counts.setSize}
          {done ? ` · sealed ${counts.sealed?.sealed_at?.slice(0, 10) ?? ""}` : ""}
        </span>
      </div>
      <div className="mt-2">
        <Meter value={counts.count} of={counts.setSize} label={`${surface}: ${counts.count} of ${counts.setSize} judged`} />
      </div>
      {done ? (
        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">sha256 {counts.sealed?.sha256}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {open ? "Pause judging" : counts.count === 0 ? "Start judging" : "Continue judging"}
          </button>
          <button
            type="button"
            onClick={() => void seal()}
            disabled={sealing || counts.count < counts.setSize}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {sealing ? "Sealing…" : "Seal the set"}
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-muted-foreground">{error}</p> : null}
      {open && !done ? (
        <div className="mt-4 border-t border-border pt-4">
          {moment === "exhausted" ? (
            <p className="text-sm text-muted-foreground">No unjudged moment is left in the coach-labelled pool.</p>
          ) : moment === null ? (
            <p className="text-sm text-muted-foreground">Reading the next moment…</p>
          ) : (
            <div className="grid gap-3">
              <CoachJudgeInstrument
                clip={{ src: moment.audioUrl, startOffsetMs: moment.startOffsetMs, durationMs: moment.durationMs }}
                value={null}
                saving={saving}
                error={null}
                onPick={(value) => void pick(value)}
                keys
              />
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Show the words</summary>
                <p className="mt-2 text-sm">{moment.passage}</p>
              </details>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
