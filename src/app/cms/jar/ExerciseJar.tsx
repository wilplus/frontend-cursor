"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  adminExerciseLearningEvaluation,
  adminExerciseLearningReadiness,
  adminListDiagnosticExercises,
  JAR_EXCLUSIONS,
  JAR_PILES,
  type ExerciseJar,
  type JarEvaluation,
  type JarExclusion,
  type JarExercise,
  type JarFairTest,
  type JarPile,
  type JarPileEvaluation,
  type JarSource,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  /cms/jar — HOW FULL THE EXERCISE LEARNING JAR IS (founder 2026-09-29,      */
/*  decision 5; backend step 8 prep, exercise-adequacy-label-v1 §3.5 item 8). */
/*                                                                            */
/*  The bar: 300 first-exposure attempts with a valid endpoint, and 30 for    */
/*  every exercise a ranker would rank. This page shows how far along that    */
/*  is, per exercise, and why renders were left out.                          */
/*                                                                            */
/*  COUNTS ONLY. Nothing here says whether an exercise worked: the backend    */
/*  computes no result for this page and the client reads no such field.     */
/*  Peeking at results while the jar fills would let the bar be judged        */
/*  against the very thing it exists to protect (AC-9 is not the concern      */
/*  here; the scorekeeper's seal is).                                         */
/*                                                                            */
/*  INTERNAL. A source the backend could not read is UNKNOWN, never 0, and    */
/*  the jar is then not ready rather than emptier.                            */
/*                                                                            */
/*  Password-gated like the rest of the CMS; a tab without the password is    */
/*  bounced to /cms, which comes back here after unlocking.                   */
/* -------------------------------------------------------------------------- */

const PW_KEY = "willpower.journal.pw";

/** Every sentence on this screen, in one place. Internal CMS wording;
 *  founder sign-off pending (accepted design, 2026-09-29). */
export const JAR_COPY = {
  title: "The jar",
  intro:
    "Practices counted toward the exercise learning bar. Counts only; no result is shown here.",
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
    no_targeted_problem: "No targeted problem fired",
    rules_changed: "Traced under other signal rules",
    repeat: "Not the speaker's first exposure to that problem",
    below_minimum_probability: "Below the draw's minimum probability",
    no_attempt: "No practice attempt",
    no_valid_attempt: "No valid attempt",
  } satisfies Record<JarExclusion, string>,
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
  failed: "Couldn’t load the jar.",
  versions: "Rules in force",
  gaps: "Exercise gaps",
  back: "Back to the CMS",
} as const;

/** A count, or "Unknown" when its source could not be read. */
export function jarCount(value: number, source: JarSource, unavailable: readonly JarSource[]): string {
  return unavailable.includes(source) ? JAR_COPY.unknown : String(value);
}

function percent(value: number, of: number): number {
  if (of <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / of) * 100)));
}

function Meter({ value, of, label }: { value: number; of: number; label: string }) {
  const pct = percent(value, of);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={Math.min(value, of)}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ExerciseRow({ row, jar, titles }: { row: JarExercise; jar: ExerciseJar; titles: Map<string, string> }) {
  const unavailable = jar.unavailable;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2.5">
        <div className="font-medium text-foreground">{titles.get(row.exerciseId) ?? row.exerciseId}</div>
        <code className="text-[11px] text-muted-foreground">{row.exerciseId}</code>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{jarCount(row.exposures, "exposures", unavailable)}</td>
      <td className="px-3 py-2.5 tabular-nums">{jarCount(row.cohort, "match_traces", unavailable)}</td>
      <td className="px-3 py-2.5">
        <div className="tabular-nums">
          {jarCount(row.counted, "attempts", unavailable)} / {row.needed}
        </div>
        <div className="mt-1 w-28">
          <Meter value={row.counted} of={row.needed} label={JAR_COPY.perExercise(row.needed)} />
        </div>
      </td>
    </tr>
  );
}

