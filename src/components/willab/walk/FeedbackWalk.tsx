"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { useGuestBlock } from "../GuestSignUpDialog";
import WalkStage from "./WalkStage";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkWordPicker from "./WalkWordPicker";
import type { WalkDir } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkModel, FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import { phraseTokens, selectionSpan, type PhraseSelection } from "@/lib/willab/phraseTokens";
import type { RootPhraseSpan } from "@/services/api/partLock";

/* -------------------------------------------------------------------------- */
/*  FeedbackWalk — the Feedback walk, mounted on a real Take (build plan       */
/*  D-FW-14; founder lock 2026-10-06; N53.3 NX1 A, N63 Q-B3 A).                */
/*                                                                            */
/*  The production controller. It draws the steps of the walk's plan with     */
/*  the dev harness's exact layouts (src/app/dev/feedback-walk/walkScreens),  */
/*  from the walk's primitives, and moves between them with WalkStage: the    */
/*  overlay rises in 0.38 s, the content slides under a still top bar, ✕      */
/*  sinks it in 0.28 s, and every move is instant with reduce motion.         */
/*                                                                            */
/*  THIS PHASE draws the coach's note, the praise and the helper words; the   */
/*  plan it is given (feedbackWalkModel.ts) holds only those, then the end    */
/*  card, which is the host's. The other screens come with their own tasks:   */
/*  TODO(D-FW-15/16/17/18/20) the clearer version, the exercise video, the    */
/*  practising, "Judgement time!" with the judgements, and sharing.          */
/*                                                                            */
/*  Every word on these screens is a signed one (CHUNK_SHEET_COPY, WALK_COPY) */
/*  or the caller's (the coach's note, the praise words the item carries);    */
/*  nothing here makes one up. No number, read or machine pick is drawn: the  */
/*  only figures are the moment's position and the four-word count (AC-9).   */
/*                                                                            */
/*  A guest reads every screen; a pick or a save opens the sign-up dialog     */
/*  and writes nothing (N32.5).                                               */
/* -------------------------------------------------------------------------- */

/** "Open the walk at step `at`". A new `seq` is a new request. */
export type FeedbackWalkRequest = { seq: number; at: number };

/** The coach's word for the Take, as the walk shows it. */
export type FeedbackWalkCoachNote = {
  text: string | null;
  videoUrl: string | null;
  takeIndex: number | null;
};

/** What a helper-words save carries: the paragraph, the span in the words
 *  the picker numbered, and those words, so the host can tell when the
 *  paragraph has changed under the walk. */
export type FeedbackWalkHelperWords = {
  partId: string;
  span: RootPhraseSpan;
  paragraphText: string;
};

type Props = {
  /** The walk, live. It is held still from the moment the walk opens until
   *  it closes, so a re-read of the page cannot move the screen under the
   *  speaker (the pager's frozen list, the same rule). */
  model: FeedbackWalkModel;
  request: FeedbackWalkRequest | null;
  coachNote: FeedbackWalkCoachNote | null;
  /** The project's first Take: the helper-words note shows (N48.3 Q8 A). */
  firstTake: boolean;
  /** A guest known to the caller. Without it the page's guest gate decides
   *  (GuestGateContext), exactly as the Feedback sheet asks it. */
  guest?: boolean;
  /** Opens the sign-up dialog for a guest known to the caller. */
  onGuest?: () => void;
  onSaveHelperWords: (save: FeedbackWalkHelperWords) => void;
  /** The walk ran out: the host's end card. */
  onEnd: () => void;
  /** ✕: the overlay sinks back to the page. */
  onClose?: () => void;
};

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

