"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY, WALK_LINE_BANK } from "../idealEditCopy";
import { useGuestBlock } from "../GuestSignUpDialog";
import WalkStage from "./WalkStage";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage, { WalkNewWords } from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkWordPicker from "./WalkWordPicker";
import WalkToast from "./WalkToast";
import { JournalPostScreen, JudgeScreen, JudgementIntro, type WalkJournalPost } from "./WalkJudgementScreens";
import { useWalkJudging, type WalkJudgementSave, type WalkJudging } from "./useWalkJudging";
import { renderPractiseScreen, type PractiseScreenCtx } from "./WalkPractiseScreens";
import { useWalkPractise, type WalkPractise } from "./useWalkPractise";
import WalkShareScreen from "./WalkShareScreen";
import { useWalkShare, type WalkShare } from "./useWalkShare";
import type { ShareIO } from "@/lib/willab/walkShare";
import type { WalkDir } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";
import { loopEnd } from "@/lib/willab/walkPractise";
import type { WalkPractiseIO } from "@/services/api/walkPractise";
import {
  bankLine,
  clearerTurn,
  firstJudgement,
  type FeedbackWalkModel,
  type FeedbackWalkMoment,
} from "@/lib/willab/feedbackWalkModel";
import type { ClearerPiece } from "@/lib/willab/clearerPieces";
import { phraseTokens, selectionSpan, selectionText, type PhraseSelection } from "@/lib/willab/phraseTokens";
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
/*  THIS PHASE draws the coach's note, the praise, the helper words, the      */
/*  clearer version (D-FW-15), the practise loop (D-FW-16), the exercise      */
/*  (D-FW-17), "Judgement time!" with the Journal post and the judgements     */
/*  (D-FW-18) and sharing (D-FW-20); the plan it is given                     */
/*  (feedbackWalkModel.ts) holds only those, then the end card, which is the  */
/*  host's.                                                                   */
/*                                                                            */
/*  Sharing (flow 11; CM2 B, WQ5 A, WQ6 A, Q-B6 A, S-B6 A): after the        */
/*  judgements, or after Skip on "Judgement time!", the sharing screen        */
/*  cross-fades in. Continue sends the choice through the host's calls and    */
/*  waits for them (useWalkShare): a refusal stays with its signed message in */
/*  the toast; ✕ goes on to the end card without sharing.                    */
/*                                                                            */
/*  The judging (flow 9-10; JP1 A, Q-B4 A, WQ4 A, Q-B6 A): "Judgement time!"  */
/*  cross-fades in; its grey link opens the published Journal post inside the */
/*  overlay (none to open: no link), and ‹ or "Back" return to it. Each       */
/*  judgement is the one judgement screen on the moment's voice; the answer   */
/*  is handed to the host to save (the speaker's own, L3), the walk moves on  */
/*  and the toast says the answer with a tick. ‹ reopens a judgement with the */
/*  earlier answer pressed. Skip hands every unanswered judgement to the host */
/*  to settle as skipped, so the bars clear, and the walk goes on past the    */
/*  judging (useWalkJudging).                                                 */
/*                                                                            */
/*  The exercise (flow 8; WQ2 B, Q-B15 A): the coach's video in the 4:5       */
/*  frame, else the library exercise's, with "Practise" and "Skip"; then the  */
/*  practise loop on the exercise's words, its instruction first. With no     */
/*  video the plan holds no video screen and the practise comes straight     */
/*  away. The walk never waits for a coach: there is no screen for a coach   */
/*  still working, and "Your coach is working on your exercise." is not in   */
/*  it.                                                                       */
/*                                                                            */
/*  The practise loop (flow 7; N52.3, CM3a A, CM3b A, O5): the try records    */
/*  as its screen arrives, Stop sends it to the machine behind the voice      */
/*  mark, and the machine's answer is laid into the plan: praise, then helper */
/*  words from the try's own words; else encouragement and the next try; the  */
/*  third try that is not praise thanks the speaker and moves on; a late or   */
/*  failed read offers Next or Practise again. The mic, the clock and the     */
/*  calls live in useWalkPractise, the screens in WalkPractiseScreens.        */
/*                                                                            */
/*  The clearer version (flow 6; N52.5, N55 WQ3 A, WQ3c A): the speaker's     */
/*  words with what goes crossed out, then the opener (B13), the new words    */
/*  with what arrives in orange, and the question (B14), from the served      */
/*  rewrite. "Accept and practise" hands the decision to the host, which     */
/*  writes it through the accept lane (the speaker's decision, L1); "Keep my  */
/*  words" hands the decline. With personalised practice off the plan marks   */
/*  the screen `accept`: the button reads "Accept" and the question, which    */
/*  asks to practise, is not shown.                                           */
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

