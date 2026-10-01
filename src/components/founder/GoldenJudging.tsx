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
import { founderLearning, PAIR_JUDGEMENTS, type GoldenCounts, type GoldenMoment, type PairJudgement } from "@/services/api/founderLearning";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { Meter } from "./FounderFrame";

/* The founder's screen, not a speaker's: these words are the founder's own
 * instrument for the pair surfaces (ML-10) and reach nobody else. */
const PAIR_COPY = {
  question: "Is this the right answer for this passage?",
  passage: "The passage, as spoken",
  final: "The coach's answer",
  answers: { yes: "Yes", no: "No", not_sure: "Not sure" } as Record<PairJudgement, string>,
  exhausted: "No unjudged pair with a passage is left for this surface.",
  changed: "Erasure removed a moment from the sealed set. Judge a replacement and seal again.",
} as const;

function PairInstrument({ moment, saving, onPick }: { moment: GoldenMoment; saving: boolean; onPick: (value: PairJudgement) => void }) {
  return (
    <div className="grid gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{PAIR_COPY.passage}</div>
        <p className="mt-1 text-sm leading-relaxed">{moment.passage}</p>
      </div>
      <div className="rounded-xl bg-muted p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{PAIR_COPY.final}</div>
        <p className="mt-1 text-sm leading-relaxed">{moment.final}</p>
      </div>
      <div role="group" aria-label={PAIR_COPY.question}>
        <p className="text-sm font-medium">{PAIR_COPY.question}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAIR_JUDGEMENTS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => onPick(value)}
              className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {PAIR_COPY.answers[value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  async function pick(value: ConfidenceRatingValue | PairJudgement) {
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

  const done = counts.sealed !== null && counts.sealedIntact !== false;
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
      {counts.sealedIntact === false ? <p className="mt-2 text-sm text-muted-foreground">{PAIR_COPY.changed}</p> : null}
      {error ? <p className="mt-2 text-sm text-muted-foreground">{error}</p> : null}
      {open && !done ? (
        <div className="mt-4 border-t border-border pt-4">
          {moment === "exhausted" ? (
            <p className="text-sm text-muted-foreground">{counts.kind === "pair" ? PAIR_COPY.exhausted : "No unjudged moment is left in the coach-labelled pool."}</p>
          ) : moment === null ? (
            <p className="text-sm text-muted-foreground">Reading the next moment…</p>
          ) : counts.kind === "pair" && moment.final ? (
            <PairInstrument moment={moment} saving={saving} onPick={(value) => void pick(value)} />
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
