"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel after What happened (founder lock 2026-10-06, flow steps  */
/*  6 to 13): the reads and the writes behind CoachAnswerScreens.            */
/*                                                                            */
/*  BLIND COACH: every read here is about a moment this coach has rated: the  */
/*  reducer reaches none of these screens before the rating is saved, and the */
/*  backend answers 409 before it anyway.                                     */
/*                                                                            */
/*    the diagnosis   GET/PUT …/snippets/:snip/diagnosis (D-CP-4)             */
/*    the cure        the served exercise (GET …/exercise-preference), the    */
/*                    library's exercises that treat the diagnosed error     */
/*                    (GET /coach/exercises); Keep it and Use this one answer */
/*                    the request with that exercise, shared, and record the  */
/*                    coach's preference (kept, swapped, new)                 */
/*    the words       the request's draft, edited with the pencil             */
/*    the video       recorded in the panel; kept per moment until shared    */
/*    Ready for {p}   an exercise with its video joins the library under the */
/*                    diagnosed error; anything else goes to the speaker in   */
/*                    words (plus the video), never stuck (lock flow 9)       */
/*    the Take word   GET …/word, else its draft; PUT …/word with the video   */
/*                    from POST …/video                                       */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react";
import {
  DecideScreen, DetailScreen, DiagnoseScreen, KindScreen, NameErrorScreen, ShareScreen, SummaryScreen,
  SwapScreen, TakeVideoScreen, TakeWordScreen, VideoScreen, WordsScreen, decideRows,
} from "./CoachAnswerScreens";
import CoachWords from "./CoachWords";
import type { WalkNav } from "../walk/WalkOverlay";
import { useCoachVideoRecorder, type CoachVideoRecorder } from "@/hooks/useCoachVideoRecorder";
import {
  momentOf, type MomentScreen, type PanelAction, type PanelState, type TakeScreen,
} from "@/lib/willab/coachPanel";
import {
  afterVideo, answerHome, kindQuestion, momentExerciseDraft, shareNote, sharesWithLibrary, wordsTitle, yourAnswerWords,
  type AnswerHome,
} from "@/lib/willab/coachAnswer";
import type { MomentKind } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { answerCoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import { listCoachExercises, saveCoachExerciseWithVideo, type CoachExercise } from "@/services/api/coachExercises";
import {
  draftTakeWord, fetchDiagnosis, fetchExercisePreference, recordExercisePreference, saveDiagnosis,
  type DiagnosisInput, type DiagnosisView, type ErrorChoice, type ExercisePreferenceView,
} from "@/services/api/coachPanel";
import {
  answerInWords, draftForRequest, fetchTakeWord, saveTakeWord, uploadAnswerVideo, type MomentRead,
} from "@/services/api/coachWalk";
import { uploadCoachVideo } from "@/services/api/coachReview";
import { newUploadKey, videoProvenance } from "@/services/api/coachVideoMeta";

type Kept = { file: File; url: string };

/** What the coach has made of one moment so far, on this visit. */
type Work = {
  words?: string;
  drafting?: boolean;
  kindPick?: string | null;
  kindSkipped?: boolean;
  video?: Kept | null;
  swapPick?: string | null;
  name?: string;
};

type TakeWork = { text?: string; loading?: boolean };

/** Screens that read the diagnosis, and those that read the cure. */
const DIAGNOSIS_KEYS = new Set(["diagnose", "nameerr", "decide", "swap", "exdetail", "words", "video", "share", "summary"]);
const CURE_KEYS = new Set(["decide", "swap", "exdetail", "summary"]);

export type AnswerContext = {
  state: PanelState;
  dispatch: Dispatch<PanelAction>;
  /** The moment reads, after the rating only. */
  reads: Record<string, MomentRead | null>;
  /** Forget a moment's read so its next screen reads it fresh. */
  reread: (snippetId: string) => void;
  say: (text: string) => void;
  navFor: (screen: MomentScreen) => WalkNav;
  /** The passage on its player, for a moment screen. */
  playerFor: (screen: MomentScreen, passage: string) => ReactNode;
  /** The slide, the passage on its player and the lines, for Summary. */
  summaryBody: (screen: MomentScreen, extra: { label: string; value: string } | null) => ReactNode;
  close: () => void;
};

function useLibrary(wanted: boolean) {
  const [library, setLibrary] = useState<CoachExercise[] | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!wanted || asked.current) return;
    asked.current = true;
    void listCoachExercises().then((r) => setLibrary(r.ok ? r.data.exercises : []));
  }, [wanted]);
  return library;
}

