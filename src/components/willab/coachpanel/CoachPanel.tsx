"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — its host (founder lock 2026-10-06, flow steps  */
/*  2 to 13).                                                                  */
/*                                                                            */
/*  Draws the reducer's screen (lib/willab/coachPanel.ts) on the walk's stage, */
/*  with the walk's motion, and does the panel's reads and its one write:      */
/*                                                                            */
/*    the clips      GET /v2/coach/sessions/:sid, once per Take opened (the   */
/*                   player needs them; their words are never kept)          */
/*    the rating     saveStateRating, exactly as today's Judge sheet saves    */
/*                   it, with the confidence chain's echo. The tap moves to  */
/*                   What happened at once with the save in flight (C1); a   */
/*                   failed save goes back to Judge with today's error.      */
/*    What happened  the read the saved rating returned (C2), else           */
/*                   fetchMomentRead, ONLY once the screen is past Judge AND */
/*                   the rating's save has succeeded; the loader until       */
/*                   then. Never prefetched (BLIND COACH).                    */
/*    the answer     diagnosis, cure, words, video, Ready for {p}, Summary   */
/*                   and the Take word: CoachAnswerFlow's reads and writes   */
/*    blind lines    the error audit and the block pick, read when the queue  */
/*                   opens; drawn only when the backend serves them           */
/*    the plan       a speaker's plan waiting on the coach (backend N213):   */
/*                   CoachPlanFlow's reads and writes                        */
/*    all speakers   GET /v2/coach/speakers, read each time Your speakers    */
/*                   opens (D-CP-12): pseudonyms, goals and counts, never a  */
/*                   moment. The list draws at once from the queue already   */
/*                   held (the same speakers) and the read refreshes it      */
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

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import WalkStage from "../walk/WalkStage";
import WalkToast from "../walk/WalkToast";
import type { WalkNav } from "../walk/WalkOverlay";
import { CoachAuditSheet, CoachBlockPickSheet, V4MomentPickSheet, V4SurerSheet } from "./V4BlindSheets";
import { useConfidenceChainReceipt, type ConfidenceChainEcho } from "../coachwalk/useConfidenceChainReceipt";
import { readMoment, useMomentReadSeeds, type MomentReadSeeds } from "../coachwalk/momentReadSeeds";
import {
  JudgeScreen, PanelPlayer, QueueScreen, RevealBody, RevealScreen, SpeakerScreen, SpeakersScreen, revealLines, type PanelClip,
  type WillRow,
} from "./CoachPanelScreens";
import { useAnswerFlow } from "./CoachAnswerFlow";
import { usePlanFlow } from "./CoachPlanFlow";
import {
  BLANK_IMPORT, CorpusAnalyseScreen, CorpusHomeScreen, CorpusImportScreen, type ImportForm,
} from "./CoachCorpusScreens";
import { MAX_BATCH_FILES, batchFailLine, importBatch, inNameOrder } from "./corpusBatch";
import { WillBankScreen } from "./WillBankScreen";
import { fetchWillBank, saveWillBank, type WillBank, type WillBankItem } from "@/services/api/willBank";
import CoachCorpusJudge from "./CoachCorpusJudge";
import {
  isMomentScreen, isPlanScreen, momentOf, walkScreenOf, type MomentScreen, type PanelAction, type PanelScreen, type PanelState,
} from "@/lib/willab/coachPanel";
import { readSlideFor, type AnswerValue, type QueueSpeaker, type ReadSlide } from "@/lib/willab/coachWalk";
import type { WalkScreen } from "@/lib/willab/walkMotion";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { MediaRefreshProvider } from "@/lib/media/mediaRefresh";
import { fetchCoachReviewSession } from "@/services/api/coachReview";
import { closeWaitingMoments, type MomentRead } from "@/services/api/coachWalk";
import { buildRatingBody, saveStateRating } from "@/services/api/stateRatings";
import {
  clearBlindLine, fetchBlockPicks, fetchErrorAudit, fetchV4MomentPicks, fetchV4SurerPairs,
  type BlindLine, type BlockPickQueue, type ErrorAuditQueue, type V4MomentPickQueue, type V4SurerQueue,
} from "@/services/api/coachPanel";
import {
  fetchCoachSpeakers, queueSpeakerFor, speakersFromQueue, type PanelSpeaker,
} from "@/services/api/coachSpeakers";
import {
  eraseTrainingImport, fetchBlindConfidenceQueue, fetchTrainingImportsPage, saveImportSetup, type TrainingImport,
} from "@/services/api/trainingCorpus";
import { isFounderEmail } from "@/lib/founder";
import { useUserEmail } from "../useUserEmail";

