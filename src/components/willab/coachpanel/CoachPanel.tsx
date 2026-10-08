"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — P1's host (founder lock 2026-10-06, flow steps  */
/*  2 to 5; build plan P1).                                                    */
/*                                                                            */
/*  Draws the reducer's screen (lib/willab/coachPanel.ts) on the walk's stage, */
/*  with the walk's motion, and does the panel's reads and its one write:      */
/*                                                                            */
/*    the clips      GET /v2/coach/sessions/:sid, once per Take opened (the   */
/*                   player needs them; their words are never kept)          */
/*    the rating     saveStateRating, exactly as today's Judge sheet saves    */
/*                   it, with the confidence chain's echo                     */
/*    What happened  fetchMomentRead, ONLY once the screen is What happened,  */
/*                   which the reducer reaches only for a rated moment.       */
/*                   Never prefetched (BLIND COACH).                          */
/*    blind lines    the error audit and the block pick, read when the queue  */
/*                   opens; drawn only when the backend serves them           */
/*    all speakers   GET /v2/coach/speakers, read each time Your speakers    */
/*                   opens (D-CP-12): pseudonyms, goals and counts, never a  */
/*                   moment                                                   */
/*    the corpus     GET /v2/coach/training-imports each time Training       */
/*                   corpus opens (D-CP-20); POST an import (then the         */
/*                   loader until the backend says ready or failed); PUT an  */
/*                   import's set-up; its moments judged blind by            */
/*                   CoachCorpusJudge. While the backend's switch is off the */
/*                   import is refused (410) and its sentence shows under    */
/*                   the pill; the list draws its empty state.               */
/*                                                                            */
/*  The leaving copy of a screen (the stage's ghost) is drawn without its     */
/*  hooks, so a Judge screen on its way out never asks for a second render    */
/*  receipt.                                                                  */
/* -------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import WalkStage from "../walk/WalkStage";
import WalkToast from "../walk/WalkToast";
import type { WalkNav } from "../walk/WalkOverlay";
import { CoachAuditSheet, CoachBlockPickSheet } from "../coachwalk/CoachBlindSheet";
import { useConfidenceChainReceipt } from "../coachwalk/useConfidenceChainReceipt";
import { JudgeScreen, QueueScreen, RevealScreen, SpeakerScreen, SpeakersScreen, type PanelClip } from "./CoachPanelScreens";
import { BLANK_IMPORT, CorpusAnalyseScreen, CorpusHomeScreen, CorpusImportScreen, type ImportForm } from "./CoachCorpusScreens";
import CoachCorpusJudge from "./CoachCorpusJudge";
import {
  momentOf, walkScreenOf, type MomentScreen, type PanelAction, type PanelScreen, type PanelState,
} from "@/lib/willab/coachPanel";
import { readSlideFor, type AnswerValue, type QueueSpeaker, type ReadSlide } from "@/lib/willab/coachWalk";
import type { WalkScreen } from "@/lib/willab/walkMotion";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { fetchCoachReviewSession } from "@/services/api/coachReview";
import { fetchMomentRead, type MomentRead } from "@/services/api/coachWalk";
import { buildRatingBody, saveStateRating } from "@/services/api/stateRatings";
import { fetchBlockPicks, fetchErrorAudit, type BlockPickQueue, type ErrorAuditQueue } from "@/services/api/coachPanel";
import {
  fetchCoachSpeakers, queueSpeakerFor, speakersFromQueue, type PanelSpeaker,
} from "@/services/api/coachSpeakers";
import {
  fetchBlindConfidenceQueue, fetchTrainingImports, importTrainingAudio, saveImportSetup, type TrainingImport,
} from "@/services/api/trainingCorpus";

type StageScreen = WalkScreen & { panel: PanelScreen };
type TakeMedia = { clips: Record<string, PanelClip>; slides: Record<string, ReadSlide> };

/** The clip and the slide of every moment of the open Take. The words the
 *  session carries are not kept: the Judge screen must not have them. */
function useTakeMedia(sessionId: string | null): Record<string, TakeMedia> {
  const [media, setMedia] = useState<Record<string, TakeMedia>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!sessionId || asked.current.has(sessionId)) return;
    asked.current.add(sessionId);
    void fetchCoachReviewSession(sessionId).then((session) => {
      if (!session) return;
      const clips: Record<string, PanelClip> = {};
      const slides: Record<string, ReadSlide> = {};
      for (const s of session.snippets) {
        clips[s.id] = { src: s.audioRef, startOffsetMs: s.startOffsetMs, durationMs: s.durationMs };
        const picture = readSlideFor(session.presentationRef, s.slide);
        if (picture) slides[s.id] = picture;
      }
      setMedia((prev) => ({ ...prev, [sessionId]: { clips, slides } }));
    });
  }, [sessionId]);
  return media;
}

