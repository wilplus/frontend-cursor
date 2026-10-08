"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import CoachVideo from "@/components/willab/CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import WalkOverlay, { type WalkNav } from "@/components/willab/walk/WalkOverlay";
import WalkMessage, { WalkNewWords } from "@/components/willab/walk/WalkMessage";
import WalkPlayer from "@/components/willab/walk/WalkPlayer";
import { JournalPostScreen, JudgeScreen, JudgementIntro } from "@/components/willab/walk/WalkJudgementScreens";
import WalkFooter from "@/components/willab/walk/WalkFooter";
import WalkOptions, { WalkField, type WalkOption } from "@/components/willab/walk/WalkOptions";
import WalkLoading from "@/components/willab/walk/WalkLoading";
import WalkWordPicker from "@/components/willab/walk/WalkWordPicker";
import type { PhraseSelection } from "@/lib/willab/phraseTokens";
import RecordingStrip from "@/components/willab/walk/RecordingStrip";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { aiGeneratedLabel } from "@/lib/willab/aiGeneratedMark";
import {
  COACH_NOTE,
  JOURNAL_POST,
  LOUNGE_STANDIN,
  MOMENTS,
  PARAGRAPHS,
  PROJECT_TITLE,
  SLIDE_LABEL,
  TAKE_SHOWN,
  BANK_PICKS,
  type Piece,
  type Step,
} from "./walkFixtures";

/* -------------------------------------------------------------------------- */
/*  The prototype's screens, composed from the walk's primitives. DEV ONLY.    */
/*  One function per screen; the host (page.tsx) owns the state and the       */
/*  order. Nothing here is mounted by the product (build plan P1).            */
/* -------------------------------------------------------------------------- */

export type WalkCtx = {
  step: Step;
  first: boolean;
  audioSrc: string | null;
  forward: () => void;
  back: () => void;
  close: () => void;
  /** "More about self-modeling theory": the Journal post, inside the flow. */
  openJournal: () => void;
  /** "Keep my words": the clearer version is declined and its practise is
   *  skipped; the walk goes on with the next moment (D-FW-12). */
  keepWords: () => void;
  /** "Accept" while practice is off (WQ3c A): the clearer words go into the
   *  text, nothing is practised, and the walk goes on with the next moment. */
  acceptWords: () => void;
  /** Skip on "Judgement time!": the bars are cleared and the walk still
   *  asks to share, then the end card (Q-B6 A). */
  skipJudging: () => void;
  answers: Record<number, ConfidenceRatingValue>;
  answer: (moment: number, value: ConfidenceRatingValue) => void;
  helpers: Record<number, PhraseSelection | null>;
  pickHelpers: (moment: number, picked: PhraseSelection | null) => void;
  community: string[];
  setCommunity: (next: string[]) => void;
  elapsed: number;
};

/** No network, no file: the dark box with its play button. */
const NO_VIDEO = "data:video/mp4;base64,";

const mom = (ctx: WalkCtx) => MOMENTS[ctx.step.moment ?? 0];
const testId = (ctx: WalkCtx) => `walk-screen-${ctx.step.key}`;

function momentNav(ctx: WalkCtx): WalkNav {
  return {
    label: SLIDE_LABEL,
    index: ctx.step.moment ?? 0,
    total: MOMENTS.length,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: ctx.first,
  };
}

function player(ctx: WalkCtx, words?: ReactNode) {
  const m = mom(ctx);
  return (
    <WalkPlayer
      seed={`moment-${m.index}`}
      src={ctx.audioSrc}
      durationMs={m.durationMs}
      label={`${COPY.pagerMoment} ${m.index + 1} ${COPY.pagerOf} ${MOMENTS.length}`}
      words={words}
    />
  );
}

function pieces(list: readonly Piece[]) {
  return list.map((p, i) => {
    if (p.cut) return <s key={i}>{p.text}</s>;
    if (p.fresh) return <em key={i}>{p.text}</em>;
    return <span key={i}>{p.text}</span>;
  });
}

function CoachNote(ctx: WalkCtx) {
  const nav: WalkNav = {
    position: `${COPY.historyTake} ${TAKE_SHOWN}`,
    index: 0,
    total: 1,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: true,
  };
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={nav}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      <CoachVideo src={NO_VIDEO} className="w-full flex-none" />
      <WalkMessage>{COACH_NOTE}</WalkMessage>
    </WalkOverlay>
  );
}

function Praise(ctx: WalkCtx) {
  const m = mom(ctx);
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {player(ctx)}
      <WalkMessage>{m.praise?.text}</WalkMessage>
    </WalkOverlay>
  );
}

