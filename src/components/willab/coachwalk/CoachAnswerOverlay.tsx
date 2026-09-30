"use client";

/* -------------------------------------------------------------------------- */
/*  The one answer: Words → Video → Home (founder 2026-09-30, A3 to A6; build   */
/*  plan P2-11). One component for every kind, in a moment or in the library. */
/*                                                                            */
/*  What it writes, by home:                                                   */
/*    exercise  the video is saved through the exercise upload seam under the  */
/*              request's id (a new library exercise, main target required),   */
/*              then the request resolves as that exercise, shared or not;     */
/*              without the library the words go as a note                     */
/*    line      line_written (+ the video) with the coach's pattern, filed in   */
/*              the catalogue unless kept to the speaker                       */
/*    version   version_written (+ the video) with the move for the record     */
/*    note      note_written (+ the video)                                     */
/*  In the library (no moment) an exercise saves through the same seam and a  */
/*  line or a move is a new catalogue version. The model draft comes from the  */
/*  request in a moment; the library drafts nothing yet (the past finals are  */
/*  shown for the pattern instead).                                           */
/* -------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import CoachWordsSheet, { type DraftState } from "./CoachWordsSheet";
import CoachVideoSheet, { type KeptVideo } from "./CoachVideoSheet";
import CoachHomeSheet, { type PatternOption } from "./CoachHomeSheet";
import type { Pager } from "../feedbackPager";
import {
  answerPlan, answerSteps, exerciseIdFor, homeDefaults, homeProblem, slugFor, type HomeState,
} from "@/lib/willab/coachAnswer";
import type { MomentKind } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";
import {
  addCatalogueLine, answerInWords, draftForRequest, uploadAnswerVideo,
} from "@/services/api/coachWalk";
import { answerCoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import { saveCoachExerciseWithVideo, type CoachExerciseDraft } from "@/services/api/coachExercises";

export interface AnswerMoment {
  sessionId: string;
  snippetId: string;
  requestId: string;
  pseudonym: string;
  passage: string;
  spotted: { errorId: string; label: string }[];
}

export type AnswerOutcome = "shared_library" | "shared" | "library";

export interface AnswerContext {
  /** In a moment; null in the library. */
  moment: AnswerMoment | null;
  /** The pattern chosen on the library's Pattern screen (no moment). */
  patternKey?: string | null;
  errors: PatternOption[];
  cues: PatternOption[];
  /** Past finals for the pattern, shown as the library's draft. */
  pastFinal?: string | null;
}

function exerciseDraft(home: HomeState, words: string, exerciseId: string,
  draft: DraftState): CoachExerciseDraft {
  return {
    exerciseId,
    title: home.name.trim(),
    instruction: words.trim(),
    introductionCopy: "",
    acousticProblemTags: [home.mainTarget!, ...home.alsoTreats.filter((t) => t !== home.mainTarget)],
    mainTarget: home.mainTarget,
    matchingCriteria: null,
    explanationVideoUrl: "",
    active: true,
    aiDraftText: draft.status === "drafted" ? draft.text : null,
    aiDraftModelVersion: null,
  };
}

