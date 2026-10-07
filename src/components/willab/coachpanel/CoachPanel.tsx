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
import { fetchCoachSpeakers, queueSpeakerFor, type PanelSpeaker } from "@/services/api/coachSpeakers";

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

/** Every speaker, read each time Your speakers opens; null while dark. */
function useAllSpeakers(open: boolean) {
  const [speakers, setSpeakers] = useState<PanelSpeaker[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetchCoachSpeakers().then((next) => {
      if (cancelled) return;
      setSpeakers(next);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);
  return { speakers, loading };
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
    const result = await saveStateRating(snippetId, body, null, null, chain.current);
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
  return live.goal === undefined && snapshot.goal !== undefined ? { ...live, goal: snapshot.goal } : live;
}

export default function CoachPanel({ state, dispatch, speakers, loading, onHandover }: CoachPanelProps) {
  const { screen } = state;
  const stage: StageScreen = useMemo(() => ({ ...walkScreenOf(screen), panel: screen }), [screen]);
  const takeId = screen.key === "judge" || screen.key === "reveal" ? screen.take.sessionId : null;
  const media = useTakeMedia(takeId);
  const reads = useRevealRead(screen);
  const blind = useBlindLines(screen.key === "queue");
  const all = useAllSpeakers(screen.key === "speakers");
  const [blindOpen, setBlindOpen] = useState<"audit" | "picks" | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const close = () => dispatch({ type: "close" });
  const rated = (snippetId: string, value: AnswerValue) => {
    dispatch({ type: "rated", snippetId, value });
    setToast((t) => ({ id: (t?.id ?? 0) + 1, text: COPY.toastJudged }));
  };
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
        <SpeakersScreen speakers={all.speakers} loading={all.loading} onClose={close}
          onSpeaker={(speaker) => dispatch({ type: "speaker", speaker: queueSpeakerFor(speaker, speakers) })} />
      );
    }
    if (panel.key === "speaker") {
      const speaker = liveSpeaker(speakers, panel.speaker);
      return (
        <SpeakerScreen speaker={speaker} onClose={close} onBack={() => dispatch({ type: "back" })}
          onTake={(take) => dispatch({ type: "take", speaker, take })} />
      );
    }
    if (panel.key === "lounge") return null;
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
