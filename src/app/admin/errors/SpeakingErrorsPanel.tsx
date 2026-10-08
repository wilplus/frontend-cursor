"use client";

/* -------------------------------------------------------------------------- */
/*  /admin/errors — the founder's Speaking errors page (coach panel lock,     */
/*  CP3 A; design locked 2026-10-07, N57; build plan D-CP-21), drawn to the   */
/*  prototype's screens:                                                      */
/*                                                                            */
/*    errors   Speaking errors, in three groups: detected in audio (routes    */
/*             exercises), being tested (routes nothing yet), named only      */
/*             (waiting on a detector); each row with its state word          */
/*    error    one error: what it is, how often coaches heard it (the signed   */
/*             readiness line, from the founder's ledger, where the ledger    */
/*             has a row), and the exercises that treat it, or "None yet."    */
/*                                                                            */
/*  Coach-named errors (Q-B7 A: stored as "named by a coach" until the       */
/*  founder defines them) sit under "Named only · waiting on a detector" as   */
/*  "Observed". Every word is COACH_PANEL_COPY's. L3: a row is a name and a   */
/*  definition, never evidence of a recording. AC-9: the readiness line is   */
/*  the founder's read of a detector, never a coach's or a speaker's.        */
/*  An error a coach named (observed) keeps a way to write its definition and */
/*  its one question here (founder 2026-10-08, Q-CP645 A), in the panel's    */
/*  look: the words with the pencil, saved when the pencil is tapped again;  */
/*  a refusal shows the backend's own sentence. A detected or tested error   */
/*  is read only: saving over one would demote it and stop it routing.       */
/*  The page waits behind NEXT_PUBLIC_COACH_PANEL_V2 (page.tsx).             */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/willab/LoadingState";
import WalkStage from "@/components/willab/walk/WalkStage";
import WalkOverlay from "@/components/willab/walk/WalkOverlay";
import WalkChoices, { type WalkChoice } from "@/components/willab/walk/WalkChoices";
import { useUserProfile } from "@/components/willab/useUserProfile";
import { founderLearning } from "@/services/api/founderLearning";
import type { PaceRow } from "@/lib/founder/pace";
import { listSpeakingErrors, saveSpeakingError, type SpeakingError } from "@/services/api/speakingErrors";
import CoachWords from "@/components/willab/coachpanel/CoachWords";
import { listCoachExercises, type CoachExercise } from "@/services/api/coachExercises";
import { mainTargetOf } from "../library/LibraryPanel";
import type { WalkDir, WalkScreen } from "@/lib/willab/walkMotion";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

/* ── the pure parts ──────────────────────────────────────────────────── */

export type ErrorsScreen = { key: "errors" } | { key: "error"; id: string };

/** The three groups, in the prototype's order, with their label and the
 *  state word their rows carry. */
export const GROUPS: { of: SpeakingError["status"]; label: string; state: string }[] = [
  { of: "detected", label: COPY.groupDetected, state: COPY.stateDetected },
  { of: "shadow", label: COPY.groupBeingTested, state: COPY.stateBeingTested },
  { of: "observed", label: COPY.groupNamedOnly, state: COPY.stateObserved },
];

export function stateWord(status: SpeakingError["status"]): string {
  return GROUPS.find((g) => g.of === status)?.state ?? COPY.stateObserved;
}

export function errorChoice(entry: SpeakingError): WalkChoice {
  return { value: entry.errorId, label: entry.label, subtitle: stateWord(entry.status) };
}

/** The cue id a shadow entry's detector names, e.g. verbal_cues:hedging → hedging. */
export function cueOf(entry: SpeakingError): string | null {
  const ref = entry.detectorRef ?? "";
  const i = ref.indexOf(":");
  return i > 0 ? ref.slice(i + 1) : ref || null;
}

/** The signed readiness line (founder 2026-10-06, P51b A; N53): how many
 *  moments coaches heard it on, of the bar. Only where the ledger has a row
 *  with a count; a coach never sees it (AC-9). */
export function readinessLine(row: PaceRow | undefined): string | null {
  if (!row || row.current === null) return null;
  return COPY.coachesHeardIt(row.current, row.bar);
}

export function paceRowFor(entry: SpeakingError, pace: readonly PaceRow[] | null): PaceRow | undefined {
  if (!pace || entry.status !== "shadow") return undefined;
  const cue = cueOf(entry);
  return cue ? pace.find((r) => r.jar === `shadow_cues.${cue}`) : undefined;
}

/** The exercises that treat an error: those with it as their main target. */
export function exercisesFor(errorId: string, exercises: readonly CoachExercise[]): CoachExercise[] {
  return exercises.filter((e) => e.active && mainTargetOf(e) === errorId);
}

function walkScreenOf(screen: ErrorsScreen): WalkScreen {
  return screen.key === "errors" ? { key: "errors" } : { key: "error", kind: screen.id };
}

/* ── an observed error's words ───────────────────────────────────────── */

type Field = "definition" | "asks";

/** The definition and the one question of an error a coach named, each with
 *  the pencil (Q-CP645 A). Done saves both through the library's own write;
 *  nothing is saved when nothing changed. */