function Clearer(ctx: WalkCtx) {
  const c = mom(ctx).clearer;
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.cardClearerVersion}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillAcceptPractise, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: COPY.linkKeepMyWords, onClick: ctx.keepWords, testId: "walk-keep-words" }]}
        />
      }
    >
      {player(ctx, pieces(c?.before ?? []))}
      <WalkMessage>
        <span>{WALK_COPY.clearerOffer}</span>
        <WalkNewWords>{pieces(c?.after ?? [])}</WalkNewWords>
        <span>{WALK_COPY.clearerAsk}</span>
      </WalkMessage>
    </WalkOverlay>
  );
}

/** The clearer version while personalised practice is off (WQ3c A): the
 *  words can be taken into the text but not practised, so the pill reads
 *  "Accept" and nothing records. */
function ClearerOff(ctx: WalkCtx) {
  const c = mom(ctx).clearer;
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.cardClearerVersion}
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.clearerAccept, onClick: ctx.acceptWords, testId: "walk-forward" }}
          links={[{ label: COPY.linkKeepMyWords, onClick: ctx.keepWords, testId: "walk-keep-words" }]}
        />
      }
    >
      {player(ctx, pieces(c?.before ?? []))}
      <WalkMessage>
        <span>{WALK_COPY.clearerOffer}</span>
        <WalkNewWords>{pieces(c?.after ?? [])}</WalkNewWords>
        <span>{WALK_COPY.clearerAsk}</span>
      </WalkMessage>
    </WalkOverlay>
  );
}

function ExVideo(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titleExercise}
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.exercisePractise, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      <CoachVideo src={NO_VIDEO} className="w-full flex-none [&>video]:aspect-[4/5] [&>video]:object-cover" />
    </WalkOverlay>
  );
}

/** Practising: recording from the start; no title, no slide bar. */
function Practise(ctx: WalkCtx) {
  const m = mom(ctx);
  const words = ctx.step.kind === "words";
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.close}
      footer={
        <WalkFooter links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}>
          <RecordingStrip elapsed={ctx.elapsed} stopLabel={COPY.pillStop} onStop={ctx.forward} />
        </WalkFooter>
      }
    >
      <WalkMessage>{words ? m.clearer?.coachLine : m.exercise?.instruction}</WalkMessage>
      <p className="m-0 text-[25px] font-semibold leading-[1.35]">{words ? m.clearer?.say : PARAGRAPHS[m.index]}</p>
    </WalkOverlay>
  );
}

function Processing(ctx: WalkCtx) {
  return (
    <WalkOverlay testId={testId(ctx)} onClose={ctx.close} bare>
      <WalkLoading />
    </WalkOverlay>
  );
}

function Improved(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {player(ctx)}
      <WalkMessage>{BANK_PICKS.improved}</WalkMessage>
    </WalkOverlay>
  );
}

function Encourage(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      {player(ctx)}
      <WalkMessage>{WALK_COPY.encourage}</WalkMessage>
    </WalkOverlay>
  );
}

/** A try where nothing moved (NX3a): one of the signed lines, then another
 *  practise, until praise or Skip. */
function NothingMoved(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      {player(ctx)}
      <WalkMessage>{BANK_PICKS.nothingMoved}</WalkMessage>
    </WalkOverlay>
  );
}

/** After the third try that isn't praise (CM3b A, N55): one of the signed
 *  lines, and the walk moves on; nothing more to skip. */
function ThirdTry(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {player(ctx)}
      <WalkMessage>{BANK_PICKS.thirdTry}</WalkMessage>
    </WalkOverlay>
  );
}

function Helpers(ctx: WalkCtx) {
  const m = mom(ctx);
  const picked = ctx.helpers[m.index] ?? null;
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.close}
      title={COPY.titleEmphasis}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillEmphasise, onClick: ctx.forward, disabled: picked === null, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward, testId: "walk-skip" }]}
        />
      }
    >
      <p className="m-0 text-[14.5px] text-muted-foreground">{COPY.emphasisFirstTakeNote}</p>
      <WalkWordPicker
        words={PARAGRAPHS[m.index].split(" ")}
        selection={picked}
        onChange={(next) => ctx.pickHelpers(m.index, next)}
      />
    </WalkOverlay>
  );
}

/** "Judgement time!": a screen that stands apart (the production screen). */
function Intro(ctx: WalkCtx) {
  return (
    <JudgementIntro
      testId={testId(ctx)}
      onClose={ctx.close}
      onPromise={ctx.forward}
      // Skip clears the bars and still asks to share (Q-B6 A); the link
      // opens the Journal post inside the flow, ‹ and Back return.
      onSkip={ctx.skipJudging}
      onJournal={ctx.openJournal}
    />
  );
}

/** The Journal post inside the flow (the production screen, on the signed
 *  post's harness copy). */