/** Ids in a random order, the same each time this moment is drawn. */
function useShuffled() {
  const orders = useRef(new Map<string, string[]>());
  return (key: string, ids: string[]): string[] => {
    const known = orders.current.get(key);
    if (known && known.length === ids.length && ids.every((i) => known.includes(i))) return known;
    const next = [...ids].sort(() => Math.random() - 0.5);
    orders.current.set(key, next);
    return next;
  };
}

type Ids = { key: string; id: string | null; sid: string | null; kind: MomentKind | null };

/** The diagnosis and the served exercise of the moment on screen, read once
 *  each, only on the screens that show them. */
function useMomentData({ key, id, sid, kind }: Ids) {
  const [diag, setDiag] = useState<Record<string, DiagnosisView | null>>({});
  const [pref, setPref] = useState<Record<string, ExercisePreferenceView | null>>({});
  const error = kind === "error" && id !== null && sid !== null;
  const needsDiagnosis = error && DIAGNOSIS_KEYS.has(key) && !(id in diag);
  useEffect(() => {
    if (!needsDiagnosis || !id || !sid) return;
    void fetchDiagnosis(sid, id).then((view) => setDiag((all) => ({ ...all, [id]: view })));
  }, [needsDiagnosis, id, sid]);
  const needsCure = error && CURE_KEYS.has(key) && !(id in pref);
  useEffect(() => {
    if (!needsCure || !id || !sid) return;
    void fetchExercisePreference(sid, id).then((view) => setPref((all) => ({ ...all, [id]: view })));
  }, [needsCure, id, sid]);
  const library = useLibrary(error && CURE_KEYS.has(key));
  return { diag, setDiag, pref, library };
}

/** What the cure offers for a diagnosis: the library's exercises for the
 *  diagnosed error, the served one among them, and the names. Pure. */
export function cureOf(input: {
  view: DiagnosisView | null | undefined;
  served: ExercisePreferenceView | null | undefined;
  library: readonly CoachExercise[] | null;
  name: string | undefined;
}) {
  const diagnosis = input.view?.current ?? null;
  const errors = input.view?.errors ?? [];
  const errorId = diagnosis?.kind === "error" ? diagnosis.id : null;
  const label = errors.find((e) => diagnosis?.kind !== "no_error" && e.id === diagnosis?.id)?.label;
  const library = input.library ?? [];
  const matches = errorId ? library.filter((e) => e.active && e.acousticProblemTags.includes(errorId)) : [];
  const servedId = input.served?.served.exerciseId ?? null;
  const servedTitle = input.served?.served.title ?? null;
  return {
    diagnosis,
    errors,
    errorId,
    errorLabel: label ?? input.name ?? "",
    named: diagnosis?.kind === "named_error",
    matches,
    servedId,
    served: matches.find((e) => e.exerciseId === servedId) ?? null,
    titleOf: (exerciseId: string): string | null =>
      library.find((e) => e.exerciseId === exerciseId)?.title ?? (exerciseId === servedId ? servedTitle : null),
  };
}

/** The words open on the request's draft; a note, and a draft that did not
 *  come, open on an empty field, already editing. The Take's word opens on
 *  the word already saved, else its draft. */