/** Helper words tapped from a praised try's own words (not the
 *  paragraph's): saved on the practice, then the paragraph is locked. */
export type FeedbackWalkPractiseWords = {
  practiceId: string;
  partId: string;
  phrase: string;
};

type Props<R> = {
  /** The walk, live. It is held still from the moment the walk opens until
   *  it closes, so a re-read of the page cannot move the screen under the
   *  speaker (the pager's frozen list, the same rule). */
  model: FeedbackWalkModel<R>;
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
  /** "Accept and practise" (or "Accept") on a clearer version: the host
   *  writes the speaker's decision through the accept lane. The walk moves
   *  on at once; it never waits on the write. */
  onAcceptClearer?: (item: R) => void;
  /** "Keep my words": the host records the decline; no practise follows. */
  onKeepWords?: (item: R) => void;
  /** The practise's calls (open, upload, check). Without them a practise
   *  screen is never reached: "Accept and practise" goes past it. */
  practise?: WalkPractiseIO<R> | null;
  /** Helper words picked from a praised try. */
  onSavePractiseWords?: (save: FeedbackWalkPractiseWords) => void;
  /** O5's limit on the machine's read; tests shorten it. */
  readLimitMs?: number;
  /** The speaker's judgement on a moment: the host saves it (only when it
   *  differs from the earlier answer). The walk never waits on the write. */
  onJudge?: (save: WalkJudgementSave<R>) => void;
  /** Skip on "Judgement time!": every judgement left unanswered, for the
   *  host to settle as skipped. */
  onSkipJudging?: (items: R[]) => void;
  /** The Journal post "More about self-modeling theory" opens; none: no
   *  link. */
  journal?: WalkJournalPost | null;
  /** The sharing screen's calls (join, set up, share this Take). Without
   *  them Continue moves on and nothing is sent. */
  share?: ShareIO | null;
  /** The walk ran out: the host's end card. */
  onEnd: () => void;
  /** ✕: the overlay sinks back to the page. */
  onClose?: () => void;
};

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

