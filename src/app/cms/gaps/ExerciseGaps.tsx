"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  adminExerciseGaps,
  adminListDiagnosticExercises,
  type ExerciseGapPattern,
  type ExerciseGaps,
  type GapCoverage,
  type GapSource,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  /cms/gaps — WHICH PATTERNS MOST NEED AN EXERCISE (backend 2026-09-28,     */
/*  step 5).                                                                  */
/*                                                                            */
/*  One row per pattern, already in the order to film: needs an exercise      */
/*  first, then trial only, covered, being tested and not detectable yet.     */
/*                                                                            */
/*  INTERNAL. Counts are about the library and go nowhere near a speaker.     */
/*  A source the backend could not read is UNKNOWN, never 0: an empty count   */
/*  would tell the author nothing needs filming when the truth is that we     */
/*  could not look.                                                           */
/*                                                                            */
/*  Password-gated like the rest of the CMS; a tab without the password is    */
/*  bounced to /cms, which comes back here after unlocking.                   */
/* -------------------------------------------------------------------------- */

const PW_KEY = "willpower.journal.pw";
const WINDOWS = [7, 30, 90] as const;

/** Every sentence on this screen, in one place. Founder sign-off 2026-09-28. */
export const GAPS_COPY = {
  title: "Exercise gaps",
  intro:
    "Which patterns most need an exercise filmed, most urgent first. Counts cover the chosen window.",
  window: (days: number) => `Last ${days} days`,
  pattern: "Pattern",
  status: "Status",
  spotted: "Times spotted",
  waiting: "Coach requests waiting",
  exercises: "Exercises",
  main: "Main",
  trial: "Trial",
  none: "None",
  unknown: "Unknown",
  film: "Film one",
  beingTested: (fired: string, measured: string) => `Silent test: fired on ${fired} of ${measured} clips`,
  nothingSpotted: (n: string) =>
    `${n} coach requests are waiting on moments where nothing was spotted.`,
  unavailable: (names: string) =>
    `Couldn’t read ${names}. Those numbers show as unknown, not zero.`,
  empty: "No patterns in the library yet.",
  failed: "Couldn’t load the gap view.",
  back: "Back to the CMS",
  coverage: {
    no_exercise: "Needs an exercise",
    trial_only: "Trial only",
    covered: "Covered",
    being_tested: "Being tested",
    not_detectable_yet: "Not detectable yet",
  } satisfies Record<GapCoverage, string>,
  sources: {
    match_traces: "how often patterns were spotted",
    coach_requests: "coach requests",
    shadow_observations: "silent-test results",
  } satisfies Record<GapSource, string>,
} as const;

const TONE: Record<GapCoverage, string> = {
  no_exercise: "bg-destructive/10 text-destructive",
  trial_only: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  covered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  being_tested: "bg-muted text-foreground",
  not_detectable_yet: "bg-muted text-muted-foreground",
};

/** A count, or "Unknown" when its source could not be read. */
export function gapCount(value: number, source: GapSource, unavailable: readonly GapSource[]): string {
  return unavailable.includes(source) ? GAPS_COPY.unknown : String(value);
}

/** Needs filming: the only rows that offer "Film one". */
function needsFilming(pattern: ExerciseGapPattern): boolean {
  return pattern.coverage === "no_exercise" || pattern.coverage === "trial_only";
}

function Exercises({ pattern, titles }: { pattern: ExerciseGapPattern; titles: Map<string, string> }) {
  const name = (id: string) => titles.get(id) ?? id;
  if (pattern.mainExercises.length === 0 && pattern.secondaryExercises.length === 0) {
    return <span className="text-muted-foreground">{GAPS_COPY.none}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {pattern.mainExercises.length ? (
        <span>{GAPS_COPY.main}: {pattern.mainExercises.map(name).join(", ")}</span>
      ) : null}
      {pattern.secondaryExercises.length ? (
        <span className="text-muted-foreground">
          {GAPS_COPY.trial}: {pattern.secondaryExercises.map(name).join(", ")}
        </span>
      ) : null}
    </div>
  );
}

function GapRow({
  pattern,
  unavailable,
  titles,
}: {
  pattern: ExerciseGapPattern;
  unavailable: readonly GapSource[];
  titles: Map<string, string>;
}) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2.5">
        <div className="font-medium text-foreground">{pattern.label}</div>
        <code className="text-[11px] text-muted-foreground">{pattern.errorId}</code>
        {pattern.shadow ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {GAPS_COPY.beingTested(
              gapCount(pattern.shadow.clipsFired, "shadow_observations", unavailable),
              gapCount(pattern.shadow.clipsMeasured, "shadow_observations", unavailable),
            )}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[pattern.coverage]}`}>
          {GAPS_COPY.coverage[pattern.coverage]}
        </span>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{gapCount(pattern.spotted, "match_traces", unavailable)}</td>
      <td className="px-3 py-2.5 tabular-nums">{gapCount(pattern.openCoachRequests, "coach_requests", unavailable)}</td>
      <td className="px-3 py-2.5 text-xs"><Exercises pattern={pattern} titles={titles} /></td>
      <td className="px-3 py-2.5 text-right">
        {needsFilming(pattern) ? (
          <Link href="/cms/new/exercise/1" className="whitespace-nowrap text-xs font-medium text-foreground underline">
            {GAPS_COPY.film}
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function GapTable({ gaps, titles }: { gaps: ExerciseGaps; titles: Map<string, string> }) {
  if (gaps.patterns.length === 0) {
    return <p className="text-sm text-muted-foreground">{GAPS_COPY.empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{GAPS_COPY.pattern}</th>
            <th className="px-3 py-2 font-medium">{GAPS_COPY.status}</th>
            <th className="px-3 py-2 font-medium">{GAPS_COPY.spotted}</th>
            <th className="px-3 py-2 font-medium">{GAPS_COPY.waiting}</th>
            <th className="px-3 py-2 font-medium">{GAPS_COPY.exercises}</th>
            <th className="px-3 py-2" aria-label={GAPS_COPY.film} />
          </tr>
        </thead>
        <tbody>
          {gaps.patterns.map((pattern) => (
            <GapRow key={pattern.errorId} pattern={pattern} unavailable={gaps.unavailable} titles={titles} />
          ))}
        </tbody>
      </table>
    </div>
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
    router.replace(`/cms?next=${encodeURIComponent("/cms/gaps")}`);
  }, [router]);
  return password;
}

export default function ExerciseGapsPage() {
  const password = usePassword();
  const [days, setDays] = useState<number>(30);
  const [gaps, setGaps] = useState<ExerciseGaps | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    let alive = true;
    setGaps(null);
    setError(null);
    void adminExerciseGaps(password, days).then((result) => {
      if (!alive) return;
      if (result.ok) setGaps(result.data);
      else setError(result.message || GAPS_COPY.failed);
    });
    return () => { alive = false; };
  }, [password, days]);

  useEffect(() => {
    if (!password) return;
    void adminListDiagnosticExercises(password).then((result) => {
      if (result.ok) setTitles(new Map(result.data.map((e) => [e.exerciseId, e.title])));
    });
  }, [password]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link href="/cms" className="text-xs text-muted-foreground underline">{GAPS_COPY.back}</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{GAPS_COPY.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{GAPS_COPY.intro}</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Window">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={days === w}
              onClick={() => setDays(w)}
              className={`rounded-full border px-3 py-1 text-xs ${
                days === w ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
              }`}
            >
              {GAPS_COPY.window(w)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}
        {gaps?.unavailable.length ? (
          <p role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            {GAPS_COPY.unavailable(gaps.unavailable.map((s) => GAPS_COPY.sources[s]).join(", "))}
          </p>
        ) : null}
        {gaps ? <GapTable gaps={gaps} titles={titles} /> : error ? null : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
        {gaps ? (
          <p className="text-xs text-muted-foreground">
            {GAPS_COPY.nothingSpotted(gapCount(gaps.nothingSpottedOpenRequests, "coach_requests", gaps.unavailable))}
          </p>
        ) : null}
      </div>
    </main>
  );
}