function useDrafts(ids: Ids, home: AnswerHome | null, work: Record<string, Work>, patch: (id: string, next: Partial<Work>) => void,
  startEditing: () => void) {
  const { key, id, sid } = ids;
  const w = (id && work[id]) || {};
  const needsDraft = key === "words" && id !== null && w.words === undefined && !w.drafting && home !== null;
  const draft = useRef({ patch, startEditing });
  draft.current = { patch, startEditing };
  useEffect(() => {
    if (!needsDraft || !id || !sid) return;
    const { patch: set, startEditing: edit } = draft.current;
    if (home === "note") { set(id, { words: "" }); edit(); return; }
    set(id, { drafting: true });
    void draftForRequest(sid, id).then((d) => {
      draft.current.patch(id, { words: d?.text ?? "", drafting: false });
      if (!d) draft.current.startEditing();
    });
  }, [needsDraft, id, sid, home]);

  const [takeWork, setTakeWork] = useState<Record<string, TakeWork>>({});
  const tw: TakeWork = (sid && takeWork[sid]) || {};
  const needsTakeWord = key === "takeword" && sid !== null && tw.text === undefined && !tw.loading;
  useEffect(() => {
    if (!needsTakeWord || !sid) return;
    setTakeWork((all) => ({ ...all, [sid]: { loading: true } }));
    void fetchTakeWord(sid).then(async (word) => {
      const text = word?.text ?? (await draftTakeWord(sid))?.text ?? "";
      setTakeWork((all) => ({ ...all, [sid]: { text } }));
      if (!text) draft.current.startEditing();
    });
  }, [needsTakeWord, sid]);
  return { takeWork, setTakeWork };
}

/** A new screen: not editing, no old sentence; the camera stays only on the
 *  video screens. */
function useScreenReset(stageKey: string, recorder: CoachVideoRecorder, reset: () => void) {
  const live = useRef({ recorder, reset });
  live.current = { recorder, reset };
  useEffect(() => {
    live.current.reset();
    const r = live.current.recorder;
    if (!stageKey.startsWith("video:") && !stageKey.startsWith("takevideo:") && r.state.status !== "idle") r.reset();
  }, [stageKey]);
}

