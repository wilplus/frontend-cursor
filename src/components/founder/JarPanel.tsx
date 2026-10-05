"use client";

/* -------------------------------------------------------------------------- */
/*  The jar on the founder's pace panel (founder 2026-09-30, B8, C9; E9).      */
/*                                                                            */
/*  B8 retired /cms/jar and said the jar becomes rows on the pace panel; it   */
/*  never arrived, so the per-exercise counts and the evaluation were drawn   */
/*  nowhere. This draws them again, from the ledger read the panel already    */
/*  makes:                                                                    */
/*    the jar         counted of 300, renders, the cohort, the attempt rate,  */
/*                    each exercise against its 30, how the counted practices */
/*                    were chosen, why renders were left out. Counts only.    */
/*    the evaluation  sealed until the bar, then two piles that never mix    */
/*                    (machine picks only; with coach picks): the scoreboard  */
/*                    and the fair test. Drawn only once the backend serves  */
/*                    it; nothing here promotes.                              */
/*  Founder only (the page's gate); every number is about the machine and its */
/*  exercises, never a person.                                               */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { Meter } from "./FounderFrame";
import {
  JAR_PILES, jarCount, type ExerciseJar, type JarEvaluation, type JarExercise, type JarFairTest,
  type JarPile, type JarPileEvaluation, type JarSource,
} from "@/lib/founder/jar";

/** Founder-only operator wording. Every line but the one marked NEW was on
 *  the retired /cms/jar page (decisions 5 and 7, 2026-09-29) and moves here
 *  word for word. */
export const JAR_COPY = {
  title: "The jar",
  intro: "Practices counted toward the exercise learning bar. Counts only; no result is shown here.",
  counted: (n: string, of: number) => `${n} of ${of} counted`,
  ready: "The bar is met. The evaluation below is unsealed.",
  seen: "Renders",
  cohort: "In the cohort",
  attemptRate: "Attempt rate",
  exercise: "Exercise",
  perExercise: (needed: number) => `Counted of ${needed}`,
  modes: "How the counted practices were chosen",
  mode: {
    top: "Top pick",
    exploration: "Exploration draw",
    deterministic_singleton: "Only one fitted",
    coach_chosen: "Chosen by a coach",
  } as Record<string, string>,
  leftOut: "Renders left out, by reason",
  exclusion: {
    untraced: "No match trace (drawn before traces existed)",
    /** NEW (the backend's F2 rule, 2026-10-01; no wording existed for it). */
    fallback: "A general exercise or the warm-up, served because nothing targeted what fired",
    no_targeted_problem: "No targeted problem fired",
    rules_changed: "Traced under other signal rules",
    repeat: "Not the speaker's first exposure to that problem",
    below_minimum_probability: "Below the draw's minimum probability",
    no_attempt: "No practice attempt",
    no_valid_attempt: "No valid attempt",
  } as Record<string, string>,
  sources: {
    exposures: "renders",
    assignments: "assignments",
    match_traces: "match traces",
    practices: "practices",
    attempts: "attempts",
  } satisfies Record<JarSource, string>,
  unavailable: (names: string) =>
    `Couldn’t read ${names}. Those numbers show as unknown, not zero, and the jar is not ready.`,
  unknown: "Unknown",
  empty: "No exercise has been rendered yet.",
  versions: "Rules in force",
} as const;

/** The evaluation's wording, from the same page. "Helped" and "success"
 *  appear here only: this block renders what the backend computes once the
 *  bar is met. */