function Journal(ctx: WalkCtx) {
  return <JournalPostScreen testId={testId(ctx)} post={JOURNAL_POST} onBack={ctx.back} />;
}

function Judge(ctx: WalkCtx) {
  const m = mom(ctx);
  return (
    <JudgeScreen
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      player={player(ctx)}
      value={ctx.answers[m.index] ?? null}
      onAnswer={(v) => ctx.answer(m.index, v)}
    />
  );
}

const COMMUNITY: readonly WalkOption[] = [
  { value: "general", label: WALK_COPY.shareGeneral, hint: WALK_COPY.shareGeneralHint },
  {
    value: "mine",
    label: WALK_COPY.shareMine,
    hint: WALK_COPY.shareMineHint,
    fields: <WalkField placeholder={WALK_COPY.fieldPassCode} />,
  },
  {
    value: "own",
    label: WALK_COPY.shareOwn,
    fields: (
      <>
        <WalkField placeholder={WALK_COPY.fieldCommunityName} />
        <WalkField placeholder={WALK_COPY.fieldPassCode} />
      </>
    ),
  },
  { value: "none", label: WALK_COPY.shareNone, hint: WALK_COPY.shareNoneHint, exclusive: true },
];

/** Sharing: a screen that stands apart; several ticks, the last alone. */
function Community(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.forward}
      bare
      footer={
        <WalkFooter
          pill={{
            label: COPY.pillContinue,
            onClick: ctx.forward,
            disabled: ctx.community.length === 0,
            testId: "walk-forward",
          }}
        />
      }
    >
      <div className="flex flex-col gap-2.5 px-6 pb-1.5 pt-7">
        <h2 className="m-0 text-balance text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]">
          {WALK_COPY.shareTitle}
        </h2>
        <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.shareAsk}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">
        <WalkOptions options={COMMUNITY} selected={ctx.community} onChange={ctx.setCommunity} />
      </div>
    </WalkOverlay>
  );
}

/** The Lounge around the walk (walk lock, flow 1): when feedback from the
 *  coach arrives, the Ideal Text bubble gets the orange outline and the
 *  "new" tag; the paragraph on the page keeps only its bar. A still
 *  stand-in, not the product's Lounge. */
export function LoungeStandIn({ onOpen, walked = false }: { onOpen: () => void; walked?: boolean }) {
  return (
    // Fixed over the whole viewport, as the walk's overlay is, so the app's
    // pinned footer never shows under the stand-in.
    <main data-walk-lounge className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-center border-b border-border px-5 py-2.5 text-[16px] font-semibold">
        WillpowerLab
      </header>
      <div className="flex flex-1 flex-col justify-end gap-2.5 px-4 py-2">
        <p className="m-0 ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-[15px] leading-[1.45] text-background">
          {LOUNGE_STANDIN.speakerMessage}
        </p>
        <button
          type="button"
          data-testid="walk-lounge-bubble"
          data-walk-marked={walked ? undefined : "true"}
          onClick={onOpen}
          className={cn(
            "relative mr-auto flex w-[80%] items-center gap-2.5 rounded-[18px] border border-border bg-background p-2.5 text-left",
            // The style as an arbitrary property: cn (tailwind-merge) drops a bare
            // `outline` beside `outline-2`, and the ring did not draw.
            !walked && "[outline-style:solid] outline-2 outline-offset-[3px] outline-primary",
          )}
        >
          <span aria-hidden className="aspect-video w-[72px] flex-none rounded-md bg-muted" />
          <span className="flex min-w-0 flex-col">
            <b className="text-[15px]">{PROJECT_TITLE}</b>
            <small className="text-[12px] text-muted-foreground">{aiGeneratedLabel("ideal-text", TAKE_SHOWN)}</small>
          </span>
          {!walked ? (
            <span className="absolute -right-1.5 -top-3.5 rounded-full bg-primary px-[9px] text-[11px] font-semibold leading-[1.5] text-background">
              {COPY.chipNew}
            </span>
          ) : null}
        </button>
      </div>
    </main>
  );
}

const SCREENS: Record<Exclude<Step["key"], "page" | "end" | "lounge">, (ctx: WalkCtx) => ReactNode> = {
  coachnote: CoachNote,
  praise: Praise,
  clearer: Clearer,
  clearerOff: ClearerOff,
  exVideo: ExVideo,
  practise: Practise,
  processing: Processing,
  improved: Improved,
  encourage: Encourage,
  nothingMoved: NothingMoved,
  thirdTry: ThirdTry,
  helpers: Helpers,
  intro: Intro,
  journal: Journal,
  judge: Judge,
  community: Community,
};

export function renderWalkScreen(ctx: WalkCtx): ReactNode {
  const key = ctx.step.key;
  if (key === "page" || key === "end" || key === "lounge") return null;
  return SCREENS[key](ctx);
}