export function useAnswerFlow(ctx: AnswerContext) {
  const { state, dispatch, reads } = ctx;
  const screen = state.screen;
  const id = momentOf(screen)?.snippetId ?? null;
  const sid = "take" in screen ? screen.take.sessionId : null;
  const read = id ? reads[id] : undefined;
  const kind: MomentKind | null = read?.request?.kind ?? null;
  const ids: Ids = { key: screen.key, id, sid, kind };

  const [work, setWork] = useState<Record<string, Work>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const recorder = useCoachVideoRecorder();
  const shuffled = useShuffled();
  const { diag, setDiag, pref, library } = useMomentData(ids);

  const patch = (snippetId: string, next: Partial<Work>) =>
    setWork((all) => ({ ...all, [snippetId]: { ...all[snippetId], ...next } }));
  useScreenReset(`${screen.key}:${id ?? sid ?? ""}`, recorder, () => { setEditing(false); setFail(null); });

  const w: Work = (id && work[id]) || {};
  const cure = cureOf({ view: id ? diag[id] : null, served: id ? pref[id] : null, library, name: w.name });
  const { diagnosis, errors, errorLabel, named, matches, servedId, served, titleOf } = cure;
  const home: AnswerHome | null = kind ? answerHome(kind, diagnosis) : null;
  const { takeWork, setTakeWork } = useDrafts(ids, home, work, patch, () => setEditing(true));
  const view = id ? pref[id] ?? null : null;

  /* ── the writes ── */

  async function run(write: () => Promise<string | null>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFail(null);
    const error = await write();
    setBusy(false);
    if (error) setFail(error);
    return error === null;
  }

  async function diagnose(input: DiagnosisInput): Promise<void> {
    if (!id || !sid) return;
    const ok = await run(async () => {
      const saved = await saveDiagnosis(sid, id, input);
      if (!saved.ok) return saved.message;
      setDiag((all) => {
        const before = all[id] ?? { errors: [], current: null };
        const extra: ErrorChoice[] = saved.current?.kind === "named_error" && saved.current.id && "newName" in input
          && !before.errors.some((e) => e.id === saved.current?.id)
          ? [{ kind: "named_error", id: saved.current.id, label: input.newName, machineHeard: false }] : [];
        return { ...all, [id]: { errors: [...before.errors, ...extra], current: saved.current } };
      });
      return null;
    });
    if (ok) dispatch({ type: "step", key: "decide" });
  }

  function preference(action: "kept" | "swapped" | "new", chosen?: string): void {
    if (id && sid && view) void recordExercisePreference(sid, id, { action, chosenExerciseId: chosen ?? null });
  }

  /** Keep it, or Use this one: the request answered with that exercise. */
  async function choose(exerciseId: string): Promise<void> {
    if (!id || !sid) return;
    const how = exerciseId === servedId ? "kept" : "swapped";
    const ok = await run(async () => {
      const r = await answerCoachExerciseRequest(sid, id, { resolution: "exercise_chosen", exerciseId, share: true });
      return r.ok ? null : r.message;
    });
    if (!ok) return;
    preference(how, how === "swapped" ? exerciseId : undefined);
    finish(how === "kept" ? COPY.kept : COPY.swapped);
  }

  async function nothing(): Promise<void> {
    if (!id || !sid) return;
    const ok = await run(async () => {
      const r = await answerCoachExerciseRequest(sid, id, { resolution: "no_safe_match" });
      return r.ok ? null : r.message;
    });
    if (ok) finish(COPY.toastNothingToAdd);
  }

  function finish(toast: string): void {
    if (!id) return;
    ctx.reread(id);
    ctx.say(toast);
    dispatch({ type: "finish" });
  }

  async function share(withLibrary: boolean, pseudonym: string): Promise<void> {
    const request = read?.request;
    if (!id || !sid || !request || !home) return;
    const text = (w.words ?? "").trim();
    const video = w.video ?? null;
    const errorId = diagnosis?.kind === "error" ? diagnosis.id : null;
    const ok = await run(async () => {
      if (home === "exercise" && withLibrary && video && errorId) {
        const saved = await saveCoachExerciseWithVideo(momentExerciseDraft(request.id, errorId, text), video.file);
        if (!saved.ok) return saved.message;
        const r = await answerCoachExerciseRequest(sid, id, {
          resolution: "exercise_chosen", exerciseId: saved.data.exercise.exerciseId, share: true,
        });
        return r.ok ? null : r.message;
      }
      if (video) {
        const up = await uploadAnswerVideo(sid, id, video.file);
        if (!up.ok) return up.message;
      }
      const r = await answerInWords(sid, id, {
        resolution: home === "line" ? "line_written" : home === "version" ? "version_written" : "note_written",
        answerText: text,
        share: true,
        fileInCatalogue: home === "line" ? withLibrary : undefined,
        patternKey: w.kindSkipped ? null : w.kindPick ?? null,
      });
      return r.ok ? null : r.message;
    });
    if (ok) finish(withLibrary ? COPY.toastShared(pseudonym) : COPY.toastSharedOnly(pseudonym));
  }

  async function sendTakeWord(take: TakeScreen): Promise<void> {
    const sessionId = take.take.sessionId;
    const text = (takeWork[sessionId]?.text ?? "").trim();
    const file = recorder.state.status === "stopped" ? recorder.state.file : null;
    const ok = await run(async () => {
      let videoRef: string | null = null;
      if (file) {
        videoRef = await uploadCoachVideo(sessionId, file, {
          idempotencyKey: newUploadKey(), ...videoProvenance("coach-walk"), durationSec: null,
        });
        if (!videoRef) return COPY.answerFail;
      }
      const saved = await saveTakeWord(sessionId, { text, videoRef, share: true });
      return saved.ok ? null : saved.message;
    });
    if (!ok) return;
    ctx.say(COPY.toastWordSent(take.speaker.pseudonym));
    ctx.close();
  }

  function keepVideo(onward: () => void): void {
    if (id && recorder.state.status === "stopped") {
      patch(id, { video: { file: recorder.state.file, url: URL.createObjectURL(recorder.state.file) } });
      recorder.reset();
    }
    onward();
  }

  const afterTheVideo = () => dispatch({ type: "step", key: home ? afterVideo(home) : "share" });

  /* ── the screens ── */

  /** What every moment screen is drawn with. */
  type Drawn = { panel: MomentScreen; nav: WalkNav; p: string; passage: string; fail: string | null; live: boolean };

  const screens: Record<string, (d: Drawn) => ReactNode> = {
    diagnose: ({ nav, fail: shown }) => (
      <DiagnoseScreen nav={nav} onClose={ctx.close} errors={id && id in diag ? errors : null}
        picked={diagnosis?.kind === "no_error" ? null : diagnosis?.id ?? null} noError={diagnosis?.kind === "no_error"}
        busy={busy} fail={shown}
        onPick={(e) => void diagnose(e.kind === "error" ? { errorId: e.id } : { newName: e.label })}
        onName={() => dispatch({ type: "step", key: "nameerr" })}
        onNoError={() => void diagnose({ noError: true })} />
    ),
    nameerr: ({ nav, p, fail: shown }) => (
      <NameErrorScreen nav={nav} onClose={ctx.close} pseudonym={p} value={w.name ?? ""} busy={busy} fail={shown}
        onChange={(name) => { if (id) patch(id, { name }); }}
        onNext={() => void diagnose({ newName: (w.name ?? "").trim() })} />
    ),
    decide: ({ nav, fail: shown }) => renderDecide(nav, shown),
    swap: ({ nav, fail: shown }) => {
      const order = shuffled(id ?? "", matches.map((e) => e.exerciseId));
      const items = order.map((x) => ({ id: x, title: titleOf(x) ?? x, served: x === servedId }));
      const picked = w.swapPick ?? items[0]?.id ?? null;
      return (
        <SwapScreen nav={nav} onClose={ctx.close} errorLabel={errorLabel} items={items} picked={picked} busy={busy} fail={shown}
          onPick={(x) => { if (id) patch(id, { swapPick: x }); }}
          onDetails={(x) => dispatch({ type: "step", key: "exdetail", exerciseId: x })}
          onUse={() => { if (picked) void choose(picked); }}
          onNew={() => { preference("new"); dispatch({ type: "step", key: "words" }); }} />
      );
    },
    exdetail: ({ panel, nav, fail: shown }) => {
      const exercise = (library ?? []).find((e) => e.exerciseId === panel.exerciseId);
      return (
        <DetailScreen nav={nav} onClose={ctx.close} title={exercise?.title ?? ""} errorLabel={errorLabel}
          videoUrl={exercise?.explanationVideoUrl ?? null} instruction={exercise?.instruction ?? ""} busy={busy} fail={shown}
          onUse={() => { if (exercise) void choose(exercise.exerciseId); }}
          onBackToList={() => dispatch({ type: "back" })} />
      );
    },
    words: ({ panel, nav, p, passage, live }) => (
      <WordsScreen nav={nav} onClose={ctx.close} title={home ? wordsTitle(home) : ""} pseudonym={p}
        player={ctx.playerFor(panel, passage)} clearer={home === "version"} text={w.words ?? ""}
        editing={live && editing} drafting={w.words === undefined}
        onChange={(words) => { if (id) patch(id, { words }); }} onToggle={() => setEditing((e) => !e)}
        onNext={() => dispatch({ type: "step", key: "video" })} />
    ),
    video: ({ nav }) => (
      <VideoScreen nav={nav} onClose={ctx.close} isError={home === "exercise"} recorder={recorder}
        keptUrl={w.video?.url ?? null} busy={busy}
        onKeep={() => keepVideo(afterTheVideo)}
        onSkip={() => { if (id) patch(id, { video: null }); afterTheVideo(); }}
        onRecordAgain={() => { if (id) patch(id, { video: null }); recorder.reset(); void recorder.start(); }} />
    ),
    kind: ({ nav, p }) => {
      const q = kindQuestion(home ?? "line", p);
      return (
        <KindScreen nav={nav} onClose={ctx.close} title={q.title} options={q.options} picked={w.kindPick ?? null}
          onPick={(k) => { if (id) patch(id, { kindPick: k }); }}
          onNext={() => { if (id) patch(id, { kindSkipped: false }); dispatch({ type: "step", key: "share" }); }}
          onSkip={() => { if (id) patch(id, { kindSkipped: true, kindPick: null }); dispatch({ type: "step", key: "share" }); }} />
      );
    },
    share: ({ panel, nav, p, passage, fail: shown }) => {
      const video = Boolean(w.video);
      const withLibrary = home ? sharesWithLibrary({ home, video, kindSkipped: Boolean(w.kindSkipped), named }) : false;
      return (
        <ShareScreen nav={nav} onClose={ctx.close} pseudonym={p} player={ctx.playerFor(panel, passage)} clearer={home === "version"}
          text={(w.words ?? "").trim()} videoUrl={w.video?.url ?? null} note={home ? shareNote(home, video, p) : null}
          withLibrary={withLibrary} busy={busy} fail={shown}
          onShare={() => void share(withLibrary, p)} onShareWithoutLibrary={() => void share(false, p)} />
      );
    },
    summary: ({ panel, nav }) => {
      const answer = read ? yourAnswerWords(read.request, servedId, titleOf) : null;
      return (
        <SummaryScreen nav={nav} onClose={ctx.close} ready={Boolean(read)}
          onNext={() => dispatch({ type: "onward" })}
          onChange={() => dispatch({ type: "changeAnswer", to: kind === "error" && !diagnosis ? "diagnose" : "decide" })}>
          {ctx.summaryBody(panel, answer ? { label: COPY.yourAnswer, value: answer } : null)}
        </SummaryScreen>
      );
    },
  };

  function renderMoment(panel: MomentScreen, live: boolean): ReactNode {
    const draw = screens[panel.key];
    if (!draw) return null;
    return draw({
      panel, nav: ctx.navFor(panel), p: panel.speaker.pseudonym, passage: read?.passage ?? "", fail: live ? fail : null, live,
    });
  }

  function renderDecide(nav: WalkNav, shownFail: string | null): ReactNode {
    const asError = home === "exercise";
    const loading = !read || (asError && (!(id && id in pref) || library === null));
    const rows = decideRows({
      asError, kind: kind ?? "ambiguity",
      served: served ? { id: served.exerciseId, title: served.title } : null,
      others: matches.filter((e) => e.exerciseId !== servedId).length,
      errorLabel,
      onDetails: (x) => dispatch({ type: "step", key: "exdetail", exerciseId: x }),
    });
    return (
      <DecideScreen nav={nav} onClose={ctx.close} asError={asError} rows={rows} loading={loading} busy={busy} fail={shownFail}
        onPick={(v) => {
          if (v === "keep" && served) void choose(served.exerciseId);
          else if (v === "swap") dispatch({ type: "step", key: "swap" });
          else if (v === "nothing") void nothing();
          else {
            if (v === "new") preference("new");
            dispatch({ type: "step", key: "words" });
          }
        }} />
    );
  }

  function renderTake(panel: TakeScreen, live: boolean): ReactNode {
    const sessionId = panel.take.sessionId;
    const t = takeWork[sessionId] ?? {};
    const p = panel.speaker.pseudonym;
    const where = `${p} · ${COPY.take(panel.take.takeIndex)}`;
    const setText = (text: string) => setTakeWork((all) => ({ ...all, [sessionId]: { ...all[sessionId], text } }));
    const back = () => dispatch({ type: "back" });
    const isEditing = live && editing;
    if (panel.key === "takeword") {
      return (
        <TakeWordScreen where={where} onBack={back} onClose={ctx.close} pseudonym={p} text={t.text ?? ""}
          editing={isEditing} loading={t.text === undefined} onChange={setText} onToggle={() => setEditing((e) => !e)}
          onNext={() => dispatch({ type: "takeVideo" })} onSkip={ctx.close} />
      );
    }
    return (
      <TakeVideoScreen where={where} onBack={back} onClose={ctx.close} pseudonym={p} recorder={recorder}
        busy={busy} fail={live ? fail : null} onSend={() => void sendTakeWord(panel)}
        onRecordAgain={() => { recorder.reset(); void recorder.start(); }}
        words={<CoachWords text={t.text ?? ""} editing={isEditing} onChange={setText} onToggle={() => setEditing((e) => !e)} />} />
    );
  }

  return { renderMoment, renderTake };
}
