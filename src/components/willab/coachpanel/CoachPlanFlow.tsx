"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's side of the plan (founder 2026-10-27, "Build it, words OK";   */
/*  backend N213; prototype https://claude.ai/artifact/QznwCAgkBHAVAGDMKVUKvE, */
/*  rows "The plan"). Opened from "Their plan" on the speaker's page:          */
/*                                                                            */
/*    planlevel   Which level comes first? Their voice message ("Why it        */
/*                matters"), their key line, the five levels, Audio unclear.  */
/*                BLIND COACH: the plan's level is never read before the pick */
/*    planreveal  What happened: the key line; You, The machine heard,        */
/*                Deadline, and Stress and Ready when the speaker gave them   */
/*                (N211). Keep yours, Change my answer                        */
/*    planvideo   a level three Takes without moving: its name, N173's line,  */
/*                the panel's own Record                                      */
/*    planshare   Ready for {p}: the video, Share with {p}. It reaches the    */
/*                speaker as the coach's word on their latest Take (their     */
/*                words kept), then the plan leaves the queue                 */
/*                                                                            */
/*  Reads and writes: services/api/coachPlans; the video goes up as the Take  */
/*  word's does (uploadCoachVideo, saveTakeWord).                             */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import WalkLoading from "../walk/WalkLoading";
import WalkChoices from "../walk/WalkChoices";
import CoachVideo from "../CoachVideo";
import CoachVideoBox from "./CoachVideoBox";
import { VoicePlayer } from "../plan/VoicePlayer";
import { Facts, Group, type RevealLine } from "./CoachPanelScreens";
import { videoFooter } from "./CoachAnswerScreens";
import { useCoachVideoRecorder } from "@/hooks/useCoachVideoRecorder";
import { isPlanScreen, type PanelAction, type PanelScreen, type PlanScreen } from "@/lib/willab/coachPanel";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import {
  fetchCoachPlan, markPlanAnswered, markPlanUnclear, pickPlanLevel, planAudioUrl,
  type CoachPlan, type PlanKeyLine, type PlanReveal,
} from "@/services/api/coachPlans";
import { fetchTakeWord, saveTakeWord } from "@/services/api/coachWalk";
import { uploadCoachVideo } from "@/services/api/coachReview";
import { newUploadKey, videoProvenance } from "@/services/api/coachVideoMeta";

const BOX = "flex items-center gap-3 rounded-[18px] border border-border px-3.5 py-3";

function Fail({ text }: { text: string | null }) {
  return text ? <p role="alert" className="m-0 text-center text-[14px] text-destructive">{text}</p> : null;
}

/** The key line in their words, with how they said it. */
function KeyLine({ planId, line }: { planId: string; line: PlanKeyLine }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-border p-3.5">
      <p className="m-0 text-[17px] leading-[1.45]">“{line.text}”</p>
      {line.answerId ? (
        <VoicePlayer src={planAudioUrl(planId, line.answerId)} tone="dark" durationMs={line.durationMs} />
      ) : null}
    </div>
  );
}

/** What happened's lines: only what is known. Pure. */
export function planRevealLines(reveal: PlanReveal): RevealLine[] {
  const lines: (RevealLine | null)[] = [
    { label: COPY.you, value: reveal.you },
    reveal.machine ? { label: COPY.machineHeard, value: reveal.machine } : null,
    reveal.deadlineShort ? { label: COPY.deadline, value: reveal.deadlineShort } : null,
    reveal.stress !== null ? { label: COPY.stress, value: String(reveal.stress) } : null,
    reveal.ready !== null ? { label: COPY.ready, value: String(reveal.ready) } : null,
  ];
  return lines.filter((line): line is RevealLine => line !== null);
}