export const EVALUATION_COPY = {
  heading: "The evaluation",
  sealed: (why: string) => `Sealed until the bar is met: ${why}.`,
  sealedNoReason: "Sealed until the bar is met.",
  unsealed: "The bar is met, so the scorekeeper and the fair test ran on their own. Nothing is promoted by this page; a learned ranking still needs your yes.",
  pile: { machine_only: "Machine picks only", with_coach_picks: "With coach picks" } satisfies Record<JarPile, string>,
  pileHelp: {
    machine_only: "Labels from exercises the machine drew. The fair test always grades these.",
    with_coach_picks: "The same, plus labels from exercises a coach chose, kept in their own pile. They change what the candidate learns from, never what is graded.",
  } satisfies Record<JarPile, string>,
  scoreboard: "Scoreboard",
  helped: "Helped",
  helpedRate: "Helped rate",
  counted: "Counted",
  exercise: "Exercise",
  overall: (helped: number, counted: number) => `${helped} of ${counted} helped`,
  byMode: "By how the exercise was chosen",
  fairTest: "Fair test",
  candidate: "Candidate",
  candidateHelp: (version: string, labels: number, speakers: number) =>
    `${version}: prefers the exercise with the highest helped rate on study-group speakers, learned from ${labels} labels across ${speakers} speakers; graded on exam-group speakers only.`,
  today: "Today's ranking",
  successRate: "Success rate",
  attemptRate: "Attempt rate",
  gain: "Success gain",
  interval: "95% interval of the gain",
  attemptChange: "Attempt rate change",
  agrees: (n: number, of: number) => `Candidate agrees with what was served on ${n} of ${of} exam exposures.`,
  meets: "Meets the bar. Nothing is promoted; that stays your call.",
  fails: "Does not meet the bar:",
  preferences: "What the candidate learned",
  trusted: "used",
  untrusted: "below the bar, not used",
  none: "–",
} as const;

const HEAD = "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground";

function shown(value: number | null): string {
  return value === null ? JAR_COPY.unknown : String(value);
}

function pct(value: number | null): string {
  return value === null ? EVALUATION_COPY.none : `${Math.round(value * 100)}%`;
}

function pts(value: number | null): string {
  if (value === null) return EVALUATION_COPY.none;
  const n = Math.round(value * 100);
  return `${n > 0 ? "+" : ""}${n} pts`;
}

function JarSummary({ jar }: { jar: ExerciseJar }) {
  const counted = jarCount(jar.counted, "attempts", jar.unavailable);
  return (
    <div data-testid="pace-jar-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium tabular-nums">{JAR_COPY.counted(shown(counted), jar.bar.minCounted)}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {JAR_COPY.seen} {shown(jarCount(jar.exposures, "exposures", jar.unavailable))} · {JAR_COPY.cohort}{" "}
          {shown(jarCount(jar.cohort, "match_traces", jar.unavailable))} · {JAR_COPY.attemptRate} {pct(jar.attemptRate)}
        </span>
      </div>
      <div className="mt-2">
        <Meter value={jar.counted} of={jar.bar.minCounted} label={JAR_COPY.counted(String(jar.counted), jar.bar.minCounted)} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{jar.ready ? JAR_COPY.ready : jar.whyNot}</p>
    </div>
  );
}

function ExerciseRow({ row, jar, titles }: { row: JarExercise; jar: ExerciseJar; titles: ReadonlyMap<string, string> }) {
  const title = titles.get(row.exerciseId);
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2">
        <div className="font-medium">{title ?? row.exerciseId}</div>
        {title ? <code className="text-[11px] text-muted-foreground">{row.exerciseId}</code> : null}
      </td>
      <td className="px-3 py-2 tabular-nums">{shown(jarCount(row.exposures, "exposures", jar.unavailable))}</td>
      <td className="px-3 py-2 tabular-nums">{shown(jarCount(row.cohort, "match_traces", jar.unavailable))}</td>
      <td className="px-3 py-2">
        <div className="tabular-nums">{shown(jarCount(row.counted, "attempts", jar.unavailable))} / {row.needed}</div>
        <div className="mt-1 w-28">
          <Meter value={row.counted} of={row.needed} label={`${title ?? row.exerciseId}: ${row.counted} of ${row.needed}`} />
        </div>
      </td>
    </tr>
  );
}