export default function FeedbackWalk<R = unknown>({
  model,
  request,
  coachNote,
  firstTake,
  guest = false,
  onGuest,
  onSaveHelperWords,
  onAcceptClearer,
  onKeepWords,
  practise: practiseIO = null,
  onSavePractiseWords,
  readLimitMs,
  onJudge,
  onSkipJudging,
  journal = null,
  share: shareIO = null,
  onEnd,
  onClose,
}: Props<R>) {
  const liveModel = useRef(model);
  liveModel.current = model;
  const [walk, setWalk] = useState<FeedbackWalkModel<R>>(model);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);
  const [picks, setPicks] = useState<Record<string, PhraseSelection | null>>({});
  const guestBlock = useGuestBlock();

  const requestRef = useRef(request);
  requestRef.current = request;
  const seq = request?.seq ?? null;
  const resetRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const asked = requestRef.current;
    if (seq === null || !asked) return;
    resetRef.current();
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
  /** Move to `to` on `steps`; the page underneath ends the walk. */
  const land = useCallback(
    (steps: readonly WalkStep[], to: number, how: WalkDir | undefined) => {
      const at2 = Math.max(0, Math.min(to, steps.length - 1));
      go(at2, how);
      if (steps[at2]?.overlay === false) onEnd();
    },
    [go, onEnd],
  );
  const forward = useCallback(() => land(plan, at + 1, "forward"), [at, plan, land]);
  const back = useCallback(() => {
    // The checking screen and a late read are passed over: a try is not
    // checked twice by going back.
    let to = at - 1;
    while (to > 0 && (plan[to]?.key === "processing" || plan[to]?.key === "late")) to -= 1;
    if (plan[to]?.overlay === false || to < 0) return;
    go(to, "back");
  }, [at, plan, go]);
  /** The practise lays a new plan in as the machine answers. */
  const relay = useCallback(
    (steps: WalkStep[], to: number, how: WalkDir) => {
      setWalk((w) => ({ ...w, plan: steps }));
      land(steps, to, how);
    },
    [land],
  );

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

  const practise = useWalkPractise<R>({
    io: practiseIO,
    plan,
    at,
    moments: walk.moments,
    blocked,
    relay,
    readLimitMs,
  });
  const judging = useWalkJudging<R>({
    plan,
    moments: walk.moments,
    guest,
    blocked,
    forward,
    land,
    onJudge,
    onSkipJudging,
  });
  const share = useWalkShare({ io: shareIO, blocked, forward });
  resetRef.current = () => {
    practise.reset();
    judging.reset();
    share.reset();
  };
  const close = useCallback(() => {
    practise.cancel();
    judging.closeJournal();
    go(0, undefined);
    onClose?.();
  }, [practise, judging, go, onClose]);
  /** Past this moment's practise: "Keep my words", or no practise to do. */
  const pastLoop = useCallback(() => land(plan, loopEnd(plan, at), "forward"), [plan, at, land]);

  const ctx: ScreenCtx<R> = {
    walk,
    at: (s) => plan.indexOf(s),
    first: (s) => plan[plan.indexOf(s) - 1]?.overlay === false,
    coachNote,
    firstTake,
    forward,
    back,
    close,
    picks,
    pick: (s, next) => {
      if (blocked(s)) return;
      setPicks((p) => ({ ...p, [pickKey(s)]: next }));
    },
    save: (s, moment) => {
      if (blocked(s)) return;
      const picked = picks[pickKey(s)] ?? null;
      const tried = s.kind === "try" ? practise.tryOf(moment.index) : undefined;
      if (tried?.words) {
        const phrase = selectionText(tried.words, phraseTokens(tried.words), picked);
        if (phrase) onSavePractiseWords?.({ practiceId: tried.practiceId, partId: moment.partId, phrase });
        forward();
        return;
      }
      const span = selectionSpan(moment.paragraphText, phraseTokens(moment.paragraphText), picked);
      if (span) {
        onSaveHelperWords({ partId: moment.partId, span, paragraphText: moment.paragraphText });
      }
      forward();
    },
    accept: (s, moment) => {
      if (blocked(s) || !moment.clearer) return;
      onAcceptClearer?.(moment.clearer.item);
      // "Accept and practise" opens the practise on the accepted words; it
      // records as it arrives. With no practise to do, the walk goes on.
      if (practiseIO) forward();
      else pastLoop();
    },
    keep: (s, moment) => {
      if (blocked(s) || !moment.clearer) return;
      onKeepWords?.(moment.clearer.item);
      pastLoop();
    },
    exercise: (s) => {
      if (blocked(s)) return;
      // "Practise" opens the practise on the exercise; it records as it
      // arrives. With no practise to do, the walk goes on.
      if (practiseIO) forward();
      else pastLoop();
    },
    pastLoop,
    practise,
    judging,
    journal,
    share,
    nav: (s, moment) => momentNav(ctx, s, moment),
  };
  // The Journal post is drawn over "Judgement time!", never planned.
  const screen: WalkStep = judging.journalOpen && step.key === "intro" ? { key: "journal" } : step;

  return (
    <div data-feedback-walk data-walk-step={screen.key}>
      <WalkStage screen={screen} dir={dir} render={(s) => renderScreen(ctx, s)} />
      {/* A toast lives on the walk's own screens only: none follows the
          speaker onto the end card ("Record Take N"). */}
      {judging.toast && screen.overlay !== false ? (
        <WalkToast key={judging.toast.seq} message={judging.toast.text} onDone={judging.clearToast} />
      ) : null}
      {share.toast && screen.key === "community" ? (
        <WalkToast key={`share-${share.toast.seq}`} message={share.toast.text} onDone={share.clearToast} />
      ) : null}
    </div>
  );
}

/** Helper words are picked once per screen kind and moment: after a praise
 *  from the paragraph, after a praised try from the try's words. */
const pickKey = (step: WalkStep) => `${step.moment ?? -1}:${step.kind ?? ""}`;