/** What happened's read, asked for only while What happened is on screen. */
function useRevealRead(screen: PanelScreen): Record<string, MomentRead | null> {
  const [reads, setReads] = useState<Record<string, MomentRead | null>>({});
  const reveal = screen.key === "reveal" ? screen : null;
  const sessionId = reveal?.take.sessionId ?? null;
  const snippetId = reveal ? momentOf(reveal)?.snippetId ?? null : null;
  useEffect(() => {
    if (!sessionId || !snippetId) return;
    let cancelled = false;
    void fetchMomentRead(sessionId, snippetId).then((read) => {
      if (!cancelled) setReads((prev) => ({ ...prev, [snippetId]: read }));
    });
    return () => { cancelled = true; };
  }, [sessionId, snippetId]);
  return reads;
}

/** The blind lines, read each time the queue opens; null while dark. */
function useBlindLines(queueOpen: boolean) {
  const [audit, setAudit] = useState<ErrorAuditQueue | null>(null);
  const [picks, setPicks] = useState<BlockPickQueue | null>(null);
  useEffect(() => {
    if (!queueOpen) return;
    let cancelled = false;
    void fetchErrorAudit().then((next) => { if (!cancelled) setAudit(next); });
    void fetchBlockPicks().then((next) => { if (!cancelled) setPicks(next); });
    return () => { cancelled = true; };
  }, [queueOpen]);
  return { audit, picks, setAudit, setPicks };
}

/** Every speaker, read each time Your speakers opens. `failed` when the read
 *  could not be had: the list then draws the queue's own speakers. */
function useAllSpeakers(open: boolean) {
  const [read, setRead] = useState<{ speakers: PanelSpeaker[] | null; done: boolean }>({ speakers: null, done: false });
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRead({ speakers: null, done: false });
    void fetchCoachSpeakers().then((next) => {
      if (!cancelled) setRead({ speakers: next, done: true });
    });
    return () => { cancelled = true; };
  }, [open]);
  return { speakers: read.speakers, loading: open && !read.done, failed: read.done && read.speakers === null };
}

/** The imports, read each time Training corpus opens; null while dark. */
function useImports(open: boolean) {
  const [imports, setImports] = useState<TrainingImport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetchTrainingImports().then((next) => {
      if (cancelled) return;
      setImports(next);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, tick]);
  return { imports, loading, refresh: () => setTick((n) => n + 1) };
}

/** The live Judge screen: the save, and the chain's render receipt. */
function JudgeLive({ screen, nav, clip, onRated, onClose }: {
  screen: MomentScreen;
  nav: WalkNav;
  clip: PanelClip | null;
  onRated: (snippetId: string, value: AnswerValue) => void;
  onClose: () => void;
}) {
  const snippetId = momentOf(screen)?.snippetId ?? "";
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const chain = useConfidenceChainReceipt(snippetId, clip !== null);

  async function answer(value: AnswerValue): Promise<void> {
    const body = buildRatingBody(value);
    if (saving.current || !body) return;
    saving.current = true;
    setError(null);
    const result = await saveStateRating(snippetId, body, chain.current);
    saving.current = false;
    if (!result.ok) {
      setError(result.error ?? COPY.judgeFail);
      setAttempt((n) => n + 1); // the answers come back unfilled
      return;
    }
    onRated(snippetId, value);
  }

  return (
    <JudgeScreen nav={nav} momentId={snippetId} clip={clip} error={error} attempt={attempt}
      onAnswer={(value) => void answer(value)} onClose={onClose} />
  );
}

export type CoachPanelProps = {
  state: PanelState;
  dispatch: Dispatch<PanelAction>;
  speakers: readonly QueueSpeaker[];
  loading: boolean;
  /** What happened's Next: P1 hands the moment to today's answer flow. */
  onHandover: (screen: MomentScreen) => void;
};

function liveSpeaker(speakers: readonly QueueSpeaker[], snapshot: QueueSpeaker): QueueSpeaker {
  const live = speakers.find((s) => s.pseudonym === snapshot.pseudonym);
  if (!live) return snapshot;
  return live.goal == null && snapshot.goal != null ? { ...live, goal: snapshot.goal } : live;
}