function ExerciseTable({ jar, titles }: { jar: ExerciseJar; titles: Map<string, string> }) {
  if (jar.exercises.length === 0) {
    return <p className="text-sm text-muted-foreground">{JAR_COPY.empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
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

function Breakdown({ jar }: { jar: ExerciseJar }) {
  const modes = Object.entries(jar.countedBySelectionMode);
  const leftOut = JAR_EXCLUSIONS.filter((name) => jar.excluded[name] > 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-border p-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{JAR_COPY.modes}</h2>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          {modes.length === 0 ? <dd className="text-muted-foreground">0</dd> : null}
          {modes.map(([mode, n]) => (
            <div key={mode} className="flex justify-between gap-3">
              <dt>{JAR_COPY.mode[mode] ?? mode}</dt>
              <dd className="tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-xl border border-border p-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{JAR_COPY.leftOut}</h2>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          {leftOut.length === 0 ? <dd className="text-muted-foreground">0</dd> : null}
          {leftOut.map((name) => (
            <div key={name} className="flex justify-between gap-3">
              <dt>{JAR_COPY.exclusion[name]}</dt>
              <dd className="tabular-nums">{jar.excluded[name]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Summary({ jar }: { jar: ExerciseJar }) {
  const rate = jar.attemptRate === null ? "–" : `${Math.round(jar.attemptRate * 100)}%`;
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {JAR_COPY.counted(jarCount(jar.counted, "attempts", jar.unavailable), jar.bar.minCounted)}
        </span>
        <span className="text-xs text-muted-foreground">
          {JAR_COPY.seen} {jarCount(jar.exposures, "exposures", jar.unavailable)} · {JAR_COPY.cohort}{" "}
          {jarCount(jar.cohort, "match_traces", jar.unavailable)} · {JAR_COPY.attemptRate} {rate}
        </span>
      </div>
      <div className="mt-3">
        <Meter value={jar.counted} of={jar.bar.minCounted} label={JAR_COPY.counted(String(jar.counted), jar.bar.minCounted)} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{jar.ready ? JAR_COPY.ready : jar.whyNot}</p>
    </section>
  );
}

/** Every sentence of the unsealed view, in one place. Internal CMS wording;
 *  founder sign-off pending (decision of 2026-09-29, evening). The words
 *  "helped" and "success" appear here and nowhere else on the page: this
 *  block renders only what the backend computes once the bar is met. */
export const EVALUATION_COPY = {
  heading: "The evaluation",
  sealed: (why: string) => `Sealed until the bar is met: ${why}.`,
  sealedNoReason: "Sealed until the bar is met.",
  unsealed: "The bar is met, so the scorekeeper and the fair test ran on their own. Nothing is promoted by this page; a learned ranking still needs your yes.",
  pile: {
    machine_only: "Machine picks only",
    with_coach_picks: "With coach picks",
  } satisfies Record<JarPile, string>,
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

function pct(value: number | null): string {
  return value === null ? EVALUATION_COPY.none : `${Math.round(value * 100)}%`;
}

function pts(value: number | null): string {
  if (value === null) return EVALUATION_COPY.none;
  const n = Math.round(value * 100);
  return `${n > 0 ? "+" : ""}${n} pts`;
}

function Scoreboard({ pile, titles }: { pile: JarPileEvaluation; titles: Map<string, string> }) {
  const board = pile.scoreboard;
  const modes = Object.entries(board.bySelectionMode);
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{EVALUATION_COPY.scoreboard}</h3>
      <p className="mt-1 text-sm text-foreground">
        {EVALUATION_COPY.overall(board.helped, board.counted)} · {EVALUATION_COPY.helpedRate} {pct(board.helpedRate)}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr><th className="py-1 pr-3">{EVALUATION_COPY.exercise}</th><th className="py-1 pr-3">{EVALUATION_COPY.counted}</th><th className="py-1 pr-3">{EVALUATION_COPY.helped}</th><th className="py-1">{EVALUATION_COPY.helpedRate}</th></tr>
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
      </div>
      {modes.length ? (
        <dl className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          <dt className="font-medium uppercase tracking-[0.08em]">{EVALUATION_COPY.byMode}</dt>
          {modes.map(([mode, v]) => (
            <dd key={mode} className="flex justify-between gap-3">
              <span>{JAR_COPY.mode[mode] ?? mode}</span>
              <span className="tabular-nums">{v.helped} / {v.counted} · {pct(v.helpedRate)}</span>
            </dd>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function FairTest({ pile }: { pile: JarPileEvaluation }) {
  const test: JarFairTest = pile.fairTest;
  const interval = test.successGainInterval95;
  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{EVALUATION_COPY.fairTest}</h3>
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
      {test.meetsBar ? (
        <p className="mt-2 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{EVALUATION_COPY.meets}</p>
      ) : (
        <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {EVALUATION_COPY.fails} {test.whyNot.join("; ")}
        </p>
      )}
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

/** The unsealed view, or the one sentence that says why it is sealed. Pure. */
export function EvaluationView({ evaluation, titles }: { evaluation: JarEvaluation; titles: Map<string, string> }) {
  const [pile, setPile] = useState<JarPile>("machine_only");
  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">{EVALUATION_COPY.heading}</h2>
      {evaluation.sealed || !evaluation.piles ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {evaluation.whyNot ? EVALUATION_COPY.sealed(evaluation.whyNot) : EVALUATION_COPY.sealedNoReason}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{EVALUATION_COPY.unsealed}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist">
            {JAR_PILES.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={pile === name}
                onClick={() => setPile(name)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  pile === name ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"
                }`}
              >
                {EVALUATION_COPY.pile[name]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{EVALUATION_COPY.pileHelp[pile]}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Scoreboard pile={evaluation.piles[pile]} titles={titles} />
            <FairTest pile={evaluation.piles[pile]} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            <code>{evaluation.versions.evaluation}</code> · <code>{evaluation.versions.candidate}</code> · <code>{evaluation.versions.fairTest}</code>
          </p>
        </>
      )}
    </section>
  );
}

function usePassword(): string {
  const router = useRouter();
  const [password, setPassword] = useState("");
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PW_KEY);
      if (saved) {
        setPassword(saved);
        return;
      }
    } catch {
      /* fall through to the bounce */
    }
    router.replace(`/cms?next=${encodeURIComponent("/cms/jar")}`);
  }, [router]);
  return password;
}

/** The jar as loaded: everything under the heading. Pure, so it can be
 *  rendered in a test without the app router. */
export function ExerciseJarView({ jar, titles }: { jar: ExerciseJar; titles: Map<string, string> }) {
  return (
    <>
      {jar.unavailable.length ? (
        <p role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {JAR_COPY.unavailable(jar.unavailable.map((s) => JAR_COPY.sources[s]).join(", "))}
        </p>
      ) : null}
      <Summary jar={jar} />
      <ExerciseTable jar={jar} titles={titles} />
      <Breakdown jar={jar} />
      <p className="text-[11px] text-muted-foreground">
        {JAR_COPY.versions}: <code>{jar.versions.signalRules}</code> · <code>{jar.versions.noiseGate}</code> ·{" "}
        <code>{jar.versions.labelSpec}</code>
      </p>
    </>
  );
}

export default function ExerciseJarPage() {
  const password = usePassword();
  const [jar, setJar] = useState<ExerciseJar | null>(null);
  const [evaluation, setEvaluation] = useState<JarEvaluation | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    let alive = true;
    void adminExerciseLearningReadiness(password).then((result) => {
      if (!alive) return;
      if (result.ok) setJar(result.data);
      else setError(result.message || JAR_COPY.failed);
    });
    void adminListDiagnosticExercises(password).then((result) => {
      if (alive && result.ok) setTitles(new Map(result.data.map((e) => [e.exerciseId, e.title])));
    });
    void adminExerciseLearningEvaluation(password).then((result) => {
      if (alive && result.ok) setEvaluation(result.data);
    });
    return () => { alive = false; };
  }, [password]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex gap-3">
        <Link href="/cms" className="text-xs text-muted-foreground underline">{JAR_COPY.back}</Link>
        <Link href="/cms/gaps" className="text-xs text-muted-foreground underline">{JAR_COPY.gaps}</Link>
      </div>
      <h1 className="mt-3 text-lg font-semibold text-foreground">{JAR_COPY.title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{JAR_COPY.intro}</p>
      <div className="mt-5 flex flex-col gap-4">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}
        {jar ? <ExerciseJarView jar={jar} titles={titles} /> : error ? null : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
        {jar && evaluation ? <EvaluationView evaluation={evaluation} titles={titles} /> : null}
      </div>
    </main>
  );
}
