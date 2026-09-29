"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import LoadingState from "@/components/willab/LoadingState";
import { useUserProfile } from "@/components/willab/useUserProfile";
import { authoringReturnTo, withAttachedExercise } from "@/app/cms/interruptedDestination";
import {
  BLANK_DRAFT,
  draftFrom,
  draftProblem,
  listCoachExercises,
  saveCoachExercise,
  saveCoachExerciseWithVideo,
  type AuthoringLibrary,
  type CoachExercise,
  type CoachExerciseDraft,
  type TranscriptStatus,
} from "@/services/api/coachExercises";
import ExerciseForm from "./ExerciseForm";

/* -------------------------------------------------------------------------- */
/*  /coach/exercises — EXERCISE AUTHORING IN THE COACH PANEL                   */
/*  (founder 2026-09-29, decision 4)                                           */
/*                                                                            */
/*  The library the matcher offers from, edited by the coach without the CMS   */
/*  password. Same catalogue service, same refusals, same live row; what the   */
/*  coach panel adds is that every save keeps its version (0395), the video   */
/*  is transcribed at upload under the coach's own authorization, and a first */
/*  script can be drafted from the library's own past finals.                 */
/*                                                                            */
/*  THE HAND-OFF. The review sends a coach here with `?new=1&returnTo=…&for=…` */
/*  when no exercise fitted a moment. After the save the coach goes back to    */
/*  that moment with the new exercise riding along as `attach` — preselected,  */
/*  never shared: the coach still presses the button that shares it.          */
/*                                                                            */
/*  L3 — this screen is about exercises, never about a speaker: no clip, no   */
/*  take and no outcome appears here. AC-9 — nothing here is a score; the     */
/*  version and the transcript's state are facts about the coach's own file.  */
/*                                                                            */
/*  COACH ONLY (N4): renders nothing for a non-coach even by direct URL; the   */
/*  BE role-gates every endpoint independently.                               */
/* -------------------------------------------------------------------------- */

/** Every sentence on this screen, in one place. Coach-facing wording; founder
 *  sign-off pending (accepted design, 2026-09-29). */
export const AUTHORING_COPY = {
  title: "Exercises",
  intro:
    "The library the matcher offers from. Every save keeps its version, and the video is transcribed when it is uploaded.",
  nothing: "Nothing here.",
  newExercise: "New exercise",
  edit: "Edit",
  empty: "No exercises yet.",
  retired: "Retired",
  version: (n: number) => `Version ${n}`,
  transcript: {
    not_requested: "No transcript",
    pending: "Transcribing",
    done: "Transcript ready",
    coach_authorization_missing: "No transcript: processing authorization missing",
    failed: "Transcript failed",
  } as Record<TranscriptStatus, string>,
  saved: (title: string, version: number) => `“${title}” is saved as version ${version}.`,
  returning: "Taking you back to the moment…",
} as const;

function defaultNavigate(to: string) {
  window.location.assign(to);
}

function ExerciseCard({
  exercise,
  labels,
  onEdit,
}: {
  exercise: CoachExercise;
  labels: ReadonlyMap<string, string>;
  onEdit: (exercise: CoachExercise) => void;
}) {
  const latest = exercise.latestVersion;
  return (
    <li className={`rounded-xl border border-border bg-background p-4 ${exercise.active ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{exercise.title}</h3>
          <code className="mt-0.5 block truncate text-[11px] text-muted-foreground">{exercise.exerciseId}</code>
        </div>
        <button
          type="button"
          onClick={() => onEdit(exercise)}
          className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[12px] font-medium text-foreground"
        >
          {AUTHORING_COPY.edit}
        </button>
      </div>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {exercise.acousticProblemTags.map((tag) => (
          <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {labels.get(tag) ?? tag}
          </span>
        ))}
      </p>
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        {AUTHORING_COPY.version(exercise.version)}
        {latest ? ` · ${AUTHORING_COPY.transcript[latest.transcriptStatus]}` : ""}
        {exercise.active ? "" : ` · ${AUTHORING_COPY.retired}`}
      </p>
    </li>
  );
}

export default function CoachExerciseAuthoringClient({
  navigate = defaultNavigate,
}: {
  /** Where the hand-off returns the coach. Injectable for tests. */
  navigate?: (to: string) => void;
}) {
  const { isCoach, loading: profileLoading } = useUserProfile();
  const [library, setLibrary] = useState<AuthoringLibrary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CoachExerciseDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const result = await listCoachExercises();
    if (!result.ok) {
      setLoadError(result.message);
      setLibrary({ exercises: [], speakingErrors: [] });
      return;
    }
    setLibrary(result.data);
  }, []);

  useEffect(() => {
    if (isCoach) void refresh();
  }, [isCoach, refresh]);

  // The review's hand-off opens the blank form straight away.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("new") === "1") {
        setDraft({ ...BLANK_DRAFT });
        setIsNew(true);
      }
    } catch {
      /* no address to read; the coach opens the form by hand */
    }
  }, []);

  function openNew() {
    setDraft({ ...BLANK_DRAFT });
    setIsNew(true);
    setVideoFile(null);
    setProblem(null);
    setSaved(null);
  }

  function openEdit(exercise: CoachExercise) {
    setDraft(draftFrom(exercise));
    setIsNew(false);
    setVideoFile(null);
    setProblem(null);
    setSaved(null);
  }

  function close() {
    setDraft(null);
    setVideoFile(null);
    setProblem(null);
  }

  async function save() {
    if (!draft || saving) return;
    const refusal = draftProblem(draft, Boolean(videoFile) || Boolean(draft.explanationVideoUrl.trim()));
    if (refusal) {
      setProblem(refusal);
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = videoFile
      ? await saveCoachExerciseWithVideo(draft, videoFile)
      : await saveCoachExercise(draft);
    setSaving(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    const { exercise, version } = result.data;
    setSaved(AUTHORING_COPY.saved(exercise.title, version));
    close();
    const back = authoringReturnTo();
    if (back) {
      navigate(withAttachedExercise(back, exercise.exerciseId));
      return;
    }
    await refresh();
  }

  if (profileLoading) return <LoadingState placement="viewport" />;
  // N4 — nothing for a non-coach, even by direct URL.
  if (!isCoach) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-6">
        <p className="text-center text-[15px] text-muted-foreground">{AUTHORING_COPY.nothing}</p>
      </main>
    );
  }

  const errors = library?.speakingErrors ?? [];
  const labels = new Map(errors.map((e) => [e.errorId, e.label]));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{AUTHORING_COPY.title}</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{AUTHORING_COPY.intro}</p>
        </div>
        {draft ? null : (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[12px] font-medium text-background"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {AUTHORING_COPY.newExercise}
          </button>
        )}
      </header>

      {loadError ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {loadError}
        </p>
      ) : null}

      {saved ? (
        <p className="mt-6 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {saved}
        </p>
      ) : null}

      {draft ? (
        <ExerciseForm
          draft={draft}
          onDraft={setDraft}
          errors={errors}
          isNew={isNew}
          videoFile={videoFile}
          onVideoFile={setVideoFile}
          onSave={() => void save()}
          onCancel={close}
          saving={saving}
          problem={problem}
        />
      ) : null}

      {library === null ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <section className="mt-8">
          {library.exercises.length ? (
            <ul className="grid gap-3">
              {library.exercises.map((exercise) => (
                <ExerciseCard key={exercise.exerciseId} exercise={exercise} labels={labels} onEdit={openEdit} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{AUTHORING_COPY.empty}</p>
          )}
        </section>
      )}
    </main>
  );
}