export default function CoachPanel({ state, dispatch, speakers, loading, onHandover }: CoachPanelProps) {
  const { screen } = state;
  const stage: StageScreen = useMemo(() => ({ ...walkScreenOf(screen), panel: screen }), [screen]);
  const takeId = screen.key === "judge" || screen.key === "reveal" ? screen.take.sessionId : null;
  const media = useTakeMedia(takeId);
  const reads = useRevealRead(screen);
  const blind = useBlindLines(screen.key === "queue");
  const all = useAllSpeakers(screen.key === "speakers");
  const corpus = useImports(screen.key === "corpushome");
  const [form, setForm] = useState<ImportForm>(BLANK_IMPORT);
  const [corpusBusy, setCorpusBusy] = useState(false);
  const [corpusFail, setCorpusFail] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [blindOpen, setBlindOpen] = useState<"audit" | "picks" | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const close = () => dispatch({ type: "close" });
  const say = (text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));
  const rated = (snippetId: string, value: AnswerValue) => {
    dispatch({ type: "rated", snippetId, value });
    say(COPY.toastJudged);
  };
  /** An import opens its set-up first when that is not finished (CO1 A). */
  function openImport(im: TrainingImport): void {
    setCorpusFail(null);
    if (!im.setupComplete) {
      setForm({ ...BLANK_IMPORT, topic: im.topic, speaker: im.speakerLabel ?? "", language: im.language });
      dispatch({ type: "corpusImport", setupOf: im.sessionId });
      return;
    }
    if (im.state !== "done") return;
    dispatch({ type: "corpusJudge", importId: im.sessionId, topic: im.topic });
  }

  async function submitImport(setupOf: string | null): Promise<void> {
    if (corpusBusy || form.language === null || !form.topic.trim()) return;
    setCorpusBusy(true);
    setCorpusFail(null);
    if (setupOf) {
      // As the prototype: the app's one loader while the set-up saves, then
      // straight to judging with "Set up · {n} moments".
      dispatch({ type: "corpusAnalyse" });
      const topic = form.topic.trim();
      const saved = await saveImportSetup(setupOf, {
        topic, language: form.language, speakerLabel: form.speaker.trim() || null, source: form.source.trim() || null,
      });
      if (!saved.ok) {
        setCorpusBusy(false);
        setCorpusFail(saved.error ?? COPY.answerFail);
        dispatch({ type: "back" });
        return;
      }
      // How many moments wait: the blind read (ids only, never the words).
      const queue = await fetchBlindConfidenceQueue(setupOf);
      setCorpusBusy(false);
      setForm(BLANK_IMPORT);
      corpus.refresh();
      // The queue could not be read: the imports, with no count to claim.
      if (!queue) { dispatch({ type: "corpusHome" }); return; }
      const n = queue.queue.length;
      say(`${COPY.setUp} · ${COPY.moments(n)}`);
      // An import with nothing to judge is never offered for judging.
      dispatch(n > 0 ? { type: "corpusSetUp", importId: setupOf, topic } : { type: "corpusHome" });
      return;
    }
    if (!form.file) { setCorpusBusy(false); return; }
    let accepted = false;
    const outcome = await importTrainingAudio({
      file: form.file, topic: form.topic.trim(), speakerLabel: form.speaker.trim() || null, note: form.source.trim() || null,
      language: form.language, optionalStages: form.stages,
      onAccepted: () => { accepted = true; dispatch({ type: "corpusAnalyse" }); },
    });
    setCorpusBusy(false);
    if (!outcome.ok) {
      // The backend's own sentence (a 410 while its switch is off, a
      // rejected file): under the pill of the screen the coach is on.
      setCorpusFail(outcome.error ?? COPY.answerFail);
      if (accepted) dispatch({ type: "corpusHome" });
      return;
    }
    setForm(BLANK_IMPORT);
    corpus.refresh();
    say(`${COPY.imported} · ${COPY.moments(outcome.queueCount)}`);
    dispatch({ type: "corpusHome" });
  }

  const navFor = (s: MomentScreen): WalkNav => ({
    label: s.speaker.pseudonym,
    index: s.index,
    total: s.take.moments.length,
    onBack: () => dispatch({ type: "back" }),
    onNext: () => dispatch({ type: "next" }),
    backDisabled: state.history.length === 0,
  });

  function render(s: StageScreen) {
    const panel = s.panel;
    const live = panel === screen;
    if (panel.key === "queue") {
      return (
        <QueueScreen speakers={speakers} loading={loading} onClose={close}
          onSpeaker={(speaker) => dispatch({ type: "speaker", speaker })}
          blind={{ audit: blind.audit, picks: blind.picks,
            onOpenAudit: () => setBlindOpen("audit"), onOpenPicks: () => setBlindOpen("picks") }} />
      );
    }
    if (panel.key === "speakers") {
      return (
        <SpeakersScreen speakers={all.failed ? speakersFromQueue(speakers) : all.speakers}
          loading={all.loading || (all.failed && loading)} onClose={close}
          onSpeaker={(speaker) => dispatch({ type: "speaker", speaker: queueSpeakerFor(speaker, speakers) })} />
      );
    }
    if (panel.key === "speaker") {
      const speaker = liveSpeaker(speakers, panel.speaker);
      return (
        <SpeakerScreen speaker={speaker} loading={loading} onClose={close} onBack={() => dispatch({ type: "back" })}
          onTake={(take) => dispatch({ type: "take", speaker, take })} />
      );
    }
    if (panel.key === "lounge") return null;
    if (panel.key === "corpushome") {
      return (
        <CorpusHomeScreen imports={corpus.imports} loading={corpus.loading} fail={live ? corpusFail : null}
          onImport={() => { setCorpusFail(null); setForm(BLANK_IMPORT); dispatch({ type: "corpusImport" }); }}
          onOpen={openImport} onClose={close} />
      );
    }
    if (panel.key === "corpusimport") {
      return (
        <CorpusImportScreen setupOf={panel.setupOf} form={form} busy={corpusBusy} fail={live ? corpusFail : null}
          onChange={setForm} onPickFile={() => fileInput.current?.click()}
          onSubmit={() => void submitImport(panel.setupOf)} onBack={() => dispatch({ type: "back" })} onClose={close} />
      );
    }
    if (panel.key === "corpusanalyse") return <CorpusAnalyseScreen onClose={close} />;
    if (panel.key === "corpus") {
      return live ? (
        <CoachCorpusJudge importId={panel.importId} topic={panel.topic}
          onDone={() => { corpus.refresh(); dispatch({ type: "corpusHome" }); }}
          onBack={() => dispatch({ type: "back" })} onClose={close} />
      ) : (
        <JudgeScreen nav={{ label: panel.topic, index: 0, total: 1, onBack: () => undefined, onNext: () => undefined }}
          momentId={panel.importId} clip={null} error={null} attempt={0} onAnswer={() => undefined} onClose={close} />
      );
    }
    const moment = momentOf(panel);
    if (!moment) return null;
    const nav = navFor(panel);
    const takeMedia = media[panel.take.sessionId];
    const clip = takeMedia?.clips[moment.snippetId] ?? null;
    if (panel.key === "judge") {
      return live ? (
        <JudgeLive screen={panel} nav={nav} clip={clip} onRated={rated} onClose={close} />
      ) : (
        <JudgeScreen nav={nav} momentId={moment.snippetId} clip={clip} error={null} attempt={0}
          onAnswer={() => undefined} onClose={close} />
      );
    }
    return (
      <RevealScreen nav={nav} momentId={moment.snippetId} clip={clip}
        slide={takeMedia?.slides[moment.snippetId] ?? null}
        read={reads[moment.snippetId]} pseudonym={panel.speaker.pseudonym}
        justRated={state.rated[moment.snippetId] ?? null}
        onNext={() => onHandover(panel)} onClose={close} />
    );
  }

  return (
    <>
      <WalkStage screen={stage} dir={state.dir} render={render} />
      <input ref={fileInput} type="file" accept="audio/*,video/mp4" className="hidden" data-testid="corpus-file-input"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; if (f) setForm((prev) => ({ ...prev, file: f })); }} />
      {toast ? <WalkToast key={toast.id} message={toast.text} onDone={() => setToast(null)} /> : null}
      {blindOpen === "audit" && blind.audit ? (
        <CoachAuditSheet queue={blind.audit} onClose={() => setBlindOpen(null)}
          onDone={() => { setBlindOpen(null); blind.setAudit(null); }} />
      ) : null}
      {blindOpen === "picks" && blind.picks ? (
        <CoachBlockPickSheet queue={blind.picks} onClose={() => setBlindOpen(null)}
          onDone={() => { setBlindOpen(null); blind.setPicks(null); }} />
      ) : null}
    </>
  );
}