function JarExercises({ jar, titles }: { jar: ExerciseJar; titles: ReadonlyMap<string, string> }) {
  if (jar.exercises.length === 0) return <p className="text-sm text-muted-foreground">{JAR_COPY.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border" data-testid="pace-jar-exercises">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{JAR_COPY.exercise}</th>
            <th className="px-3 py-2 font-medium">{JAR_COPY.seen}</th>
            <th className="px-3 py-2 font-medium">{JAR_COPY.cohort}</th>
            <th className="px-3 py-2 font-medium">{JAR_COPY.perExercise(jar.bar.minPerExercise)}</th>
          </tr>
        </thead>
        <tbody>
          {jar.exercises.map((row) => (
            <ExerciseRow key={row.exerciseId} row={row} jar={jar} titles={titles} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountList({ heading, rows }: { heading: string; rows: [string, number][] }) {
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className={HEAD}>{heading}</h3>
      <dl className="mt-2 flex flex-col gap-1 text-sm">
        {rows.length === 0 ? <dd className="text-muted-foreground">0</dd> : null}
        {rows.map(([label, n]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd className="tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function JarBreakdown({ jar }: { jar: ExerciseJar }) {
  const modes = Object.entries(jar.countedBySelectionMode).map(
    ([mode, n]): [string, number] => [JAR_COPY.mode[mode] ?? mode.replace(/_/g, " "), n],
  );
  const leftOut = jar.excluded.map(
    ({ reason, renders }): [string, number] => [JAR_COPY.exclusion[reason] ?? reason.replace(/_/g, " "), renders],
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CountList heading={JAR_COPY.modes} rows={modes} />
      <CountList heading={JAR_COPY.leftOut} rows={leftOut} />
    </div>
  );
}

function Scoreboard({ pile, titles }: { pile: JarPileEvaluation; titles: ReadonlyMap<string, string> }) {
  const board = pile.scoreboard;
  return (
    <section className="rounded-xl border border-border p-3">
      <h4 className={HEAD}>{EVALUATION_COPY.scoreboard}</h4>
      <p className="mt-1 text-sm">
        {EVALUATION_COPY.overall(board.helped, board.counted)} · {EVALUATION_COPY.helpedRate} {pct(board.helpedRate)}
      </p>
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="py-1 pr-3">{EVALUATION_COPY.exercise}</th>
            <th className="py-1 pr-3">{EVALUATION_COPY.counted}</th>
            <th className="py-1 pr-3">{EVALUATION_COPY.helped}</th>
            <th className="py-1">{EVALUATION_COPY.helpedRate}</th>
          </tr>
        </thead>
        <tbody>
          {board.exercises.map((row) => (
            <tr key={row.exerciseId} className="border-t border-border">
              <td className="py-1 pr-3">{titles.get(row.exerciseId) ?? row.exerciseId}</td>
              <td className="py-1 pr-3 tabular-nums">{row.counted}</td>
              <td className="py-1 pr-3 tabular-nums">{row.helped}</td>
              <td className="py-1 tabular-nums">{pct(row.helpedRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        <dt className="font-medium uppercase tracking-[0.08em]">{EVALUATION_COPY.byMode}</dt>
        {Object.entries(board.bySelectionMode).map(([mode, v]) => (
          <dd key={mode} className="flex justify-between gap-3">
            <span>{JAR_COPY.mode[mode] ?? mode}</span>
            <span className="tabular-nums">{v.helped} / {v.counted} · {pct(v.helpedRate)}</span>
          </dd>
        ))}
      </dl>
    </section>
  );
}

function FairTestVerdict({ test }: { test: JarFairTest }) {
  return test.meetsBar ? (
    <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">{EVALUATION_COPY.meets}</p>
  ) : (
    <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      {EVALUATION_COPY.fails} {test.whyNot.join("; ")}
    </p>
  );
}

function FairTest({ pile }: { pile: JarPileEvaluation }) {
  const test = pile.fairTest;
  const interval = test.successGainInterval95;
  return (
    <section className="rounded-xl border border-border p-3">
      <h4 className={HEAD}>{EVALUATION_COPY.fairTest}</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {EVALUATION_COPY.candidateHelp(pile.candidate.version, pile.candidate.learnedFrom.labels, pile.candidate.learnedFrom.speakers)}
      </p>
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr><th className="py-1 pr-3"></th><th className="py-1 pr-3">{EVALUATION_COPY.successRate}</th><th className="py-1">{EVALUATION_COPY.attemptRate}</th></tr>
        </thead>
        <tbody>
          <tr className="border-t border-border"><td className="py-1 pr-3">{EVALUATION_COPY.candidate}</td><td className="py-1 pr-3 tabular-nums">{pct(test.candidate.successRate)}</td><td className="py-1 tabular-nums">{pct(test.candidate.attemptRate)}</td></tr>
          <tr className="border-t border-border"><td className="py-1 pr-3">{EVALUATION_COPY.today}</td><td className="py-1 pr-3 tabular-nums">{pct(test.baseline.successRate)}</td><td className="py-1 tabular-nums">{pct(test.baseline.attemptRate)}</td></tr>
        </tbody>
      </table>
      <dl className="mt-2 flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-3"><dt>{EVALUATION_COPY.gain}</dt><dd className="tabular-nums">{pts(test.successGain)}</dd></div>
        <div className="flex justify-between gap-3"><dt>{EVALUATION_COPY.interval}</dt><dd className="tabular-nums">{interval ? `${pts(interval[0])} to ${pts(interval[1])}` : EVALUATION_COPY.none}</dd></div>
        <div className="flex justify-between gap-3"><dt>{EVALUATION_COPY.attemptChange}</dt><dd className="tabular-nums">{pts(test.attemptRateChange)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{EVALUATION_COPY.agrees(test.holdout.candidateAgrees, test.holdout.exposures)}</p>
      <FairTestVerdict test={test} />
      <ul className="mt-2 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        <li className="font-medium uppercase tracking-[0.08em]">{EVALUATION_COPY.preferences}</li>
        {pile.candidate.preferences.map((row) => (
          <li key={row.exerciseId} className="flex justify-between gap-3">
            <span>{row.exerciseId}</span>
            <span className="tabular-nums">{row.helped} / {row.counted} · {pct(row.helpedRate)} · {row.trusted ? EVALUATION_COPY.trusted : EVALUATION_COPY.untrusted}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Piles({ evaluation, titles }: { evaluation: JarEvaluation & { piles: Record<JarPile, JarPileEvaluation> }; titles: ReadonlyMap<string, string> }) {
  const [pile, setPile] = useState<JarPile>("machine_only");
  return (
    <>
      <p className="mt-1 text-xs text-muted-foreground">{EVALUATION_COPY.unsealed}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist">
        {JAR_PILES.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={pile === name} onClick={() => setPile(name)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
              pile === name ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"}`}>
            {EVALUATION_COPY.pile[name]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{EVALUATION_COPY.pileHelp[pile]}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Scoreboard pile={evaluation.piles[pile]} titles={titles} />
        <FairTest pile={evaluation.piles[pile]} />
      </div>
    </>
  );
}

/** The evaluation: the one sentence that says why it is sealed, or the two
 *  piles once the bar is met. */
export function JarEvaluationView({ evaluation, titles }: { evaluation: JarEvaluation; titles: ReadonlyMap<string, string> }) {
  const piles = evaluation.piles;
  return (
    <section className="rounded-xl border border-border p-3" data-testid="pace-jar-evaluation">
      <h3 className="text-sm font-semibold">{EVALUATION_COPY.heading}</h3>
      {evaluation.sealed || !piles ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {evaluation.whyNot ? EVALUATION_COPY.sealed(evaluation.whyNot) : EVALUATION_COPY.sealedNoReason}
        </p>
      ) : (
        <Piles evaluation={{ ...evaluation, piles }} titles={titles} />
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        <code>{evaluation.versions.evaluation}</code> · <code>{evaluation.versions.candidate}</code> · <code>{evaluation.versions.fairTest}</code>
      </p>
    </section>
  );
}

/** Everything under the jar's heading on the pace panel. The evaluation is
 *  drawn only when the ledger read carries it. */
export default function JarPanel({
  jar,
  evaluation,
  titles,
}: {
  jar: ExerciseJar;
  evaluation: JarEvaluation | null;
  /** Exercise id → its title, when the library could be read. */
  titles: ReadonlyMap<string, string>;
}) {
  return (
    <div className="grid gap-3" data-testid="pace-jar">
      {jar.unavailable.length > 0 ? (
        <p role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          {JAR_COPY.unavailable(jar.unavailable.map((s) => JAR_COPY.sources[s]).join(", "))}
        </p>
      ) : null}
      <JarSummary jar={jar} />
      <JarExercises jar={jar} titles={titles} />
      <JarBreakdown jar={jar} />
      {evaluation ? <JarEvaluationView evaluation={evaluation} titles={titles} /> : null}
      <p className="text-[11px] text-muted-foreground">
        {JAR_COPY.versions}: <code>{jar.versions.signalRules}</code> · <code>{jar.versions.noiseGate}</code> ·{" "}
        <code>{jar.versions.labelSpec}</code>
      </p>
    </div>
  );
}