type ScreenCtx<R = unknown> = {
  walk: FeedbackWalkModel<R>;
  /** Where a step sits in the plan. */
  at: (step: WalkStep) => number;
  /** Back is off on the walk's first screen. */
  first: (step: WalkStep) => boolean;
  coachNote: FeedbackWalkCoachNote | null;
  firstTake: boolean;
  forward: () => void;
  back: () => void;
  close: () => void;
  picks: Record<string, PhraseSelection | null>;
  pick: (step: WalkStep, next: PhraseSelection | null) => void;
  save: (step: WalkStep, moment: FeedbackWalkMoment) => void;
  accept(step: WalkStep, moment: FeedbackWalkMoment<R>): void;
  keep(step: WalkStep, moment: FeedbackWalkMoment<R>): void;
  /** "Practise" under an exercise's video. */
  exercise: (step: WalkStep) => void;
  /** Past this moment's practise: Skip under an exercise's video. */
  pastLoop: () => void;
  practise: WalkPractise;
  judging: WalkJudging;
  journal: WalkJournalPost | null;
  share: WalkShare;
  nav: (step: WalkStep, moment: FeedbackWalkMoment<unknown>) => WalkNav;
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

/** "Choose your helper words", after a praise: the subtitle, then at most
 *  four words, one phrase. */
function Helpers(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  const picked = ctx.picks[pickKey(step)] ?? null;
  const words = (step.kind === "try" ? ctx.practise.tryOf(moment.index)?.words : null) ?? moment.paragraphText;
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
      {/* The prototype's subtitle under "Choose your helper words", on every
          Take (founder lock 2026-10-06; Q-B4 A, N62). */}
      <p data-walk-subtitle className="m-0 text-[14.5px] text-muted-foreground">
        {WALK_COPY.helpersSubtitle}
      </p>
      <WalkWordPicker
        words={phraseTokens(words).map((token) => token.text)}
        selection={picked}
        onChange={(next) => ctx.pick(step, next)}
      />
    </WalkOverlay>
  );
}

/** The served words as runs: what goes crossed out, what arrives in
 *  orange (WalkNewWords colours the <em>). */
function pieces(list: readonly ClearerPiece[]) {
  return list.map((p, i) => {
    if (p.cut) return <s key={i}>{p.text}</s>;
    if (p.fresh) return <em key={i}>{p.text}</em>;
    return <span key={i}>{p.text}</span>;
  });
}

/** The clearer version (flow 6): the speaker's words and voice, then the
 *  opener, the new words and the question, from the signed bank. */
function Clearer<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const clearer = moment.clearer;
  if (!clearer) return null;
  const turn = clearerTurn(ctx.walk.plan, ctx.at(step));
  const practiseOff = step.kind === "accept";
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={momentNav(ctx, step, moment)}
      onClose={ctx.close}
      title={COPY.cardClearerVersion}
      footer={
        <WalkFooter
          pill={{
            label: practiseOff ? WALK_COPY.clearerAccept : COPY.pillAcceptPractise,
            onClick: () => ctx.accept(step, moment),
            testId: "walk-forward",
          }}
          links={[{ label: COPY.linkKeepMyWords, onClick: () => ctx.keep(step, moment), testId: "walk-keep" }]}
        />
      }
    >
      <WalkPlayer
        seed={`moment-${moment.index}`}
        src={moment.clip?.src ?? null}
        startOffsetMs={moment.clip?.startOffsetMs}
        durationMs={moment.clip?.durationMs}
        label={`${COPY.pagerMoment} ${moment.index + 1} ${COPY.pagerOf} ${ctx.walk.moments.length}`}
        words={pieces(clearer.before)}
      />
      <WalkMessage>
        <span>{bankLine(WALK_LINE_BANK.B13.lines, turn)}</span>
        <WalkNewWords>{pieces(clearer.after)}</WalkNewWords>
        {practiseOff ? null : <span>{bankLine(WALK_LINE_BANK.B14.lines, turn)}</span>}
      </WalkMessage>
    </WalkOverlay>
  );
}

/** The exercise (flow 8): its video in the 4:5 frame (the coach's, else
 *  the library's; the plan holds this screen only when there is one), with
 *  "Practise" and "Skip". Nothing here waits on a coach (WQ2 B). */
