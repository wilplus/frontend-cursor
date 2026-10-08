"use client";

/* -------------------------------------------------------------------------- */
/*  L1 · The Library (founder 2026-09-30, A8; build plan P2-13).                */
/*                                                                            */
/*  The exercise lane is the Library list, then the same three screens as     */
/*  the walk: New → Pattern → Words, Video, Home. Videos by main target, then  */
/*  the praise lines and the rewrite moves of the catalogue. The long form    */
/*  is gone; a moment's answer and a library entry are one way to add.        */
/*  Outside a moment the Words screen opens with the library's own past final */
/*  for the pattern, never with a speaker's words.                            */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserProfile } from "@/components/willab/useUserProfile";
import LoadingState from "@/components/willab/LoadingState";
import CoachPatternSheet, { type PatternChoice } from "@/components/willab/coachwalk/CoachPatternSheet";
import CoachAnswerOverlay from "@/components/willab/coachwalk/CoachAnswerOverlay";
import type { PatternOption } from "@/components/willab/coachwalk/CoachHomeSheet";
import { listCoachExercises, type CoachExercise } from "@/services/api/coachExercises";
import { listCatalogue, type CatalogueLine } from "@/services/api/coachWalk";
import type { SpeakingError } from "@/services/api/speakingErrors";
import { CUE_OPTIONS } from "@/lib/willab/coachAnswer";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";

function mainTargetOf(exercise: CoachExercise): string {
  const primary = exercise.matchingCriteria?.primary_problem_tag;
  return typeof primary === "string" && primary ? primary : exercise.acousticProblemTags[0] ?? "";
}

function transcriptWord(exercise: CoachExercise): string | null {
  const status = exercise.latestVersion?.transcriptStatus;
  if (status === "done") return COPY.libraryTranscribed;
  if (status === "pending") return COPY.libraryTranscribing;
  return null;
}

function Row({ title, detail, onClick }: { title: string; detail: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-semibold text-foreground">{title}</span>
        <span className="text-[12px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function pastFinalFor(choice: PatternChoice, exercises: CoachExercise[], lines: CatalogueLine[]): string | null {
  if (choice.kind === "error") {
    const same = exercises.filter((e) => mainTargetOf(e) === choice.patternKey && e.instruction.trim());
    return same[0]?.instruction ?? null;
  }
  const lane = choice.kind === "praise" ? "praise" : "rewrite";
  const same = lines.filter((l) => l.lane === lane && l.patternKey === choice.patternKey && l.active)
    .sort((a, b) => b.version - a.version);
  return same[0]?.text ?? null;
}

export default function CoachLibraryClient() {
  const { isCoach, loading: profileLoading } = useUserProfile();
  const [exercises, setExercises] = useState<CoachExercise[]>([]);
  const [errors, setErrors] = useState<SpeakingError[]>([]);
  const [lines, setLines] = useState<CatalogueLine[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<"list" | "pattern" | "answer">("list");
  const [choice, setChoice] = useState<PatternChoice | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const [library, catalogue] = await Promise.all([listCoachExercises(), listCatalogue()]);
    if (!library.ok) {
      setLoadError(library.message);
    } else {
      setExercises(library.data.exercises);
      setErrors(library.data.speakingErrors);
    }
    setLines(catalogue);
  }, []);

  useEffect(() => {
    if (isCoach) void refresh();
  }, [isCoach, refresh]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("new") === "1") setStep("pattern");
    } catch { /* no address to read */ }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const options: PatternOption[] = useMemo(() => errors.filter((e) => e.active).map((e) => ({
    key: e.errorId, label: e.label, locked: e.status !== "detected",
  })), [errors]);
  const labels = useMemo(() => new Map(errors.map((e) => [e.errorId, e.label])), [errors]);

  if (profileLoading) return <LoadingState placement="viewport" />;
  if (!isCoach) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-6">
        <p className="text-center text-[15px] text-muted-foreground">Nothing here for you.</p>
      </main>
    );
  }

  const praise = lines.filter((l) => l.lane === "praise" && l.active);
  const moves = lines.filter((l) => l.lane === "rewrite" && l.active);
  const byKey = (rows: CatalogueLine[]) => {
    const out = new Map<string, number>();
    for (const l of rows) out.set(l.patternKey, (out.get(l.patternKey) ?? 0) + 1);
    return [...out.entries()];
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pb-28 pt-8" data-testid="coach-library">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">{COPY.libraryTitle}</h1>
      {loadError ? <p role="alert" className="text-[13px] text-destructive">{loadError}</p> : null}
      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{COPY.libraryEyebrowVideos}</span>
        {exercises.length === 0 && !loadError ? (
          <p className="text-[14px] text-muted-foreground">{COPY.libraryEmpty}</p>
        ) : null}
        {exercises.map((e) => {
          const target = mainTargetOf(e);
          const bits = [labels.get(target) ?? target, `v${e.version}`, transcriptWord(e), e.active ? null : COPY.libraryRetired]
            .filter((b): b is string => Boolean(b));
          return <Row key={e.exerciseId} title={e.title} detail={bits.join(" · ")} />;
        })}
      </section>
      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{COPY.libraryEyebrowLines}</span>
        {byKey(praise).map(([key, n]) => (
          <Row key={`p:${key}`} title={key === "confident_read" ? COPY.homeConfidentRead : (CUE_OPTIONS.find((c) => c.key === key)?.label ?? key)} detail={COPY.libraryLine(n)} />
        ))}
        {byKey(moves).map(([key, n]) => (
          <Row key={`m:${key}`} title={COPY.homeMoves[key as keyof typeof COPY.homeMoves] ?? key} detail={COPY.libraryMove(n)} />
        ))}
      </section>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg px-5 pb-6">
        <button type="button" className={`${PILL} w-full`} onClick={() => setStep("pattern")} data-testid="coach-library-new">
          {COPY.pillNew}
        </button>
      </div>
      {step === "pattern" ? (
        <CoachPatternSheet errors={options} onClose={() => setStep("list")}
          onNext={(c) => { setChoice(c); setStep("answer"); }} />
      ) : null}
      {step === "answer" && choice ? (
        <CoachAnswerOverlay
          key={`${choice.kind}:${choice.patternKey}`}
          kind={choice.kind}
          context={{ moment: null, patternKey: choice.patternKey, errors: options, cues: CUE_OPTIONS,
            pastFinal: pastFinalFor(choice, exercises, lines) }}
          baseIndex={1}
          baseTotal={4}
          onClose={() => setStep("pattern")}
          onDone={() => { setStep("list"); setChoice(null); setToast(COPY.toastLibraryOnly); void refresh(); }}
        />
      ) : null}
      {toast ? (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
          <span className="rounded-xl bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">{toast}</span>
        </div>
      ) : null}
    </main>
  );
}