export default function FeedbackWalk({
  model,
  request,
  coachNote,
  firstTake,
  guest = false,
  onGuest,
  onSaveHelperWords,
  onEnd,
  onClose,
}: Props) {
  const liveModel = useRef(model);
  liveModel.current = model;
  const [walk, setWalk] = useState<FeedbackWalkModel>(model);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);
  const [picks, setPicks] = useState<Record<number, PhraseSelection | null>>({});
  const guestBlock = useGuestBlock();

  const requestRef = useRef(request);
  requestRef.current = request;
  const seq = request?.seq ?? null;
  useEffect(() => {
    const asked = requestRef.current;
    if (seq === null || !asked) return;
    setWalk(liveModel.current);
    setPicks({});
    setDir(undefined);
    setAt(asked.at);
  }, [seq]);

  const plan = walk.plan;
  const step = plan[at] ?? plan[0];

  const go = useCallback(
    (to: number, how: WalkDir | undefined) => {
      setDir(how);
      setAt(to);
    },
    [],
  );
  const forward = useCallback(() => {
    const to = Math.min(at + 1, plan.length - 1);
    go(to, "forward");
    if (plan[to]?.overlay === false) onEnd();
  }, [at, plan, go, onEnd]);
  const back = useCallback(() => {
    if (plan[at - 1]?.overlay === false || at <= 0) return;
    go(at - 1, "back");
  }, [at, plan, go]);
  const close = useCallback(() => {
    go(0, undefined);
    onClose?.();
  }, [go, onClose]);

  /** A guest's pick or save asks to sign up, and nothing is written. */
  const blocked = useCallback(
    (s: WalkStep): boolean => {
      if (guest || s.readOnly) {
        if (onGuest) onGuest();
        else guestBlock();
        return true;
      }
      return guestBlock();
    },
    [guest, onGuest, guestBlock],
  );

  const ctx: ScreenCtx = {
    walk,
    first: (s) => plan[plan.indexOf(s) - 1]?.overlay === false,
    coachNote,
    firstTake,
    forward,
    back,
    close,
    picks,
    pick: (s, next) => {
      if (blocked(s)) return;
      setPicks((p) => ({ ...p, [s.moment ?? -1]: next }));
    },
    save: (s, moment) => {
      if (blocked(s)) return;
      const picked = picks[moment.index] ?? null;
      const span = selectionSpan(moment.paragraphText, phraseTokens(moment.paragraphText), picked);
      if (span) {
        onSaveHelperWords({ partId: moment.partId, span, paragraphText: moment.paragraphText });
      }
      forward();
    },
  };

  return (
    <div data-feedback-walk data-walk-step={step.key}>
      <WalkStage screen={step} dir={dir} render={(s) => renderScreen(ctx, s)} />
    </div>
  );
}

type ScreenCtx = {
  walk: FeedbackWalkModel;
  /** Back is off on the walk's first screen. */
  first: (step: WalkStep) => boolean;
  coachNote: FeedbackWalkCoachNote | null;
  firstTake: boolean;
  forward: () => void;
  back: () => void;
  close: () => void;
  picks: Record<number, PhraseSelection | null>;
  pick: (step: WalkStep, next: PhraseSelection | null) => void;
  save: (step: WalkStep, moment: FeedbackWalkMoment) => void;
};

function momentNav(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment): WalkNav {
  return {
    label: moment.slideLabel,
    index: moment.index,
    total: ctx.walk.moments.length,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: ctx.first(step),
  };
}

/** The coach's word for the Take: their video, then their words. */
function CoachNote(ctx: ScreenCtx, step: WalkStep) {
  const note = ctx.coachNote;
  const nav: WalkNav = {
    position: note?.takeIndex != null ? `${COPY.historyTake} ${note.takeIndex}` : COPY.titleCoach,
    index: 0,
    total: 1,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: true,
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={nav}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {note?.videoUrl ? <CoachVideo src={note.videoUrl} className="w-full flex-none" /> : null}
      {note?.text ? <WalkMessage>{note.text}</WalkMessage> : null}
    </WalkOverlay>
  );
}

/** A praise: the moment's voice, then its words. */
function Praise(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={momentNav(ctx, step, moment)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {moment.clip ? (
        <WalkPlayer
          seed={`moment-${moment.index}`}
          src={moment.clip.src}
          startOffsetMs={moment.clip.startOffsetMs}
          durationMs={moment.clip.durationMs}
          label={`${COPY.pagerMoment} ${moment.index + 1} ${COPY.pagerOf} ${ctx.walk.moments.length}`}
        />
      ) : null}
      {moment.praiseWords.length > 0 ? (
        <WalkMessage>
          {moment.praiseWords.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </WalkMessage>
      ) : null}
    </WalkOverlay>
  );
}

/** "Choose your helper words", after a praise: at most four, one phrase. */
function Helpers(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  const picked = ctx.picks[moment.index] ?? null;
  return (
    <WalkOverlay
      testId={testId(step)}
      onClose={ctx.close}
      title={COPY.titleEmphasis}
      footer={
        <WalkFooter
          pill={{
            label: COPY.pillEmphasise,
            onClick: () => ctx.save(step, moment),
            disabled: picked === null,
            testId: "walk-forward",
          }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward, testId: "walk-skip" }]}
        />
      }
    >
      {ctx.firstTake ? (
        <p className="m-0 text-[14.5px] text-muted-foreground">{COPY.emphasisFirstTakeNote}</p>
      ) : null}
      <WalkWordPicker
        words={phraseTokens(moment.paragraphText).map((token) => token.text)}
        selection={picked}
        onChange={(next) => ctx.pick(step, next)}
      />
    </WalkOverlay>
  );
}

function renderScreen(ctx: ScreenCtx, step: WalkStep): ReactNode {
  if (step.key === "coachnote") return CoachNote(ctx, step);
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  if (!moment) return null;
  if (step.key === "praise") return Praise(ctx, step, moment);
  if (step.key === "helpers") return Helpers(ctx, step, moment);
  // TODO(D-FW-15/16/17/18/20): the clearer version, the exercise video, the
  // practising, "Judgement time!" with the judgements, and sharing. The plan
  // this phase is given holds none of them.
  return null;
}