type StageScreen = WalkScreen & { panel: PanelScreen };
type TakeMedia = { clips: Record<string, PanelClip>; slides: Record<string, ReadSlide> };

/** The clip and the slide of every moment of the open Take. The words the
 *  session carries are not kept: the Judge screen must not have them.
 *  Read once per Take opened; `refresh` reads the open Take again for fresh
 *  signed links (a clip's error, a tab back after hours) past that cache. */
export function useTakeMedia(sessionId: string | null): {
  media: Record<string, TakeMedia>;
  refresh: () => Promise<void>;
} {
  const [media, setMedia] = useState<Record<string, TakeMedia>>({});
  const asked = useRef(new Set<string>());
  const load = useCallback(async (sid: string): Promise<void> => {
    const session = await fetchCoachReviewSession(sid);
    if (!session) return;
    const clips: Record<string, PanelClip> = {};
    const slides: Record<string, ReadSlide> = {};
    for (const s of session.snippets) {
      clips[s.id] = { src: s.audioRef, startOffsetMs: s.startOffsetMs, durationMs: s.durationMs };
      const picture = readSlideFor(session.presentationRef, s.slide);
      if (picture) slides[s.id] = picture;
    }
    setMedia((prev) => ({ ...prev, [sid]: { clips, slides } }));
  }, []);
  useEffect(() => {
    if (!sessionId || asked.current.has(sessionId)) return;
    asked.current.add(sessionId);
    void load(sessionId);
  }, [sessionId, load]);
  const refresh = useCallback(
    () => (sessionId ? load(sessionId) : Promise.resolve()),
    [sessionId, load],
  );
  return { media, refresh };
}

/** Fresh links for the blind lines' players, read only for their links: the
 *  open sheet keeps its own queue (and its place in it); a clip finds its
 *  fresh link by the link's path. Nothing new is shown (BLIND COACH). */
function useBlindLinks(open: boolean): { links: unknown; refresh: () => Promise<void> } {
  const [links, setLinks] = useState<unknown>(null);
  const refresh = useCallback(async () => {
    if (!open) return;
    setLinks(await Promise.all([fetchErrorAudit(), fetchBlockPicks(), fetchV4MomentPicks(), fetchV4SurerPairs()]));
  }, [open]);
  return { links, refresh };
}

/** The moment's read, asked for only while a screen after Judge is on
 *  screen and its rating is no longer saving (C1); the saved rating's own
 *  read when it brought one (C2). `reread` forgets a read, so the next
 *  screen of that moment reads it fresh (after an answer). */
function useMomentRead(
  screen: PanelScreen,
  seeds: MomentReadSeeds,
  saving: Readonly<Record<string, true>>,
): { reads: Record<string, MomentRead | null>; reread: (snippetId: string) => void } {
  const [reads, setReads] = useState<Record<string, MomentRead | null>>({});
  const after = screen.key !== "judge" ? momentOf(screen) : null;
  const sessionId = after && "take" in screen ? screen.take.sessionId : null;
  const snippetId = after?.snippetId ?? null;
  const held = snippetId !== null && saving[snippetId] === true;
  const missing = snippetId !== null && !(snippetId in reads);
  useEffect(() => {
    if (!sessionId || !snippetId || held || !missing) return;
    let cancelled = false;
    void readMoment(seeds, sessionId, snippetId).then((read) => {
      if (!cancelled) setReads((prev) => ({ ...prev, [snippetId]: read }));
    });
    return () => { cancelled = true; };
  }, [sessionId, snippetId, seeds, held, missing]);
  const reread = useCallback((id: string) => setReads(({ [id]: _old, ...rest }) => rest), []);
  return { reads, reread };
}