function ExVideo<R>(ctx: ScreenCtx<R>, step: WalkStep, moment: FeedbackWalkMoment<R>) {
  const video = moment.exercise?.video;
  if (!video) return null;
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={momentNav(ctx, step, moment)}
      onClose={ctx.close}
      title={COPY.titleExercise}
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.exercisePractise, onClick: () => ctx.exercise(step), testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.pastLoop, testId: "walk-skip" }]}
        />
      }
    >
      <CoachVideo src={video} className="w-full flex-none [&>video]:aspect-[4/5] [&>video]:object-cover" />
    </WalkOverlay>
  );
}

/** "Judgement time!": a screen that stands apart, with the Journal post's
 *  link when there is a post to open. */
function Intro(ctx: ScreenCtx, step: WalkStep) {
  const { judging, journal } = ctx;
  return (
    <JudgementIntro
      testId={testId(step)}
      onClose={ctx.close}
      onPromise={ctx.forward}
      onSkip={() => judging.skip(step)}
      onJournal={journal ? judging.openJournal : null}
    />
  );
}

/** The Journal post inside the overlay; ‹ and "Back" return to the intro. */
function Journal(ctx: ScreenCtx, step: WalkStep) {
  if (!ctx.journal) return null;
  return <JournalPostScreen testId={testId(step)} post={ctx.journal} onBack={ctx.judging.closeJournal} />;
}

/** One judgement: the moment's voice only, and the one judgement screen. */
function Judge(ctx: ScreenCtx, step: WalkStep, moment: FeedbackWalkMoment) {
  const { judging } = ctx;
  const nav = { ...momentNav(ctx, step, moment), backDisabled: firstJudgement(ctx.walk.plan, ctx.at(step)) };
  return (
    <JudgeScreen
      key={`${moment.index}:${judging.nonce}`}
      testId={testId(step)}
      nav={nav}
      onClose={ctx.close}
      player={
        moment.clip ? (
          <WalkPlayer
            seed={`moment-${moment.index}`}
            src={moment.clip.src}
            startOffsetMs={moment.clip.startOffsetMs}
            durationMs={moment.clip.durationMs}
            label={`${COPY.pagerMoment} ${moment.index + 1} ${COPY.pagerOf} ${ctx.walk.moments.length}`}
          />
        ) : null
      }
      value={judging.answers[moment.index] ?? null}
      onAnswer={(value) => judging.answer(step, moment, value)}
    />
  );
}

/** Sharing (flow 11): the four choices; Continue shares, ✕ goes on. */
function Share(ctx: ScreenCtx, step: WalkStep) {
  const { share } = ctx;
  return (
    <WalkShareScreen
      testId={testId(step)}
      ticks={share.ticks}
      onTicks={(next) => share.tick(step, next)}
      fields={share.fields}
      onField={(name, value) => share.field(step, name, value)}
      ready={share.ready}
      busy={share.busy}
      onContinue={() => share.submit(step)}
      onClose={ctx.forward}
    />
  );
}

function renderScreen<R>(ctx: ScreenCtx<R>, step: WalkStep): ReactNode {
  if (step.key === "coachnote") return CoachNote(ctx, step);
  if (step.key === "community") return Share(ctx, step);
  if (step.key === "intro") return Intro(ctx, step);
  if (step.key === "journal") return Journal(ctx, step);
  const moment = step.moment == null ? undefined : ctx.walk.moments[step.moment];
  if (!moment) return null;
  if (step.key === "praise") return Praise(ctx, step, moment);
  if (step.key === "helpers") return Helpers(ctx, step, moment);
  if (step.key === "clearer") return Clearer(ctx, step, moment);
  if (step.key === "exVideo") return ExVideo(ctx, step, moment);
  if (step.key === "judge") return Judge(ctx, step, moment);
  const practiseCtx: PractiseScreenCtx = {
    plan: ctx.walk.plan,
    at: ctx.at,
    nav: ctx.nav,
    total: ctx.walk.moments.length,
    close: ctx.close,
    forward: ctx.forward,
    ...ctx.practise,
  };
  return renderPractiseScreen(practiseCtx, step, moment as FeedbackWalkMoment<unknown>) ?? null;
}