export function ErrorWords({ entry, onSaved }: { entry: SpeakingError; onSaved: () => void | Promise<void> }) {
  const [words, setWords] = useState<Record<Field, string>>({ definition: entry.definition, asks: entry.asks });
  const [editing, setEditing] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(field: Field) {
    if (saving) return;
    if (editing !== field) {
      setEditing(field);
      setError(null);
      return;
    }
    if (words.definition === entry.definition && words.asks === entry.asks) {
      setEditing(null);
      return;
    }
    setSaving(true);
    const result = await saveSpeakingError({ errorId: entry.errorId, label: entry.label, ...words });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(null);
    setError(null);
    await onSaved();
  }

  return (
    <div className="flex flex-col gap-5" data-testid="error-words">
      {(["definition", "asks"] as const).map((field) => (
        <div key={field} data-testid={`error-${field}`}>
          <CoachWords bare text={words[field]} editing={editing === field}
            onChange={(text) => setWords((w) => ({ ...w, [field]: text }))}
            onToggle={() => void toggle(field)} />
        </div>
      ))}
      {error ? <p role="alert" className="m-0 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────── */

type Stage = WalkScreen & { err: ErrorsScreen };

export default function SpeakingErrorsClient({ founder = false }: { founder?: boolean }) {
  const router = useRouter();
  const { isCoach, loading: profileLoading } = useUserProfile();
  const [pace, setPace] = useState<PaceRow[] | null>(null);
  const [entries, setEntries] = useState<SpeakingError[] | null>(null);
  const [exercises, setExercises] = useState<CoachExercise[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ErrorsScreen>({ key: "errors" });
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const [result, library] = await Promise.all([listSpeakingErrors(), listCoachExercises()]);
    if (!result.ok) {
      setLoadError(result.message);
      setEntries([]);
    } else {
      setEntries(result.data);
    }
    if (library.ok) setExercises(library.data.exercises);
  }, []);

  useEffect(() => {
    if (!founder) return;
    let live = true;
    void founderLearning.ledger().then((r) => {
      if (live && r.ok) setPace(r.value.pace);
    });
    return () => { live = false; };
  }, [founder]);

  useEffect(() => {
    if (isCoach) void refresh();
  }, [isCoach, refresh]);

  const stage: Stage = useMemo(() => ({ ...walkScreenOf(screen), err: screen }), [screen]);
  const close = () => router.push("/chat");
  const back = () => { setScreen({ key: "errors" }); setDir("back"); };

  function render(s: Stage) {
    const err = s.err;
    if (err.key === "error") {
      const entry = (entries ?? []).find((e) => e.errorId === err.id);
      if (!entry) return <WalkOverlay onBack={back} backLabel={COPY.speakingErrors} onClose={close} testId="errors-item" />;
      const heard = readinessLine(paceRowFor(entry, founder ? pace : null));
      const treat = exercisesFor(entry.errorId, exercises);
      return (
        <WalkOverlay onBack={back} backLabel={COPY.speakingErrors} onClose={close} title={entry.label}
          subtitle={stateWord(entry.status)} testId="errors-item">
          {entry.status === "observed" ? (
            <ErrorWords key={entry.errorId} entry={entry} onSaved={refresh} />
          ) : (
            <p className="m-0 text-[16px] font-medium" data-testid="error-definition">{entry.definition}</p>
          )}
          {heard ? <p className="m-0 text-[16px] font-semibold" data-testid="error-readiness">{heard}</p> : null}
          <section className="flex flex-col gap-2" data-testid="error-exercises">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{COPY.exercisesThatTreatIt}</span>
            {treat.length > 0 ? (
              <WalkChoices label={COPY.exercisesThatTreatIt}
                choices={treat.map((e) => ({ value: e.exerciseId, label: e.title }))}
                onPick={(id) => router.push(`/admin/library?item=${encodeURIComponent(id)}`)} />
            ) : (
              <p className="m-0 text-[16px] font-medium">{COPY.noneYet}</p>
            )}
          </section>
        </WalkOverlay>
      );
    }
    return (
      <WalkOverlay onClose={close} title={COPY.speakingErrors} subtitle={COPY.errorsCaption} testId="errors-list">
        {loadError ? <p role="alert" className="m-0 text-[13px] text-destructive">{loadError}</p> : null}
        {GROUPS.map((group) => {
          const rows = (entries ?? []).filter((e) => e.status === group.of);
          if (rows.length === 0) return null;
          return (
            <section key={group.of} className="flex flex-col gap-2" data-testid={`errors-${group.of}`}>
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</span>
              <WalkChoices label={group.label} choices={rows.map(errorChoice)}
                onPick={(id) => { setScreen({ key: "error", id }); setDir("forward"); }} />
            </section>
          );
        })}
      </WalkOverlay>
    );
  }

  if (profileLoading) return <LoadingState placement="viewport" />;
  // Founder only (page.tsx); a non-coach session draws nothing at all.
  if (!isCoach) return null;
  if (entries === null) return <LoadingState placement="viewport" />;

  return (
    <main className="min-h-[100dvh] bg-background" data-testid="admin-errors">
      <WalkStage screen={stage} dir={dir} render={render} />
    </main>
  );
}