/** The blind lines, read each time the queue opens; null while dark. */
function useBlindLines(queueOpen: boolean) {
  const [audit, setAudit] = useState<ErrorAuditQueue | null>(null);
  const [picks, setPicks] = useState<BlockPickQueue | null>(null);
  const [v4Picks, setV4Picks] = useState<V4MomentPickQueue | null>(null);
  const [v4Surer, setV4Surer] = useState<V4SurerQueue | null>(null);
  useEffect(() => {
    if (!queueOpen) return;
    let cancelled = false;
    void fetchErrorAudit().then((next) => { if (!cancelled) setAudit(next); });
    void fetchBlockPicks().then((next) => { if (!cancelled) setPicks(next); });
    void fetchV4MomentPicks().then((next) => { if (!cancelled) setV4Picks(next); });
    void fetchV4SurerPairs().then((next) => { if (!cancelled) setV4Surer(next); });
    return () => { cancelled = true; };
  }, [queueOpen]);
  /** A line the founder cleared draws empty at once (it waits for next week). */
  const emptied = useCallback((line: BlindLine) => {
    const none = <Q extends { items: unknown[] }>(q: Q | null): Q | null => (q ? { ...q, items: [] } : q);
    if (line === "error_audit") setAudit(none);
    else if (line === "block_pick") setPicks(none);
    else if (line === "v4_moment_pick") setV4Picks(none);
    else setV4Surer(none);
  }, []);
  return { audit, picks, setAudit, setPicks, v4Picks, setV4Picks, v4Surer, setV4Surer, emptied };
}

/** Every speaker, read each time Your speakers opens. `speakers` is null
 *  until the read is in, or when it could not be had: the list meanwhile
 *  draws the queue's own speakers (the backend builds both from one queue),
 *  so it opens at once instead of waiting on a second read of it. */
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
  return { speakers: read.speakers, loading: open && !read.done };
}

type ImportSteps = { imports: TrainingImport[]; hasMore: boolean };

/** The imports, read in steps (founder 2026-10-21, N100): the first each
 *  time Training corpus opens, the next as the coach scrolls to the bottom;
 *  null while dark. */
function useImports(open: boolean) {
  const [imports, setImports] = useState<TrainingImport[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const read = useRef<{ imports: TrainingImport[]; next: number | null }>({ imports: [], next: null });
  const pending = useRef<Promise<ImportSteps> | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetchTrainingImportsPage(0).then((page) => {
      if (cancelled) return;
      read.current = { imports: page?.imports ?? [], next: page?.nextOffset ?? null };
      setImports(page ? page.imports : null);
      setNext(read.current.next);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, tick]);
  /** The next step, after the ones read; resolves to everything read so far
   *  and whether more waits (a failed read says no, until the next scroll). */
  const more = useCallback((): Promise<ImportSteps> => {
    if (pending.current) return pending.current;
    const from = read.current.next;
    if (from === null) return Promise.resolve({ imports: read.current.imports, hasMore: false });
    setLoadingMore(true);
    pending.current = fetchTrainingImportsPage(from).then((page) => {
      pending.current = null;
      setLoadingMore(false);
      if (!page) return { imports: read.current.imports, hasMore: false };
      const seen = new Set(read.current.imports.map((im) => im.sessionId));
      const all = [...read.current.imports, ...page.imports.filter((im) => !seen.has(im.sessionId))];
      read.current = { imports: all, next: page.nextOffset };
      setImports(all);
      setNext(page.nextOffset);
      return { imports: all, hasMore: page.nextOffset !== null };
    });
    return pending.current;
  }, []);
  /** The list's bottom while more waits or is on its way. */
  const bottom = next !== null || loadingMore ? { loading: loadingMore, onMore: () => void more() } : null;
  return { imports, loading, bottom, more, refresh: () => setTick((n) => n + 1) };
}

/** Will's questions (N83), the founder's only: read when the queue or the
 *  editor is open (so for anyone else there is no bank and no row); saved
 *  from the editor. */
function useWillBank(open: boolean, onOpen: () => void) {
  const [bank, setBank] = useState<WillBank | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchWillBank().then((next) => {
      if (!cancelled && next) setBank(next);
    });
    return () => { cancelled = true; };
  }, [open]);
  const save = async (changes: Pick<WillBankItem, "key" | "question" | "chips">[]): Promise<string | null> => {
    const saved = await saveWillBank(changes);
    if ("bank" in saved) {
      setBank(saved.bank);
      return null;
    }
    return saved.error || COPY.answerFail;
  };
  const row: WillRow | null = bank ? { questions: bank.questions, empty: bank.empty, onOpen } : null;
  return { bank, save, row };
}