export default function CoachAnswerOverlay({
  kind,
  context,
  baseIndex,
  baseTotal,
  onClose,
  onDone,
}: {
  kind: MomentKind;
  context: AnswerContext;
  /** Where the answer's screens sit in the walk's bar (after Judge and Read). */
  baseIndex: number;
  baseTotal: number;
  onClose: () => void;
  onDone: (outcome: AnswerOutcome) => void;
}) {
  const plan = useMemo(() => answerPlan(kind), [kind]);
  const steps = useMemo(() => answerSteps(plan), [plan]);
  const [step, setStep] = useState(0);
  const [words, setWords] = useState("");
  const [draft, setDraft] = useState<DraftState>(
    context.moment && plan.draftSurface ? { status: "drafting" }
      : context.pastFinal ? { status: "drafted", text: context.pastFinal } : { status: "none" },
  );
  const [video, setVideo] = useState<KeptVideo | null>(null);
  const [home, setHome] = useState<HomeState>(() => {
    const base = homeDefaults(plan, context.moment?.spotted ?? []);
    if (!context.moment && context.patternKey) {
      return plan.pattern === "error"
        ? { ...base, mainTarget: context.patternKey }
        : { ...base, patternKey: context.patternKey };
    }
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moment = context.moment;

  const momentKey = moment ? `${moment.sessionId}:${moment.snippetId}` : null;
  useEffect(() => {
    if (!moment || !plan.draftSurface) return;
    let cancelled = false;
    void draftForRequest(moment.sessionId, moment.snippetId).then((result) => {
      if (cancelled) return;
      setDraft(result ? { status: "drafted", text: result.text } : { status: "none" });
    });
    return () => { cancelled = true; };
    // One draft per moment: keyed on the moment's ids, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentKey, plan.draftSurface]);

  const pager: Pager = {
    index: baseIndex + step,
    total: baseTotal,
    label: moment?.pseudonym ?? COPY.pillNew,
    onBack: () => (step === 0 ? onClose() : setStep((s) => s - 1)),
    onNext: () => setStep((s) => Math.min(steps.length - 1, s + 1)),
  };

  async function finish(libraryWanted: boolean, shareWanted: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await write(libraryWanted, shareWanted);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone(result.outcome);
  }

  async function write(libraryWanted: boolean, shareWanted: boolean):
    Promise<{ ok: true; outcome: AnswerOutcome } | { ok: false; message: string }> {
    // An exercise with a home in the library: the upload seam creates it.
    if (plan.home === "exercise" && libraryWanted) {
      if (!video) return { ok: false, message: COPY.homeNeedsVideo };
      const exerciseId = moment ? exerciseIdFor(moment.requestId) : slugFor(home.name);
      const saved = await saveCoachExerciseWithVideo(exerciseDraft(home, words, exerciseId, draft), video.file);
      if (!saved.ok) return { ok: false, message: saved.message };
      if (!moment) return { ok: true, outcome: "library" };
      const resolved = await answerCoachExerciseRequest(moment.sessionId, moment.snippetId, {
        resolution: "exercise_chosen", exerciseId: saved.data.exercise.exerciseId, share: shareWanted,
      });
      if (!resolved.ok) return { ok: false, message: resolved.message };
      return { ok: true, outcome: shareWanted ? "shared_library" : "library" };
    }
    // Words (and maybe a video) for the speaker.
    if (moment) {
      if (video) {
        const up = await uploadAnswerVideo(moment.sessionId, moment.snippetId, video.file);
        if (!up.ok) return { ok: false, message: up.message };
      }
      const resolution = plan.home === "line" ? "line_written"
        : plan.home === "version" ? "version_written" : "note_written";
      const filed = plan.home === "line" && libraryWanted && !home.keepToSpeaker;
      const result = await answerInWords(moment.sessionId, moment.snippetId, {
        resolution, answerText: words.trim(), share: true,
        fileInCatalogue: plan.home === "line" ? filed : undefined,
        patternKey: home.patternKey,
      });
      if (!result.ok) return { ok: false, message: result.message };
      return { ok: true, outcome: filed ? "shared_library" : "shared" };
    }
    // The library alone: a line or a move is a new catalogue version.
    const lane = plan.home === "line" ? "praise" : "rewrite";
    const key = home.patternKey ?? "confident_read";
    const kindOf = lane === "rewrite" ? "move" : key === "confident_read" ? "read" : "cue";
    const line = await addCatalogueLine({ lane, patternKind: kindOf, patternKey: key, text: words.trim() });
    if (!line.ok) return { ok: false, message: line.message };
    return { ok: true, outcome: "library" };
  }

  const current = steps[step];
  if (current === "words") {
    return (
      <CoachWordsSheet
        plan={plan} pager={pager} pseudonym={moment?.pseudonym ?? ""} passage={moment?.passage ?? ""}
        draft={draft} value={words} onChange={setWords} onClose={onClose} onNext={pager.onNext}
      />
    );
  }
  if (current === "video") {
    const last = step === steps.length - 1;
    return (
      <CoachVideoSheet
        pager={pager} videoDefault={plan.videoDefault} kept={video}
        onKeep={setVideo} onDiscard={() => setVideo(null)} onClose={onClose}
        onNext={last ? () => void finish(false, true) : pager.onNext}
      />
    );
  }
  const libraryWanted = plan.home === "exercise" ? true : plan.home === "line";
  return (
    <CoachHomeSheet
      plan={plan} pager={pager} pseudonym={moment?.pseudonym ?? null}
      errors={context.errors} cues={context.cues} home={home} onChange={setHome}
      problem={homeProblem(plan, home, video !== null, plan.home === "exercise")}
      busy={busy} error={error} onClose={onClose}
      onPrimary={() => void finish(libraryWanted, true)}
      onSecondary={() => void finish(plan.home === "exercise", plan.home !== "exercise")}
    />
  );
}