export function PlanLevelScreen({ detail, picked, busy, fail, onPick, onUnclear, onBack, onClose }: {
  /** undefined while it loads, null when it could not be read. */
  detail: CoachPlan | null | undefined;
  picked: string | null;
  busy: boolean;
  fail: string | null;
  onPick: (level: string) => void;
  onUnclear: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const footer = detail ? (
    <WalkFooter links={[{ label: COPY.judgeUnclear, onClick: onUnclear, disabled: busy, testId: "coach-panel-plan-unclear" }]}>
      <Fail text={fail} />
    </WalkFooter>
  ) : null;
  return (
    <WalkOverlay title={COPY.whichLevel} onBack={onBack} backLabel={COPY.theirPlan} onClose={onClose}
      footer={footer} testId="coach-panel-plan-level">
      {detail === undefined ? <WalkLoading /> : detail === null ? (
        <p role="alert" className="m-0 text-[15px]">{COPY.readFail}</p>
      ) : (
        <>
          {detail.why?.answerId ? (
            <Group label={COPY.whyItMatters}>
              <div className={BOX}>
                <div className="min-w-0 flex-grow">
                  <VoicePlayer src={planAudioUrl(detail.planId, detail.why.answerId)} tone="dark" durationMs={detail.why.durationMs} />
                </div>
              </div>
            </Group>
          ) : null}
          {detail.keyLine ? (
            <Group label={COPY.theirKeyLine}>
              <KeyLine planId={detail.planId} line={detail.keyLine} />
            </Group>
          ) : null}
          <WalkChoices label={COPY.whichLevel} onPick={(v) => { if (!busy) onPick(v); }}
            choices={detail.levels.map((l) => ({ value: l.key, label: l.name, mark: "none" as const, selected: picked === l.key }))} />
        </>
      )}
    </WalkOverlay>
  );
}

export function PlanRevealScreen({ planId, reveal, onKeep, onChange, onBack, onClose }: {
  planId: string;
  reveal: PlanReveal | null;
  onKeep: () => void;
  onChange: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const footer = reveal ? (
    <WalkFooter pill={{ label: COPY.keepYours, onClick: onKeep, testId: "coach-panel-plan-keep" }}
      links={[{ label: COPY.changeMyAnswer, onClick: onChange }]} />
  ) : null;
  return (
    <WalkOverlay title={COPY.whatHappened} onBack={onBack} backLabel={COPY.theirPlan} onClose={onClose}
      footer={footer} testId="coach-panel-plan-reveal">
      {reveal ? (
        <>
          {reveal.keyLine ? <KeyLine planId={planId} line={reveal.keyLine} /> : null}
          <Facts lines={planRevealLines(reveal)} />
        </>
      ) : <WalkLoading />}
    </WalkOverlay>
  );
}

type Ctx = {
  state: { screen: PanelScreen };
  dispatch: Dispatch<PanelAction>;
  say: (text: string) => void;
  close: () => void;
  /** Read the queue again, once a plan is answered. */
  refresh?: () => void;
};

/** The plan's screens, their reads and their writes. */
export function usePlanFlow({ state, dispatch, say, close, refresh }: Ctx) {
  const screen = state.screen;
  const planId = isPlanScreen(screen) ? screen.plan.planId : null;
  const [details, setDetails] = useState<Record<string, CoachPlan | null>>({});
  const [reveals, setReveals] = useState<Record<string, PlanReveal>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const recorder = useCoachVideoRecorder();
  const asked = useRef(new Set<string>());

  // Each plan is read once it opens, blind: never the level to pick.
  useEffect(() => {
    if (!planId || asked.current.has(planId)) return;
    asked.current.add(planId);
    void fetchCoachPlan(planId).then((plan) => setDetails((prev) => ({ ...prev, [planId]: plan })));
  }, [planId]);

  // Off the video's two screens, the camera is let go.
  const onVideo = screen.key === "planvideo" || screen.key === "planshare";
  const status = recorder.state.status;
  useEffect(() => {
    if (!onVideo && status !== "idle") recorder.reset();
  }, [onVideo, status, recorder]);

  useEffect(() => { setFail(null); setPicked(null); }, [screen.key, planId]);

  const back = () => dispatch({ type: "back" });

  /** Leave the plan for the queue, which reads again without it. */
  const done = () => {
    asked.current.clear();
    setDetails({});
    refresh?.();
    dispatch({ type: "planDone" });
  };

  async function pick(panel: PlanScreen, level: string): Promise<void> {
    setBusy(true);
    setPicked(level);
    setFail(null);
    const result = await pickPlanLevel(panel.plan.planId, level);
    setBusy(false);
    if (!result.ok) {
      setPicked(null);
      setFail(result.message || COPY.answerFail);
      return;
    }
    setReveals((prev) => ({ ...prev, [panel.plan.planId]: result.reveal }));
    dispatch({ type: "planStep", key: "planreveal" });
  }

  async function unclear(panel: PlanScreen): Promise<void> {
    setBusy(true);
    const ok = await markPlanUnclear(panel.plan.planId);
    setBusy(false);
    if (!ok) { setFail(COPY.answerFail); return; }
    done();
  }

  /** The video goes up as the Take word's does, on the speaker's latest
   *  Take, keeping any words this coach already sent there; then the plan
   *  leaves the queue. */
  async function share(panel: PlanScreen, takeSessionId: string): Promise<void> {
    const file = recorder.state.status === "stopped" ? recorder.state.file : null;
    if (!file) return;
    setBusy(true);
    setFail(null);
    const failed = await (async () => {
      const videoRef = await uploadCoachVideo(takeSessionId, file, {
        idempotencyKey: newUploadKey(), ...videoProvenance("coach-walk"), durationSec: null,
      });
      if (!videoRef) return COPY.answerFail;
      // Never over words that could not be read.
      const saved = await fetchTakeWord(takeSessionId);
      if (!saved.ok) return COPY.answerFail;
      const word = await saveTakeWord(takeSessionId, { text: saved.word?.text ?? "", videoRef, share: true });
      if (!word.ok) return word.message;
      return (await markPlanAnswered(panel.plan.planId)) ? null : COPY.answerFail;
    })();
    setBusy(false);
    if (failed) { setFail(failed); return; }
    recorder.reset();
    say(COPY.toastSharedOnly(panel.speaker.pseudonym));
    done();
  }

  function renderPlan(panel: PlanScreen, live: boolean): ReactNode {
    const id = panel.plan.planId;
    const detail = details[id];
    if (panel.key === "planlevel") {
      return (
        <PlanLevelScreen detail={detail} picked={live ? picked : null} busy={busy} fail={live ? fail : null}
          onPick={(level) => void pick(panel, level)} onUnclear={() => void unclear(panel)} onBack={back} onClose={close} />
      );
    }
    if (panel.key === "planreveal") {
      return (
        <PlanRevealScreen planId={id} reveal={reveals[id] ?? null} onKeep={done} onChange={back} onBack={back} onClose={close} />
      );
    }
    const name = detail?.levelName ?? panel.plan.levelName ?? "";
    if (panel.key === "planvideo") {
      const foot = videoFooter({
        recorder, kept: false, skip: null, onRecordAgain: () => { recorder.reset(); void recorder.start(); },
        keep: { label: COPY.keep, onClick: () => dispatch({ type: "planStep", key: "planshare" }), testId: "coach-panel-plan-video-keep" },
      });
      return (
        <WalkOverlay title={name} subtitle={COPY.stuckLine} onBack={back} backLabel={panel.speaker.pseudonym}
          onClose={close} testId="coach-panel-plan-video"
          footer={live ? <WalkFooter pill={foot.pill} dot={foot.dot} links={foot.links} /> : null}>
          <CoachVideoBox recorder={recorder} tall />
        </WalkOverlay>
      );
    }
    const url = recorder.state.status === "stopped" ? recorder.state.url : null;
    const take = detail?.takeSessionId ?? null;
    return (
      <WalkOverlay title={COPY.readyFor(panel.speaker.pseudonym)} onBack={back} onClose={close} testId="coach-panel-plan-share"
        footer={(
          <WalkFooter pill={{
            label: COPY.shareWith(panel.speaker.pseudonym), disabled: busy || !url || !take,
            onClick: () => { if (take) void share(panel, take); }, testId: "coach-panel-plan-share-pill",
          }}>
            <Fail text={live ? fail : null} />
          </WalkFooter>
        )}>
        {url ? <CoachVideo src={url} className="aspect-[4/5] w-full" /> : null}
      </WalkOverlay>
    );
  }

  return { renderPlan };
}