type JudgeFail = { error: string; attempt: number };

/** The rating's save (C1, founder 2026-10-08). The tap moves to What
 *  happened at once, with the save in flight; What happened holds its
 *  loader until the save succeeds (BLIND COACH: nothing about the moment is
 *  read before). A failed save un-rates the moment, which takes What
 *  happened back to its Judge screen, and the Judge screen shows today's
 *  error with its answers unfilled. Kept here, not on the Judge screen,
 *  because that screen is gone by the time the save answers. */
function useJudgeSave(dispatch: Dispatch<PanelAction>, seeds: MomentReadSeeds, onSaved: () => void) {
  const [saving, setSaving] = useState<Record<string, true>>({});
  const [fails, setFails] = useState<Record<string, JudgeFail>>({});
  const inFlight = useRef(new Set<string>());

  const settle = (snippetId: string) => {
    inFlight.current.delete(snippetId);
    setSaving(({ [snippetId]: _done, ...rest }) => rest);
  };

  async function answer(snippetId: string, value: AnswerValue, echo: ConfidenceChainEcho | null): Promise<void> {
    const body = buildRatingBody(value);
    if (!body || inFlight.current.has(snippetId)) return;
    inFlight.current.add(snippetId);
    setSaving((prev) => ({ ...prev, [snippetId]: true }));
    setFails(({ [snippetId]: _cleared, ...rest }) => rest);
    dispatch({ type: "rated", snippetId, value });
    const result = await saveStateRating(snippetId, body, echo);
    if (!result.ok) {
      const error = result.error ?? COPY.judgeFail;
      // The attempt redraws the answers unfilled, as before.
      setFails((prev) => ({ ...prev, [snippetId]: { error, attempt: (prev[snippetId]?.attempt ?? 0) + 1 } }));
      settle(snippetId);
      dispatch({ type: "unrated", snippetId });
      return;
    }
    if (result.momentRead) seeds.put(snippetId, result.momentRead);
    settle(snippetId);
    onSaved();
  }

  return { saving, fails, answer };
}

/** The live Judge screen: the chain's render receipt, and the tap. */
function JudgeLive({ screen, nav, clip, fail, onAnswer, onSkip, onClose }: {
  screen: MomentScreen;
  nav: WalkNav;
  clip: PanelClip | null;
  /** The last failed save of this moment, if any. */
  fail: JudgeFail | undefined;
  onAnswer: (snippetId: string, value: AnswerValue, echo: ConfidenceChainEcho | null) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const snippetId = momentOf(screen)?.snippetId ?? "";
  const chain = useConfidenceChainReceipt(snippetId, clip !== null);
  return (
    <JudgeScreen nav={nav} momentId={snippetId} clip={clip} error={fail?.error ?? null} attempt={fail?.attempt ?? 0}
      onAnswer={(value) => onAnswer(snippetId, value, chain.current)} onSkip={onSkip} onClose={onClose} />
  );
}

export type CoachPanelProps = {
  state: PanelState;
  dispatch: Dispatch<PanelAction>;
  speakers: readonly QueueSpeaker[];
  loading: boolean;
  /** Read the queue again (after the founder's Delete of a speaker's row). */
  refresh?: () => void;
};

function liveSpeaker(speakers: readonly QueueSpeaker[], snapshot: QueueSpeaker): QueueSpeaker {
  const live = speakers.find((s) => s.pseudonym === snapshot.pseudonym);
  if (!live) return snapshot;
  return live.goal == null && snapshot.goal != null ? { ...live, goal: snapshot.goal } : live;
}

export default function CoachPanel({ state, dispatch, speakers, loading, refresh }: CoachPanelProps) {
  const { screen } = state;
  const stage: StageScreen = useMemo(() => ({ ...walkScreenOf(screen), panel: screen }), [screen]);
  const takeId = momentOf(screen) && "take" in screen ? screen.take.sessionId : null;
  const { media, refresh: refreshTake } = useTakeMedia(takeId);
  const seeds = useMomentReadSeeds();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));
  const judge = useJudgeSave(dispatch, seeds, () => say(COPY.toastJudged));
  const { reads, reread } = useMomentRead(screen, seeds, judge.saving);
  const blind = useBlindLines(screen.key === "queue");
  const all = useAllSpeakers(screen.key === "speakers");
  const corpus = useImports(screen.key === "corpushome");
  const founder = isFounderEmail(useUserEmail());
  const will = useWillBank(founder && (screen.key === "queue" || screen.key === "willbank"),
    () => dispatch({ type: "willBank" }));
  const [form, setForm] = useState<ImportForm>(BLANK_IMPORT);
  const [corpusBusy, setCorpusBusy] = useState(false);
  const [corpusFail, setCorpusFail] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ name: string; index: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [blindOpen, setBlindOpen] = useState<"audit" | "picks" | "v4picks" | "v4surer" | null>(null);
  const blindLinks = useBlindLinks(blindOpen !== null);
  const refreshMedia = () => Promise.all([refreshTake(), blindLinks.refresh()]);
  const mediaPayload = [media, blind.audit, blind.picks, blind.v4Picks, blind.v4Surer, blindLinks.links];

  const close = () => dispatch({ type: "close" });
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

  /** A finished import's ⋯ → Edit: its set-up again, filled in. The list
   *  does not carry "where it came from", so that field starts empty. */
  function editImport(im: TrainingImport): void {
    setCorpusFail(null);
    setForm({ ...BLANK_IMPORT, topic: im.topic, speaker: im.speakerLabel ?? "", language: im.language });
    dispatch({ type: "corpusImport", setupOf: im.sessionId, edit: true });
  }

  /** The founder's ⋯ → Delete on a blind line: what waits on it is cleared
   *  for the week, and the row goes. False keeps the confirmation open. */
  async function clearBlind(line: BlindLine): Promise<boolean> {
    const ok = await clearBlindLine(line);
    if (ok) blind.emptied(line);
    return ok;
  }
  const clearBlindLineOf = founder ? clearBlind : undefined;

  /** The founder's ⋯ → Delete on a speaker's row: their waiting moments leave
   *  every coach's queue, then the queue reads again. False keeps the
   *  confirmation open and says so. */
  async function deleteSpeaker(speaker: QueueSpeaker): Promise<boolean> {
    const ok = await closeWaitingMoments(speaker);
    if (ok) refresh?.();
    return ok;
  }

  /** The founder's ⋯ → Delete: the import is erased for good, then the list
   *  reads again. False keeps the confirmation open and says so. */
  async function deleteImport(im: TrainingImport): Promise<boolean> {
    const result = await eraseTrainingImport(im.sessionId);
    if (result.ok) corpus.refresh();
    return result.ok;
  }

  async function submitImport(setupOf: string | null, edit = false): Promise<void> {
    if (corpusBusy || form.language === null || !form.topic.trim()) return;
    setCorpusBusy(true);
    setCorpusFail(null);
    if (setupOf && edit) {
      // An edit changes the words only: no loader, no judging, back to the
      // imports, which read the new name.
      const saved = await saveImportSetup(setupOf, {
        topic: form.topic.trim(), language: form.language,
        speakerLabel: form.speaker.trim() || null, source: form.source.trim() || null,
      });
      setCorpusBusy(false);
      if (!saved.ok) { setCorpusFail(saved.error ?? COPY.answerFail); return; }
      setForm(BLANK_IMPORT);
      corpus.refresh();
      dispatch({ type: "back" });
      return;
    }
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
    const files = form.files;
    if (files.length === 0) { setCorpusBusy(false); return; }
    let accepted = false;
    // One file or several, imported one at a time (corpusBatch): the loader
    // from the first the backend takes, saying which file is on its way.
    const result = await importBatch(files, {
      topic: form.topic.trim(), speakerLabel: form.speaker.trim() || null, note: form.source.trim() || null,
      language: form.language, optionalStages: form.stages,
    }, {
      onFile: (index) => setBatch({ name: files[index].name, index, total: files.length }),
      onAccepted: () => { if (!accepted) dispatch({ type: "corpusAnalyse" }); accepted = true; },
    });
    setCorpusBusy(false);
    setBatch(null);
    // The backend's own sentence (a 410 while its switch is off, a rejected
    // file), naming the files when there were several: under the pill of
    // the screen the coach is on.
    setCorpusFail(batchFailLine(result, files.length > 1, COPY.answerFail));
    if (result.imported === 0) {
      if (accepted) dispatch({ type: "corpusHome" });
      return;
    }
    setForm(BLANK_IMPORT);
    corpus.refresh();
    say(`${COPY.imported} · ${COPY.moments(result.moments)}`);
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

  const clipOf = (s: MomentScreen): PanelClip | null => {
    const id = momentOf(s)?.snippetId;
    return id ? media[s.take.sessionId]?.clips[id] ?? null : null;
  };
  const slideOf = (s: MomentScreen): ReadSlide | null => {
    const id = momentOf(s)?.snippetId;
    return id ? media[s.take.sessionId]?.slides[id] ?? null : null;
  };
  const playerFor = (s: MomentScreen, passage: string) => (
    <PanelPlayer nav={navFor(s)} momentId={momentOf(s)?.snippetId ?? ""} clip={clipOf(s)}
      words={passage ? <span data-testid="coach-panel-passage">{passage}</span> : null} />
  );
  const answer = useAnswerFlow({
    state, dispatch, reads, reread, say, navFor, playerFor, close,
    summaryBody: (s, extra) => {
      const read = reads[momentOf(s)?.snippetId ?? ""];
      return (
        <RevealBody read={read} slide={slideOf(s)} player={playerFor(s, read?.passage ?? "")}
          lines={read ? [...revealLines(read, s.speaker.pseudonym, state.rated[momentOf(s)?.snippetId ?? ""] ?? null), ...(extra ? [extra] : [])] : []} />
      );
    },
  });

  const plans = usePlanFlow({ state, dispatch, say, close, refresh });

  /** What happened's Next: the diagnosis first for an error, else the
   *  choice; a moment nothing reached the coach from is passed. */
  function afterReveal(read: MomentRead | null | undefined): void {
    if (!read?.request) dispatch({ type: "pass" });
    else dispatch({ type: "step", key: read.request.kind === "error" ? "diagnose" : "decide" });
  }

  /** The founder's editor of Will's questions (N83), the speaker's plan
   *  (N213), else the panel's own screens. */
  function screenFor(s: StageScreen) {
    if (isPlanScreen(s.panel)) return plans.renderPlan(s.panel, s.panel === screen);
    if (s.panel.key !== "willbank") return render(s);
    return (
      <WillBankScreen bank={will.bank} onClose={close} onBack={() => dispatch({ type: "back" })}
        onSave={async (changes) => {
          const refused = await will.save(changes);
          if (refused === null) say(COPY.saved);
          return refused;
        }} />
    );
  }

  function render(s: StageScreen) {
    const panel = s.panel;
    const live = panel === screen;
    if (panel.key === "queue") {
      return (
        <QueueScreen speakers={speakers} loading={loading} onClose={close}
          onSpeaker={(speaker) => dispatch({ type: "speaker", speaker })}
          onDelete={founder ? deleteSpeaker : undefined}
          will={will.row}
          blind={{ audit: blind.audit, picks: blind.picks,
            onOpenAudit: () => setBlindOpen("audit"), onOpenPicks: () => setBlindOpen("picks"),
            v4Picks: blind.v4Picks, v4Surer: blind.v4Surer,
            onOpenV4Picks: () => setBlindOpen("v4picks"), onOpenV4Surer: () => setBlindOpen("v4surer"),
            onClear: clearBlindLineOf }} />
      );
    }
    if (panel.key === "speakers") {
      return (
        <SpeakersScreen speakers={all.speakers ?? speakersFromQueue(speakers)}
          loading={all.speakers === null && (all.loading || loading)} onClose={close}
          onSpeaker={(speaker) => dispatch({ type: "speaker", speaker: queueSpeakerFor(speaker, speakers) })} />
      );
    }
    if (panel.key === "speaker") {
      const speaker = liveSpeaker(speakers, panel.speaker);
      return (
        <SpeakerScreen speaker={speaker} loading={loading} onClose={close} onBack={() => dispatch({ type: "back" })}
          onTake={(take) => dispatch({ type: "take", speaker, take })}
          onPlan={() => dispatch({ type: "plan", speaker })} />
      );
    }
    if (panel.key === "lounge") return null;
    if (panel.key === "corpushome") {
      return (
        <CorpusHomeScreen imports={corpus.imports} loading={corpus.loading} fail={live ? corpusFail : null}
          more={corpus.bottom}
          onImport={() => { setCorpusFail(null); setForm(BLANK_IMPORT); dispatch({ type: "corpusImport" }); }}
          onOpen={openImport} onEdit={editImport} onDelete={founder ? deleteImport : undefined} onClose={close} />
      );
    }
    if (panel.key === "corpusimport") {
      return (
        <CorpusImportScreen setupOf={panel.setupOf} edit={panel.edit} form={form} busy={corpusBusy} fail={live ? corpusFail : null}
          onChange={setForm} onPickFile={() => fileInput.current?.click()}
          onSubmit={() => void submitImport(panel.setupOf, panel.edit)} onBack={() => dispatch({ type: "back" })} onClose={close} />
      );
    }
    if (panel.key === "corpusanalyse") return <CorpusAnalyseScreen batch={batch} onClose={close} />;
    if (panel.key === "corpus") {
      return live ? (
        <CoachCorpusJudge startId={panel.importId} topic={panel.topic} onSaved={() => say(COPY.toastJudged)}
          onSaveFail={say} onDone={() => { corpus.refresh(); dispatch({ type: "corpusHome" }); }}
          onBack={() => dispatch({ type: "back" })} onClose={close} />
      ) : (
        <JudgeScreen nav={{ label: panel.topic, index: 0, total: 1, onBack: () => undefined, onNext: () => undefined }}
          momentId={panel.importId} clip={null} error={null} attempt={0} onAnswer={() => undefined} onClose={close} />
      );
    }
    if (panel.key === "takeword" || panel.key === "takevideo") return answer.renderTake(panel, live);
    const moment = momentOf(panel);
    if (!moment || !isMomentScreen(panel)) return null;
    const nav = navFor(panel);
    const clip = clipOf(panel);
    if (panel.key === "judge") {
      return live ? (
        <JudgeLive screen={panel} nav={nav} clip={clip} fail={judge.fails[moment.snippetId]}
          onAnswer={(id, value, echo) => void judge.answer(id, value, echo)}
          onSkip={() => dispatch(panel.take.moments.length > 1 ? { type: "next" } : { type: "back" })} onClose={close} />
      ) : (
        <JudgeScreen nav={nav} momentId={moment.snippetId} clip={clip} error={null} attempt={0}
          onAnswer={() => undefined} onClose={close} />
      );
    }
    if (panel.key === "reveal") {
      const read = reads[moment.snippetId];
      return (
        <RevealScreen nav={nav} momentId={moment.snippetId} clip={clip} slide={slideOf(panel)}
          read={read} pseudonym={panel.speaker.pseudonym}
          justRated={state.rated[moment.snippetId] ?? null}
          onNext={() => afterReveal(read)} onClose={close} />
      );
    }
    return answer.renderMoment(panel, live);
  }

  return (
    <MediaRefreshProvider refresh={refreshMedia} payload={mediaPayload}>
      {/* On a computer, the same phone-width screens, centred (Q-B14 A). */}
      <WalkStage screen={stage} dir={state.dir} render={screenFor} className="walk-stage-column md:mx-auto md:max-w-[430px]"
        backdrop="fixed inset-0 z-50 hidden bg-muted md:block" />
      <input ref={fileInput} type="file" multiple accept="audio/*,video/mp4" className="hidden" data-testid="corpus-file-input"
        onChange={(e) => {
          const picked = inNameOrder(Array.from(e.target.files ?? []));
          e.target.value = "";
          if (picked.length === 0) return;
          // Over the backend's upload limit, the choice is refused whole.
          if (picked.length > MAX_BATCH_FILES) { setCorpusFail(COPY.upToFiles(MAX_BATCH_FILES)); return; }
          setCorpusFail(null);
          setForm((prev) => ({ ...prev, files: picked }));
        }} />
      {toast ? <WalkToast key={toast.id} message={toast.text} onDone={() => setToast(null)} /> : null}
      {blindOpen === "audit" && blind.audit ? (
        <div className="fixed inset-0 z-50 md:mx-auto md:max-w-[430px]">
          <CoachAuditSheet queue={blind.audit} nextLabel={COPY.next} onClose={() => setBlindOpen(null)}
            onDone={() => { setBlindOpen(null); blind.setAudit(null); }} />
        </div>
      ) : null}
      {blindOpen === "picks" && blind.picks ? (
        <div className="fixed inset-0 z-50 md:mx-auto md:max-w-[430px]">
          <CoachBlockPickSheet queue={blind.picks} onClose={() => setBlindOpen(null)}
            onDone={() => { setBlindOpen(null); blind.setPicks(null); }} />
        </div>
      ) : null}
      {blindOpen === "v4picks" && blind.v4Picks ? (
        <div className="fixed inset-0 z-50 md:mx-auto md:max-w-[430px]">
          <V4MomentPickSheet queue={blind.v4Picks} nextLabel={COPY.next} onClose={() => setBlindOpen(null)}
            onDone={() => { setBlindOpen(null); blind.setV4Picks(null); }} />
        </div>
      ) : null}
      {blindOpen === "v4surer" && blind.v4Surer ? (
        <div className="fixed inset-0 z-50 md:mx-auto md:max-w-[430px]">
          <V4SurerSheet queue={blind.v4Surer} nextLabel={COPY.next} onClose={() => setBlindOpen(null)}
            onDone={() => { setBlindOpen(null); blind.setV4Surer(null); }} />
        </div>
      ) : null}
    </MediaRefreshProvider>
  );
}
